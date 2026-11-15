import type { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { deleteUpload, readUpload, saveUpload, UploadError } from "../storage";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";

// Kurumun/koçun öğrencilere paylaştığı dosyalar. Dosya özel depoda durur; yalnızca kurum personeli ve
// dosyayı görebilen öğrenci ya da velisi indirir (/api/kurum/dosya/[id]).

export const CENTER_FILE_MAX_BYTES = 25 * 1024 * 1024;
const FOLDER = "kurum-dosya";

export type CenterFileInput = { file: File | null; title: string; subject: string | null; note: string | null; groupId: string | null; studentId: string | null };

export async function createCenterFile(ctx: CenterContext, input: CenterFileInput) {
  if (!(input.file instanceof File) || input.file.size === 0) throw new CenterError("Dosya seçin.", { file: "Dosya gerekli." });
  if (input.groupId && !(await db.centerGroup.findFirst({ where: { id: input.groupId, centerId: ctx.center.id }, select: { id: true } }))) throw new CenterError("Sınıf bulunamadı.");
  if (input.studentId && !(await db.centerStudent.findFirst({ where: { id: input.studentId, centerId: ctx.center.id }, select: { id: true } }))) throw new CenterError("Öğrenci bulunamadı.");
  let fileKey: string;
  try {
    fileKey = await saveUpload(input.file, { visibility: "private", folder: FOLDER, maxBytes: CENTER_FILE_MAX_BYTES, kinds: ["pdf", "office", "image"] });
  } catch (error) {
    if (error instanceof UploadError) throw new CenterError(error.message, { file: error.message });
    throw error;
  }
  const original = input.file.name.replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 150) || "dosya";
  const ext = fileKey.split(".").pop() ?? "";
  // Görsel küçültülünce uzantı değişebilir; indirilen dosyanın adı gerçek türle biter
  const fileName = original.toLowerCase().endsWith(`.${ext}`) ? original : `${original.replace(/\.[a-z0-9]{2,5}$/i, "")}.${ext}`;
  return db.centerFile.create({
    data: {
      centerId: ctx.center.id,
      title: input.title,
      subject: input.subject,
      note: input.note,
      groupId: input.groupId,
      studentId: input.groupId ? null : input.studentId,
      fileKey,
      fileName,
      size: (await readUpload(fileKey))?.data.length ?? input.file.size,
    },
  });
}

export async function deleteCenterFile(ctx: CenterContext, fileId: string) {
  const file = await db.centerFile.findFirst({ where: { id: fileId, centerId: ctx.center.id } });
  if (!file) throw new CenterError("Dosya bulunamadı.");
  await db.centerFile.delete({ where: { id: file.id } });
  await deleteUpload(file.fileKey);
}

export async function listCenterFiles(centerId: string) {
  return db.centerFile.findMany({
    where: { centerId },
    include: { group: { select: { name: true } }, student: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Öğrencinin görebileceği dosyalar: herkese açık, sınıfına ya da kendisine paylaşılanlar. */
function visibleTo(student: { id: string; centerId: string; groupIds: string[] }): Prisma.CenterFileWhereInput {
  return {
    centerId: student.centerId,
    OR: [{ groupId: null, studentId: null }, ...(student.groupIds.length ? [{ groupId: { in: student.groupIds } }] : []), { studentId: student.id }],
  };
}

export async function filesForStudent(studentId: string) {
  const student = await db.centerStudent.findUnique({ where: { id: studentId }, select: { id: true, centerId: true, groups: { select: { groupId: true } } } });
  if (!student) return [];
  return db.centerFile.findMany({
    where: visibleTo({ id: student.id, centerId: student.centerId, groupIds: student.groups.map((g) => g.groupId) }),
    select: { id: true, title: true, subject: true, note: true, fileName: true, size: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

/** İndirme yetkisi: kurumun aktif personeli ya da dosyayı görebilen öğrencinin bağlı hesabı (öğrenci/veli). */
export async function fileForDownload(userId: string, role: string, fileId: string) {
  const file = await db.centerFile.findUnique({ where: { id: fileId } });
  if (!file) return null;
  if (role === "ADMIN") return file;
  const member = await db.centerMember.findFirst({ where: { centerId: file.centerId, userId, isActive: true }, select: { id: true } });
  if (member) return file;
  const links = await db.centerGuardian.findMany({
    where: { userId, student: { centerId: file.centerId, status: "ACTIVE", center: { status: { not: "SUSPENDED" } } } },
    select: { student: { select: { id: true, groups: { select: { groupId: true } } } } },
  });
  const allowed = links.some(({ student }) => (!file.groupId && !file.studentId) || file.studentId === student.id || (file.groupId !== null && student.groups.some((g) => g.groupId === file.groupId)));
  return allowed ? file : null;
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}
