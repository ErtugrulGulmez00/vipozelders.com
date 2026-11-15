import "server-only";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, toLocalDateString } from "@/lib/dates";
import { centerAccess } from "@/lib/center/subscription";
import { CenterError } from "./center/errors";
import { db } from "./db";
import { kocPortalStudent, kocStudentOrThrow } from "./koc";

// Kitap okuma takibi (Pi Koç): koç ya da öğrenci kitap ekler, okuduğu sayfayı günceller, bitince işaretler.

export type ReadingInput = { title: string; author: string | null; totalPages: number | null; startedOn: string | null };

export type ReadingBook = {
  id: string;
  title: string;
  author: string | null;
  totalPages: number | null;
  pagesRead: number;
  startedOn: string | null;
  finishedOn: string | null;
  addedByStudent: boolean;
};

export async function readingBooks(centerId: string, studentId: string): Promise<ReadingBook[]> {
  const rows = await db.centerReadingBook.findMany({ where: { centerId, studentId }, orderBy: [{ finishedOn: { sort: "desc", nulls: "first" } }, { createdAt: "desc" }], take: 100 });
  return rows.map((b) => ({
    id: b.id,
    title: b.title,
    author: b.author,
    totalPages: b.totalPages,
    pagesRead: b.pagesRead,
    startedOn: b.startedOn ? dbDateToString(b.startedOn) : null,
    finishedOn: b.finishedOn ? dbDateToString(b.finishedOn) : null,
    addedByStudent: b.addedByStudent,
  }));
}

/** Özet: okunan (biten) kitap, bu ay biten, son 30 günde biten kitapların sayfası ve şu an okunanlar */
export function readingSummary(books: ReadingBook[], today = toLocalDateString(new Date())) {
  const month = today.slice(0, 7);
  const since = addDaysToDateString(today, -30);
  const finished = books.filter((b) => b.finishedOn);
  return {
    finished: finished.length,
    finishedThisMonth: finished.filter((b) => b.finishedOn!.startsWith(month)).length,
    pagesLast30: finished.filter((b) => b.finishedOn! >= since).reduce((t, b) => t + (b.totalPages ?? b.pagesRead), 0),
    reading: books.filter((b) => !b.finishedOn),
  };
}

function check(input: ReadingInput) {
  if (input.title.trim().length < 2) throw new CenterError("Kitabın adını yazın.", { title: "Kitap adı gerekli." });
  if (input.totalPages !== null && (input.totalPages < 1 || input.totalPages > 5000)) throw new CenterError("Sayfa sayısı 1-5000 arasında olmalı.", { totalPages: "Geçersiz sayfa sayısı." });
}

const data = (input: ReadingInput) => ({
  title: input.title.trim().slice(0, 160),
  author: input.author?.trim().slice(0, 120) || null,
  totalPages: input.totalPages,
  startedOn: input.startedOn ? dateStringToDbDate(input.startedOn) : dateStringToDbDate(toLocalDateString(new Date())),
});

async function update(bookId: string, studentId: string, pagesRead: number, finished: boolean) {
  const book = await db.centerReadingBook.findFirst({ where: { id: bookId, studentId } });
  if (!book) throw new CenterError("Kitap bulunamadı.");
  const max = book.totalPages ?? 100_000;
  const pages = Math.max(0, Math.min(max, pagesRead));
  const done = finished || (book.totalPages !== null && pages >= book.totalPages);
  await db.centerReadingBook.update({
    where: { id: bookId },
    data: { pagesRead: done && book.totalPages ? book.totalPages : pages, finishedOn: done ? (book.finishedOn ?? dateStringToDbDate(toLocalDateString(new Date()))) : null },
  });
}

// --- Koç ---

export async function addReadingBook(ctx: { center: { id: string } }, studentId: string, input: ReadingInput) {
  await kocStudentOrThrow(ctx, studentId);
  check(input);
  return db.centerReadingBook.create({ data: { centerId: ctx.center.id, studentId, ...data(input) } });
}

export async function updateReadingBook(ctx: { center: { id: string } }, studentId: string, bookId: string, pagesRead: number, finished: boolean) {
  await kocStudentOrThrow(ctx, studentId);
  await update(bookId, studentId, pagesRead, finished);
}

export async function deleteReadingBook(ctx: { center: { id: string } }, bookId: string) {
  await db.centerReadingBook.deleteMany({ where: { id: bookId, centerId: ctx.center.id } });
}

// --- Öğrenci (Koçum) ---

async function portalStudent(userId: string, studentId: string) {
  const student = await kocPortalStudent(userId, studentId);
  if (!student) throw new CenterError("Kayıt bulunamadı.");
  if (!centerAccess(student.center).writable) throw new CenterError("Koçunuzun aboneliği yenilenene kadar yeni kayıt girilemiyor.");
  return student;
}

export async function addPortalReadingBook(userId: string, studentId: string, input: ReadingInput) {
  const student = await portalStudent(userId, studentId);
  check(input);
  return db.centerReadingBook.create({ data: { centerId: student.centerId, studentId, ...data(input), addedByStudent: true } });
}

export async function updatePortalReadingBook(userId: string, studentId: string, bookId: string, pagesRead: number, finished: boolean) {
  await portalStudent(userId, studentId);
  await update(bookId, studentId, pagesRead, finished);
}

export async function deletePortalReadingBook(userId: string, studentId: string, bookId: string) {
  await portalStudent(userId, studentId);
  // Öğrenci yalnızca kendi eklediği kitabı siler
  await db.centerReadingBook.deleteMany({ where: { id: bookId, studentId, addedByStudent: true } });
}
