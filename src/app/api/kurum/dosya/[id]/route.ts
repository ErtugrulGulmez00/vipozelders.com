import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { fileForDownload } from "@/server/center/files";
import { db } from "@/server/db";
import { optionalUser } from "@/server/mobile/auth";
import { readUpload } from "@/server/storage";

/** Kurum dosyasını indirir: kurum personeli ya da dosyanın paylaşıldığı öğrenci/veli. ?goster=1 tarayıcıda açar. */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/kurum/dosya/[id]">) {
  const { id } = await params;
  // Web oturumu (çerez) ya da mobil uygulamanın "Authorization: Bearer" anahtarı
  const user = (await getCurrentUser()) ?? (await optionalUser(request));
  if (!user) return new NextResponse("Giriş yapın", { status: 401 });
  const file = await fileForDownload(user.id, user.role, id);
  if (!file) return new NextResponse("Erişim yok", { status: 403 });
  const data = await readUpload(file.fileKey);
  if (!data) return new NextResponse("Bulunamadı", { status: 404 });
  await db.centerFile.update({ where: { id: file.id }, data: { downloads: { increment: 1 } } }).catch(() => undefined);
  const inline = request.nextUrl.searchParams.get("goster") === "1";
  const ascii = file.fileName.normalize("NFKD").replace(/[^\x20-\x7e]/g, "").replace(/["\\]/g, "") || "dosya";
  return new NextResponse(new Uint8Array(data.data), {
    headers: {
      "Content-Type": data.contentType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
