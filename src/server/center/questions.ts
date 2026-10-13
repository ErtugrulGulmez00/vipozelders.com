import { normalizeSearch } from "@/lib/text";
import { db } from "../db";
import { deleteUpload, saveUpload, UploadError } from "../storage";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Fotoğrafla soru: öğrenci (ya da velisi) sorunun fotoğrafını gönderir; kurum öğretmeni yazılı/fotoğraflı/videolu
// çözüm ekler ya da "yüz yüze anlatılacak" işaretler. Öğrenciye ve velisine bildirim gider.

const IMAGE_MAX = 8 * 1024 * 1024;
const VIDEO_MAX = 25 * 1024 * 1024;
const DAILY_LIMIT = 15;

async function upload(file: File, kinds: ("image" | "video")[], maxBytes: number) {
  try {
    return await saveUpload(file, { visibility: "private", folder: "soru", maxBytes, kinds });
  } catch (error) {
    if (error instanceof UploadError) throw new CenterError(error.message);
    throw error;
  }
}

/** Veli portalındaki bağlantı (öğrencinin kendi hesabı ya da velisi) üzerinden soru gönderir. */
export async function askQuestion(userId: string, guardianId: string, input: { subject: string; note: string | null; image: File | null }) {
  const link = await db.centerGuardian.findFirst({
    where: { id: guardianId, userId, student: { status: "ACTIVE", center: { status: { not: "SUSPENDED" } } } },
    include: { student: { select: { id: true, centerId: true, firstName: true, lastName: true, center: { select: { name: true } } } } },
  });
  if (!link) throw new CenterError("Öğrenci bulunamadı.");
  if (!input.image || input.image.size === 0) throw new CenterError("Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });
  const today = new Date(Date.now() - 24 * 3_600_000);
  const recent = await db.centerQuestion.count({ where: { studentId: link.student.id, createdAt: { gte: today } } });
  if (recent >= DAILY_LIMIT) throw new CenterError(`Bir günde en fazla ${DAILY_LIMIT} soru gönderilebilir.`);
  const imageKey = await upload(input.image, ["image"], IMAGE_MAX);
  const question = await db.centerQuestion.create({
    data: { centerId: link.student.centerId, studentId: link.student.id, askedByUserId: userId, subject: input.subject, note: input.note, imageKey },
  });
  // Branşı dersle eşleşen öğretmenlere; yoksa kurum yöneticilerine bildirim
  const members = await db.centerMember.findMany({ where: { centerId: link.student.centerId, isActive: true }, select: { userId: true, role: true, branch: true } });
  const subject = normalizeSearch(input.subject);
  const matching = members.filter((m) => m.role === "TEACHER" && m.branch && (normalizeSearch(m.branch).includes(subject) || subject.includes(normalizeSearch(m.branch))));
  const targets = matching.length ? matching : members.filter((m) => m.role === "OWNER" || m.role === "MANAGER");
  if (targets.length) {
    await db.notification.createMany({
      data: targets.map((m) => ({ userId: m.userId, type: "center.question", title: `Yeni soru: ${input.subject}`, body: `${link.student.firstName} ${link.student.lastName}${input.note ? ` · ${input.note.slice(0, 80)}` : ""}`, link: `/kurum/sorular/${question.id}` })),
    });
  }
  return question;
}

/** Soruyu soran kişi, henüz cevaplanmamışsa geri çekebilir. */
export async function withdrawQuestion(userId: string, questionId: string) {
  const question = await db.centerQuestion.findFirst({ where: { id: questionId, askedByUserId: userId, status: "OPEN" } });
  if (!question) throw new CenterError("Soru bulunamadı ya da cevaplanmış.");
  await db.centerQuestion.delete({ where: { id: questionId } });
  await deleteUpload(question.imageKey);
}

export async function getQuestionOrThrow(ctx: CenterContext, questionId: string) {
  const question = await db.centerQuestion.findFirst({ where: { id: questionId, centerId: ctx.center.id } });
  if (!question) throw new CenterError("Soru bulunamadı.");
  return question;
}

export type AnswerInput = { mode: "answer" | "in_person"; text: string | null; image: File | null; video: File | null };

/** Çözüm ekler (yazı, fotoğraf, video) ya da yüz yüze anlatılacağını bildirir; öğrenciye ve veliye bildirim gider. */
export async function answerQuestion(ctx: CenterContext, questionId: string, input: AnswerInput) {
  const question = await getQuestionOrThrow(ctx, questionId);
  const hasImage = Boolean(input.image && input.image.size);
  const hasVideo = Boolean(input.video && input.video.size);
  if (input.mode === "answer" && !input.text && !hasImage && !hasVideo) throw new CenterError("Çözüm için açıklama, fotoğraf ya da video ekleyin.");
  const answerImageKey = hasImage ? await upload(input.image!, ["image"], IMAGE_MAX) : undefined;
  const answerVideoKey = hasVideo ? await upload(input.video!, ["video"], VIDEO_MAX) : undefined;
  await db.centerQuestion.update({
    where: { id: questionId },
    data: {
      status: input.mode === "in_person" ? "IN_PERSON" : "ANSWERED",
      answerText: input.text,
      ...(answerImageKey ? { answerImageKey } : {}),
      ...(answerVideoKey ? { answerVideoKey } : {}),
      answeredById: ctx.member.id,
      answeredAt: new Date(),
    },
  });
  if (answerImageKey && question.answerImageKey) await deleteUpload(question.answerImageKey);
  if (answerVideoKey && question.answerVideoKey) await deleteUpload(question.answerVideoKey);
  const student = await db.centerStudent.findUniqueOrThrow({ where: { id: question.studentId }, select: { firstName: true } });
  await messageGuardians({
    centerId: ctx.center.id,
    centerName: ctx.center.name,
    studentId: question.studentId,
    kind: "question_answered",
    notification:
      input.mode === "in_person"
        ? { title: `${question.subject} sorusu yüz yüze anlatılacak`, body: input.text ?? `${student.firstName}, öğretmenin soruyu bir sonraki derste/etütte anlatacak.` }
        : { title: `${question.subject} sorunun çözümü hazır`, body: input.text?.slice(0, 160) ?? "Çözümü görmek için dokunun." },
  });
}
