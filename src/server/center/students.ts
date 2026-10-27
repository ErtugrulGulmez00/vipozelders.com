import type { Prisma } from "@/generated/prisma/client";
import { dateStringToDbDate } from "@/lib/dates";
import type { ImportedStudent } from "@/lib/center/import";
import { generateUsername } from "../accounts";
import { generateTemporaryPassword, hashPassword, hashToken, randomToken } from "../auth/password";
import { issueUserToken } from "../auth/tokens";
import { encryptText } from "../crypto";
import { db, type DbTransaction } from "../db";
import { appUrl, renderEmail } from "../email";
import { loadSettings } from "../settings";
import type { CenterContext } from "./context";
import { CenterError, isUniqueViolation } from "./errors";

// Kurum öğrencileri ve velileri.

export type GuardianInput = {
  fullName: string;
  relation: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  notifyWhatsapp: boolean;
  notifyEmail: boolean;
};

export type StudentInput = {
  studentNumber: string | null;
  firstName: string;
  lastName: string;
  gender: "FEMALE" | "MALE" | "UNSPECIFIED";
  birthDate: string | null;
  identityNumber: string | null;
  schoolName: string | null;
  gradeName: string | null;
  targetExam: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type Tx = DbTransaction | typeof db;

/** Kurumdaki en büyük sayısal öğrenci numarasının bir fazlası (ilk numara 1001). */
export async function nextStudentNumber(centerId: string, tx: Tx = db): Promise<string> {
  const rows = await tx.centerStudent.findMany({ where: { centerId, studentNumber: { not: null } }, select: { studentNumber: true } });
  const max = rows.reduce((m, r) => (/^\d{1,9}$/.test(r.studentNumber ?? "") ? Math.max(m, Number(r.studentNumber)) : m), 1000);
  return String(max + 1);
}

export async function assertStudentCapacity(ctx: CenterContext, adding = 1, tx: Tx = db) {
  const active = await tx.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } });
  if (active + adding > ctx.center.studentLimit) {
    throw new CenterError(
      `Planınızın öğrenci sınırı ${ctx.center.studentLimit}; şu an ${active} aktif öğrenciniz var. Ayrılan öğrencileri “Ayrıldı” yapabilir ya da planınızı yükseltebilirsiniz.`,
    );
  }
}

function studentData(input: StudentInput) {
  return {
    studentNumber: input.studentNumber,
    firstName: input.firstName,
    lastName: input.lastName,
    gender: input.gender,
    birthDate: input.birthDate ? dateStringToDbDate(input.birthDate) : null,
    schoolName: input.schoolName,
    gradeName: input.gradeName,
    targetExam: input.targetExam,
    phone: input.phone,
    email: input.email,
    address: input.address,
    notes: input.notes,
  };
}

async function validGroupIds(centerId: string, groupIds: string[], tx: Tx) {
  if (!groupIds.length) return [];
  const groups = await tx.centerGroup.findMany({ where: { centerId, id: { in: groupIds } }, select: { id: true } });
  return groups.map((g) => g.id);
}

export async function createStudent(ctx: CenterContext, input: StudentInput, guardians: GuardianInput[], groupIds: string[], leadId?: string | null) {
  await assertStudentCapacity(ctx);
  try {
    return await db.$transaction(async (tx) => {
      const studentNumber = input.studentNumber || (await nextStudentNumber(ctx.center.id, tx));
      const student = await tx.centerStudent.create({
        data: {
          centerId: ctx.center.id,
          ...studentData({ ...input, studentNumber }),
          identityNumberEnc: input.identityNumber ? encryptText(input.identityNumber) : null,
          guardians: {
            create: guardians.map((g, i) => ({ centerId: ctx.center.id, ...g, isPrimary: i === 0 || g.isPrimary })),
          },
        },
      });
      const ids = await validGroupIds(ctx.center.id, groupIds, tx);
      if (ids.length) await tx.centerGroupStudent.createMany({ data: ids.map((groupId) => ({ groupId, studentId: student.id })) });
      if (leadId) await tx.centerLead.updateMany({ where: { id: leadId, centerId: ctx.center.id }, data: { status: "ENROLLED" } });
      return student;
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new CenterError("Bu öğrenci numarası başka bir öğrencide kayıtlı.", { studentNumber: "Numara kullanımda." });
    throw error;
  }
}

export async function getStudentOrThrow(ctx: CenterContext, studentId: string, tx: Tx = db) {
  const student = await tx.centerStudent.findFirst({ where: { id: studentId, centerId: ctx.center.id } });
  if (!student) throw new CenterError("Öğrenci bulunamadı.");
  return student;
}

export async function updateStudent(ctx: CenterContext, studentId: string, input: StudentInput, groupIds: string[] | null, identity: { action: "keep" | "set" | "clear"; value?: string }) {
  await getStudentOrThrow(ctx, studentId);
  try {
    await db.$transaction(async (tx) => {
      const identityUpdate: Prisma.CenterStudentUpdateInput =
        identity.action === "set" && identity.value ? { identityNumberEnc: encryptText(identity.value) } : identity.action === "clear" ? { identityNumberEnc: null } : {};
      await tx.centerStudent.update({
        where: { id: studentId },
        data: { ...studentData({ ...input, studentNumber: input.studentNumber || (await nextStudentNumber(ctx.center.id, tx)) }), ...identityUpdate },
      });
      if (groupIds) {
        const ids = await validGroupIds(ctx.center.id, groupIds, tx);
        const groupFilter = { group: { centerId: ctx.center.id } };
        await tx.centerGroupStudent.deleteMany({ where: { studentId, ...groupFilter, groupId: { notIn: ids } } });
        const existing = new Set((await tx.centerGroupStudent.findMany({ where: { studentId }, select: { groupId: true } })).map((g) => g.groupId));
        const add = ids.filter((id) => !existing.has(id));
        if (add.length) await tx.centerGroupStudent.createMany({ data: add.map((groupId) => ({ groupId, studentId })) });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new CenterError("Bu öğrenci numarası başka bir öğrencide kayıtlı.", { studentNumber: "Numara kullanımda." });
    throw error;
  }
}

export async function setStudentStatus(ctx: CenterContext, studentId: string, status: "ACTIVE" | "PASSIVE" | "LEFT") {
  const student = await getStudentOrThrow(ctx, studentId);
  if (status === "ACTIVE" && student.status !== "ACTIVE") await assertStudentCapacity(ctx);
  await db.centerStudent.update({
    where: { id: studentId },
    data: { status, leftAt: status === "LEFT" ? new Date() : null },
  });
}

/** Öğrenciyi tamamen siler; tahsilatı olan öğrenci muhasebe kaydı bozulmasın diye silinemez. */
export async function deleteStudent(ctx: CenterContext, studentId: string) {
  await getStudentOrThrow(ctx, studentId);
  const payments = await db.centerPayment.count({ where: { studentId, cancelledAt: null } });
  if (payments) throw new CenterError("Bu öğrencinin tahsilat kaydı var; muhasebe kayıtları korunmalı. Silmek yerine durumunu “Ayrıldı” yapın.");
  await db.centerStudent.delete({ where: { id: studentId } });
}

export async function saveGuardian(ctx: CenterContext, studentId: string, guardianId: string | null, input: GuardianInput) {
  await getStudentOrThrow(ctx, studentId);
  await db.$transaction(async (tx) => {
    if (input.isPrimary) await tx.centerGuardian.updateMany({ where: { studentId }, data: { isPrimary: false } });
    if (guardianId) {
      const existing = await tx.centerGuardian.findFirst({ where: { id: guardianId, studentId, centerId: ctx.center.id } });
      if (!existing) throw new CenterError("Veli bulunamadı.");
      await tx.centerGuardian.update({ where: { id: guardianId }, data: input });
    } else {
      const count = await tx.centerGuardian.count({ where: { studentId } });
      if (count >= 4) throw new CenterError("Bir öğrenciye en fazla 4 veli eklenebilir.");
      await tx.centerGuardian.create({ data: { ...input, centerId: ctx.center.id, studentId, isPrimary: input.isPrimary || count === 0 } });
    }
  });
}

export async function deleteGuardian(ctx: CenterContext, guardianId: string) {
  const guardian = await db.centerGuardian.findFirst({ where: { id: guardianId, centerId: ctx.center.id } });
  if (!guardian) throw new CenterError("Veli bulunamadı.");
  await db.centerGuardian.delete({ where: { id: guardianId } });
}

export async function addStudentNote(ctx: CenterContext, studentId: string, input: { kind: "GENERAL" | "GUIDANCE" | "PARENT_MEETING" | "BEHAVIOR"; text: string; visibleToParent: boolean }) {
  await getStudentOrThrow(ctx, studentId);
  return db.centerNote.create({ data: { centerId: ctx.center.id, studentId, authorId: ctx.member.id, ...input } });
}

export async function deleteStudentNote(ctx: CenterContext, noteId: string) {
  const note = await db.centerNote.findFirst({ where: { id: noteId, centerId: ctx.center.id } });
  if (!note) throw new CenterError("Not bulunamadı.");
  const isManager = ctx.member.role === "OWNER" || ctx.member.role === "MANAGER";
  if (!isManager && note.authorId !== ctx.member.id) throw new CenterError("Yalnızca kendi yazdığınız notu silebilirsiniz.");
  await db.centerNote.delete({ where: { id: noteId } });
}

export type ImportSummary = { created: number; updated: number; skipped: { row: number; message: string }[]; groupsCreated: number };

/**
 * Excel'den gelen öğrencileri kaydeder. Öğrenci numarası kurumda varsa kayıt güncellenir,
 * yoksa yeni öğrenci açılır. Grup adı yoksa grup oluşturulur.
 */
export async function importStudents(ctx: CenterContext, rows: ImportedStudent[]): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: [], groupsCreated: 0 };
  const centerId = ctx.center.id;
  const numbers = rows.map((r) => r.studentNumber).filter((n): n is string => Boolean(n));
  const existing = new Map(
    (await db.centerStudent.findMany({ where: { centerId, studentNumber: { in: numbers } }, select: { id: true, studentNumber: true } })).map((s) => [s.studentNumber!, s.id]),
  );
  const newCount = rows.filter((r) => !r.studentNumber || !existing.has(r.studentNumber)).length;
  const active = await db.centerStudent.count({ where: { centerId, status: "ACTIVE" } });
  if (active + newCount > ctx.center.studentLimit) {
    throw new CenterError(`Dosyada ${newCount} yeni öğrenci var; planınızın sınırı ${ctx.center.studentLimit}, şu an ${active} aktif öğrenciniz var.`);
  }
  const groups = new Map((await db.centerGroup.findMany({ where: { centerId }, select: { id: true, name: true } })).map((g) => [g.name.toLocaleLowerCase("tr-TR"), g.id]));
  const seenNumbers = new Set<string>();

  for (const row of rows) {
    if (row.studentNumber && seenNumbers.has(row.studentNumber)) {
      summary.skipped.push({ row: row.row, message: `Öğrenci no ${row.studentNumber} dosyada birden fazla kez geçiyor.` });
      continue;
    }
    if (row.studentNumber) seenNumbers.add(row.studentNumber);
    try {
      await db.$transaction(async (tx) => {
        let groupId: string | null = null;
        if (row.group) {
          const key = row.group.toLocaleLowerCase("tr-TR");
          groupId = groups.get(key) ?? null;
          if (!groupId) {
            const group = await tx.centerGroup.create({ data: { centerId, name: row.group.slice(0, 60), gradeName: row.gradeName, targetExam: row.targetExam } });
            groups.set(key, group.id);
            groupId = group.id;
            summary.groupsCreated++;
          }
        }
        const input: StudentInput = { ...row, studentNumber: row.studentNumber };
        const existingId = row.studentNumber ? existing.get(row.studentNumber) : undefined;
        let studentId: string;
        if (existingId) {
          await tx.centerStudent.update({
            where: { id: existingId },
            data: { ...studentData(input), ...(row.identityNumber ? { identityNumberEnc: encryptText(row.identityNumber) } : {}) },
          });
          studentId = existingId;
          summary.updated++;
        } else {
          const studentNumber = row.studentNumber || (await nextStudentNumber(centerId, tx));
          const student = await tx.centerStudent.create({
            data: { centerId, ...studentData({ ...input, studentNumber }), identityNumberEnc: row.identityNumber ? encryptText(row.identityNumber) : null },
          });
          studentId = student.id;
          summary.created++;
        }
        if (row.guardian) {
          const sameGuardian = await tx.centerGuardian.findFirst({
            where: { studentId, OR: [{ fullName: row.guardian.fullName }, ...(row.guardian.phone ? [{ phone: row.guardian.phone }] : [])] },
          });
          if (sameGuardian) {
            await tx.centerGuardian.update({ where: { id: sameGuardian.id }, data: { ...row.guardian } });
          } else {
            const count = await tx.centerGuardian.count({ where: { studentId } });
            await tx.centerGuardian.create({ data: { centerId, studentId, ...row.guardian, isPrimary: count === 0 } });
          }
        }
        if (groupId) {
          await tx.centerGroupStudent.upsert({ where: { groupId_studentId: { groupId, studentId } }, create: { groupId, studentId }, update: {} });
        }
      });
    } catch (error) {
      summary.skipped.push({ row: row.row, message: isUniqueViolation(error) ? "Öğrenci numarası çakışıyor." : "Kaydedilemedi." });
    }
  }
  return summary;
}

const STUDENT_INVITE_DAYS = 14;

async function queueStudentEmail(to: string, greetingName: string, subject: string, lines: string[], action: { label: string; url: string }, centerName: string) {
  const settings = await loadSettings();
  const { html, text } = renderEmail({ siteName: settings.siteName, greetingName, title: subject, lines, action });
  await db.emailMessage.create({ data: { to, subject: `${subject} · ${centerName}`, html, text } });
}

export type StudentAccountResult = { kind: "created"; username: string; temporaryPassword: string } | { kind: "invited"; email: string };

/**
 * Öğrencinin kendi giriş hesabı (e-posta zorunlu; bildirimler e-postayla gider). E-posta sitede kayıtlı değilse
 * hesap açılır (kullanıcı adı + geçici şifre, ayrıca şifre belirleme e-postası). Öğrencinin sitede kendi hesabı
 * varsa ona davet gider; öğrenci kabul edince hesabı bağlanır. Öğrenci kurum girişinden yalnızca kurum tarafını görür.
 */
export async function createStudentAccount(ctx: CenterContext, studentId: string, email: string): Promise<StudentAccountResult> {
  const student = await getStudentOrThrow(ctx, studentId);
  const existing = await db.centerGuardian.findFirst({ where: { studentId, isStudentAccount: true } });
  if (existing?.userId) throw new CenterError("Bu öğrencinin zaten giriş hesabı var; şifresini sıfırlayabilirsiniz.");
  // Yanıtlanmamış eski davet yenisiyle değişir
  if (existing) await db.centerGuardian.delete({ where: { id: existing.id } });
  const fullName = `${student.firstName} ${student.lastName}`;
  const base = { centerId: ctx.center.id, studentId, fullName, relation: "Öğrenci", isStudentAccount: true, notifyWhatsapp: false, notifyEmail: true, email };
  if (!student.email) await db.centerStudent.update({ where: { id: studentId }, data: { email } });

  const owner = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (owner) {
    if (owner.role !== "STUDENT") throw new CenterError("Bu e-posta bir öğretmen ya da kurum personeli hesabında kayıtlı; öğrencinin kendi e-postasını yazın.", { email: "E-posta kullanımda." });
    if (await db.centerGuardian.findFirst({ where: { studentId, userId: owner.id } })) throw new CenterError("Bu e-postanın sahibi öğrencinin velisi olarak zaten bağlı; öğrencinin kendi e-postasını yazın.", { email: "Veli e-postası." });
    const token = randomToken(24);
    await db.centerGuardian.create({ data: { ...base, inviteTokenHash: hashToken(token), inviteExpiresAt: new Date(Date.now() + STUDENT_INVITE_DAYS * 86_400_000) } });
    await queueStudentEmail(email, student.firstName, "Öğrenci hesabı daveti", [
      `${ctx.center.name}, sitedeki hesabınızı öğrenci kaydınıza bağlamak istiyor.`,
      "Bağlayınca devamsızlığınızı, ödevlerinizi ve deneme sonuçlarınızı görür, öğretmenlerinize fotoğrafla soru gönderirsiniz.",
      `Bağlantı ${STUDENT_INVITE_DAYS} gün geçerlidir; hesabınızla giriş yapıp onaylamanız yeterli.`,
    ], { label: "Daveti aç", url: `/kurum-davet/${token}` }, ctx.center.name);
    return { kind: "invited", email };
  }

  const username = await generateUsername(student.firstName, student.lastName);
  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.create({
    data: {
      role: "STUDENT",
      email,
      username,
      firstName: student.firstName,
      lastName: student.lastName,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      // Kurum, öğrenci kaydını yaparken aydınlatma yükümlülüğünü üstlenir (veri sorumlusu kurumdur).
      studentProfile: { create: { accountType: "STUDENT", kvkkConsentAt: new Date() } },
    },
  });
  await db.centerGuardian.create({ data: { ...base, userId: user.id, linkedAt: new Date() } });
  const token = await issueUserToken(user.id, "PASSWORD_RESET", 3 * 24 * 60 * 60 * 1000);
  await queueStudentEmail(email, student.firstName, "Öğrenci hesabınız açıldı", [
    `${ctx.center.name} size öğrenci hesabı açtı.`,
    `Giriş adresi: ${appUrl("/kurum-giris")}`,
    `Kullanıcı adınız: ${username} (e-posta adresinizle de girebilirsiniz)`,
    "Aşağıdaki bağlantıdan şifrenizi belirleyin (3 gün geçerli). Kurumunuz size geçici bir şifre de vermiş olabilir.",
  ], { label: "Şifremi belirle", url: `/sifre-sifirla/${token}` }, ctx.center.name);
  return { kind: "created", username, temporaryPassword };
}

export async function resetStudentAccountPassword(ctx: CenterContext, studentId: string) {
  await getStudentOrThrow(ctx, studentId);
  const link = await db.centerGuardian.findFirst({ where: { studentId, isStudentAccount: true, userId: { not: null } }, include: { user: true } });
  if (!link?.user) throw new CenterError("Öğrencinin giriş hesabı yok.");
  const others = await db.centerGuardian.count({ where: { userId: link.user.id, studentId: { not: studentId } } });
  if (others || link.user.role !== "STUDENT") throw new CenterError("Bu hesap başka kayıtlarda da kullanılıyor; şifresini öğrenci “Şifremi unuttum” ile yenilemeli.");
  const temporaryPassword = generateTemporaryPassword();
  await db.user.update({ where: { id: link.user.id }, data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true } });
  await db.session.deleteMany({ where: { userId: link.user.id } });
  return { username: link.user.username, temporaryPassword };
}

/** Öğrencinin giriş hesabını kuruma bağlantısından ayırır ve hesabı kapatır. */
export async function removeStudentAccount(ctx: CenterContext, studentId: string) {
  await getStudentOrThrow(ctx, studentId);
  const link = await db.centerGuardian.findFirst({ where: { studentId, isStudentAccount: true }, include: { user: { select: { id: true, role: true } } } });
  if (!link) throw new CenterError("Öğrencinin giriş hesabı yok.");
  await db.centerGuardian.delete({ where: { id: link.id } });
  if (link.user && link.user.role === "STUDENT") {
    const [otherLinks, bookings] = await Promise.all([
      db.centerGuardian.count({ where: { userId: link.user.id } }),
      db.booking.count({ where: { studentId: link.user.id } }),
    ]);
    // Başka kullanımı olmayan hesap kapatılır; pazaryerinde dersi olan hesaba dokunulmaz.
    if (!otherLinks && !bookings) await db.user.update({ where: { id: link.user.id }, data: { status: "SUSPENDED" } });
    await db.session.deleteMany({ where: { userId: link.user.id } });
  }
}
