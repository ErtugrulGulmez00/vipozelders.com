import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { optionalUser } from "@/server/mobile/auth";
import { readUpload } from "@/server/storage";

/** Belgeyi sahibi öğretmen ve yönetici; kurum soru/çözüm dosyasını kurum personeli ve öğrenciye bağlı hesaplar görür. */
async function canReadPrivate(user: { id: string; role: string }, key: string): Promise<boolean> {
  if (user.role === "ADMIN") return true;
  const document = await db.teacherDocument.findFirst({ where: { fileKey: key }, select: { teacherId: true } });
  if (document) return document.teacherId === user.id;
  // Fotoğrafla soru (pazaryeri): yalnızca o sorunun öğrencisi ve öğretmeni
  const message = await db.bookingMessage.findFirst({
    where: { OR: [{ imageKey: key }, { videoKey: key }] },
    select: { booking: { select: { studentId: true, teacherId: true } } },
  });
  if (message) return message.booking.studentId === user.id || message.booking.teacherId === user.id;
  const question = await db.centerQuestion.findFirst({
    where: { OR: [{ imageKey: key }, { answerImageKey: key }, { answerVideoKey: key }] },
    select: { centerId: true, studentId: true },
  });
  if (!question) return false;
  const [member, guardian] = await Promise.all([
    db.centerMember.findFirst({ where: { centerId: question.centerId, userId: user.id, isActive: true }, select: { id: true } }),
    db.centerGuardian.findFirst({ where: { studentId: question.studentId, userId: user.id }, select: { id: true } }),
  ]);
  return Boolean(member || guardian);
}

/** Yüklenen dosyaları sunar. Özel (private/) dosyaları yalnızca sahibi ve yöneticiler görebilir. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/dosya/[...key]">) {
  const key = (await params).key.join("/");
  if (key.startsWith("private/")) {
    // Web oturumu (çerez) ya da mobil uygulamanın "Authorization: Bearer" anahtarı
    const user = (await getCurrentUser()) ?? (await optionalUser(request));
    if (!user || !(await canReadPrivate(user, key))) return new NextResponse("Erişim yok", { status: 403 });
  }
  const file = await readUpload(key);
  if (!file) return new NextResponse("Bulunamadı", { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": key.startsWith("public/") ? "public, max-age=31536000, immutable" : "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
