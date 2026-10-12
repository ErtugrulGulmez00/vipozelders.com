import { CENTER_ROLE_LABEL, type CenterRoleName } from "@/lib/center/permissions";
import { generateUsername } from "../accounts";
import { generateTemporaryPassword, hashPassword } from "../auth/password";
import { issueUserToken } from "../auth/tokens";
import { db } from "../db";
import { renderEmail } from "../email";
import { loadSettings } from "../settings";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";

// Kurum personeli: hesap açma (geçici şifre + şifre belirleme bağlantısı), rol, görev, pasife alma.

export type StaffInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  role: CenterRoleName;
  title: string | null;
  branch: string | null;
};

async function queueWelcomeEmail(userId: string, email: string, firstName: string, centerName: string, username: string, role: CenterRoleName) {
  const settings = await loadSettings();
  const token = await issueUserToken(userId, "PASSWORD_RESET", 3 * 24 * 60 * 60 * 1000);
  const { html, text } = renderEmail({
    siteName: settings.siteName,
    greetingName: firstName,
    title: `${centerName} kurum paneline davet edildiniz`,
    lines: [
      `${centerName} sizi ${settings.siteName} kurum paneline “${CENTER_ROLE_LABEL[role]}” olarak ekledi.`,
      `Kullanıcı adınız: ${username}`,
      "Aşağıdaki bağlantıdan şifrenizi belirleyip giriş yapabilirsiniz (bağlantı 3 gün geçerlidir). Kurumunuz size geçici bir şifre de iletmiş olabilir.",
    ],
    action: { label: "Şifremi belirle", url: `/sifre-sifirla/${token}` },
  });
  await db.emailMessage.create({ data: { userId, to: email, subject: `Kurum paneli daveti · ${centerName}`, html, text } });
}

/** Yeni personel hesabı açar ya da e-postası kayıtlı kurum/öğretmen hesabını kuruma ekler. */
export async function createCenterUser(centerId: string, centerName: string, input: StaffInput) {
  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== "CENTER" && existing.role !== "TEACHER") throw new CenterError("Bu e-posta bir veli/öğrenci ya da yönetici hesabında kayıtlı; farklı bir e-posta kullanın.", { email: "E-posta kullanımda." });
      if (await db.centerMember.findUnique({ where: { centerId_userId: { centerId, userId: existing.id } } })) throw new CenterError("Bu kişi zaten kurum personeli.", { email: "Zaten ekli." });
      const member = await db.centerMember.create({ data: { centerId, userId: existing.id, role: input.role, title: input.title, branch: input.branch } });
      await db.notification.create({ data: { userId: existing.id, type: "center.staff", title: `${centerName} sizi kurum paneline ekledi`, body: `Rolünüz: ${CENTER_ROLE_LABEL[input.role]}`, link: "/kurum" } });
      return { member, username: existing.username, temporaryPassword: null, linkedExisting: true };
    }
  }
  const username = await generateUsername(input.firstName, input.lastName);
  const temporaryPassword = generateTemporaryPassword();
  const user = await db.user.create({
    data: {
      role: "CENTER",
      email,
      username,
      phone: input.phone,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash: await hashPassword(temporaryPassword),
      mustChangePassword: true,
      centerMemberships: { create: { centerId, role: input.role, title: input.title, branch: input.branch } },
    },
    include: { centerMemberships: true },
  });
  if (email) await queueWelcomeEmail(user.id, email, user.firstName, centerName, username, input.role);
  return { member: user.centerMemberships[0], username, temporaryPassword, linkedExisting: false };
}

export async function addStaff(ctx: CenterContext, input: StaffInput) {
  if (input.role === "OWNER" && ctx.member.role !== "OWNER") throw new CenterError("Kurum sahibi rolünü yalnızca kurum sahibi verebilir.");
  return createCenterUser(ctx.center.id, ctx.center.name, input);
}

async function getMemberOrThrow(ctx: CenterContext, memberId: string) {
  const member = await db.centerMember.findFirst({ where: { id: memberId, centerId: ctx.center.id }, include: { user: true } });
  if (!member) throw new CenterError("Personel bulunamadı.");
  if (member.role === "OWNER" && ctx.member.role !== "OWNER") throw new CenterError("Kurum sahibinin bilgilerini yalnızca kurum sahibi değiştirebilir.");
  return member;
}

async function assertAnotherOwner(centerId: string, memberId: string) {
  const owners = await db.centerMember.count({ where: { centerId, role: "OWNER", isActive: true, id: { not: memberId } } });
  if (!owners) throw new CenterError("Kurumda en az bir aktif kurum sahibi kalmalı.");
}

export async function updateStaff(ctx: CenterContext, memberId: string, input: { role: CenterRoleName; title: string | null; branch: string | null; isActive: boolean }) {
  const member = await getMemberOrThrow(ctx, memberId);
  if (input.role === "OWNER" && ctx.member.role !== "OWNER") throw new CenterError("Kurum sahibi rolünü yalnızca kurum sahibi verebilir.");
  if (member.role === "OWNER" && (input.role !== "OWNER" || !input.isActive)) await assertAnotherOwner(ctx.center.id, memberId);
  if (member.id === ctx.member.id && !input.isActive) throw new CenterError("Kendi hesabınızı pasife alamazsınız.");
  await db.centerMember.update({ where: { id: memberId }, data: input });
}

/** Yalnızca kurum hesapları için: yeni geçici şifre, diğer oturumlar kapanır. */
export async function resetStaffPassword(ctx: CenterContext, memberId: string) {
  const member = await getMemberOrThrow(ctx, memberId);
  if (member.user.role !== "CENTER") throw new CenterError("Bu kişi sitenin öğretmen hesabını kullanıyor; şifresini kendisi “Şifremi unuttum” ile yenileyebilir.");
  const others = await db.centerMember.count({ where: { userId: member.userId, centerId: { not: ctx.center.id }, isActive: true } });
  if (others) throw new CenterError("Bu hesap başka bir kurumda da kullanılıyor; şifresini kendisi “Şifremi unuttum” ile yenilemeli.");
  const temporaryPassword = generateTemporaryPassword();
  await db.user.update({ where: { id: member.userId }, data: { passwordHash: await hashPassword(temporaryPassword), mustChangePassword: true } });
  await db.session.deleteMany({ where: { userId: member.userId } });
  return { username: member.user.username, temporaryPassword };
}
