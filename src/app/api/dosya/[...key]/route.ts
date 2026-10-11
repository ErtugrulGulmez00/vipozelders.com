import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { readUpload } from "@/server/storage";

/** Yüklenen dosyaları sunar. Özel (private/) dosyaları yalnızca sahibi ve yöneticiler görebilir. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/dosya/[...key]">) {
  const key = (await params).key.join("/");
  if (key.startsWith("private/")) {
    const user = await getCurrentUser();
    const document = await db.teacherDocument.findFirst({ where: { fileKey: key }, select: { teacherId: true } });
    if (!user || !document || (user.role !== "ADMIN" && user.id !== document.teacherId)) {
      return new NextResponse("Erişim yok", { status: 403 });
    }
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
