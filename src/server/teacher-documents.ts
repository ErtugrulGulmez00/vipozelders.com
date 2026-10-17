import type { DocumentType } from "@/generated/prisma/client";
import { DOCUMENT_TYPE_LABEL } from "@/lib/labels";
import { audit } from "./audit";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";
import { deleteUpload, saveUpload, UploadError } from "./storage";

// Öğretmen belgeleri (kimlik, diploma, adli sicil…): özel depolamada tutulur,
// yalnızca öğretmenin kendisi ve yöneticiler görebilir (/api/dosya/private/...).

export class DocumentError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_DOCUMENTS = 20;
/** Adli sicil kaydı en fazla bu kadar gün önce alınmış olmalı. */
export const CRIMINAL_RECORD_MAX_AGE_DAYS = 30;
const DAY = 86_400_000;

/** Adli sicil belgesinin tarihi ve e-Devlet barkodu: tarih geleceğe ait olamaz, son 30 gün içinde olmalı. */
export function checkCriminalRecord(input: { issuedAt: Date | null; barcode: string | null }, now = new Date()): string | null {
  if (!input.issuedAt || Number.isNaN(input.issuedAt.getTime())) return "Adli sicil kaydının alındığı tarihi girin.";
  if (input.issuedAt.getTime() > now.getTime() + DAY) return "Belge tarihi bugünden sonra olamaz.";
  if (now.getTime() - input.issuedAt.getTime() > CRIMINAL_RECORD_MAX_AGE_DAYS * DAY) {
    return `Adli sicil kaydı son ${CRIMINAL_RECORD_MAX_AGE_DAYS} gün içinde alınmış olmalı. e-Devlet'ten yeni bir belge alıp yükleyin.`;
  }
  if (!input.barcode || input.barcode.replace(/\s/g, "").length < 8) return "Belgenin üzerindeki e-Devlet barkod numarasını yazın.";
  return null;
}
export const DOCUMENT_TYPES = Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[];

export async function uploadTeacherDocument(
  teacherId: string,
  type: string,
  file: File | null,
  extra: { issuedAt?: Date | null; barcode?: string | null } = {},
  now = new Date(),
) {
  if (!DOCUMENT_TYPES.includes(type as DocumentType)) throw new DocumentError("Belge türünü seçin.");
  if (!file || file.size === 0) throw new DocumentError("Yüklenecek dosyayı seçin.");
  const issuedAt = extra.issuedAt ?? null;
  const barcode = extra.barcode?.trim().slice(0, 60) || null;
  if (type === "CRIMINAL_RECORD") {
    const problem = checkCriminalRecord({ issuedAt, barcode }, now);
    if (problem) throw new DocumentError(problem);
  }
  if ((await db.teacherDocument.count({ where: { teacherId } })) >= MAX_DOCUMENTS) {
    throw new DocumentError("En fazla 20 belge yükleyebilirsiniz; gereksiz olanları silin.");
  }
  let fileKey: string;
  try {
    fileKey = await saveUpload(file, { visibility: "private", folder: "belge", maxBytes: MAX_BYTES, kinds: ["image", "pdf"] });
  } catch (error) {
    if (error instanceof UploadError) throw new DocumentError(error.message);
    throw error;
  }
  const teacher = await db.user.findUniqueOrThrow({ where: { id: teacherId }, select: { firstName: true, lastName: true } });
  const document = await db.teacherDocument.create({
    data: { teacherId, type: type as DocumentType, fileKey, fileName: file.name.slice(0, 120) || "belge", issuedAt, barcode },
  });
  await notifyRole("ADMIN", {
    type: "teacher.document",
    title: "İncelenecek öğretmen belgesi",
    body: `${teacher.firstName} ${teacher.lastName}: ${DOCUMENT_TYPE_LABEL[type]}`,
    link: `/yonetim/ogretmenler/${teacherId}?bolum=belgeler`,
    email: false,
  });
  return document;
}

/** Öğretmen onaylanmamış belgesini silebilir; onaylı belgeler kayıt için saklanır. */
export async function deleteTeacherDocument(teacherId: string, documentId: string) {
  const document = await db.teacherDocument.findUnique({ where: { id: documentId } });
  if (!document || document.teacherId !== teacherId) throw new DocumentError("Belge bulunamadı.");
  if (document.status === "APPROVED") throw new DocumentError("Onaylanmış belge silinemez; değişiklik için yöneticiye yazın.");
  await db.teacherDocument.delete({ where: { id: documentId } });
  await deleteUpload(document.fileKey);
}

export async function reviewTeacherDocument(documentId: string, adminId: string, decision: "APPROVED" | "REJECTED", note: string, barcodeChecked = false) {
  const document = await db.teacherDocument.findUnique({ where: { id: documentId } });
  if (!document) throw new DocumentError("Belge bulunamadı.");
  if (decision === "REJECTED" && note.trim().length < 3) throw new DocumentError("Öğretmene iletilecek ret gerekçesini yazın.");
  if (decision === "APPROVED" && document.type === "CRIMINAL_RECORD") {
    // Belge yüklendiği anda son 30 gün içinde alınmış olmalı; barkod e-Devlet'te doğrulanmış olmalı.
    const problem = checkCriminalRecord({ issuedAt: document.issuedAt, barcode: document.barcode }, document.createdAt);
    if (problem) throw new DocumentError(`Onaylanamaz: ${problem}`);
    if (!barcodeChecked) throw new DocumentError("Onaylamadan önce barkodu e-Devlet belge doğrulama ekranında kontrol edip kutuyu işaretleyin.");
  }
  await db.teacherDocument.update({ where: { id: documentId }, data: { status: decision, note: note.trim().slice(0, 300) || null, reviewedAt: new Date() } });
  const label = DOCUMENT_TYPE_LABEL[document.type];
  await notify({
    userId: document.teacherId,
    type: "teacher.document_reviewed",
    title: decision === "APPROVED" ? `${label} belgeniz onaylandı` : `${label} belgeniz kabul edilmedi`,
    body: decision === "APPROVED" ? "Teşekkürler, belgeniz incelendi ve onaylandı." : `Gerekçe: ${note.trim()}. Lütfen düzeltilmiş belgeyi yeniden yükleyin.`,
    link: "/ogretmen-paneli/belgeler",
  });
  await audit({ actorId: adminId, action: `document.${decision === "APPROVED" ? "approved" : "rejected"}`, entityType: "TeacherDocument", entityId: documentId, details: { teacherId: document.teacherId, type: document.type } });
}
