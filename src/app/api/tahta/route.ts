import { NextResponse } from "next/server";
import { getCurrentUser } from "@/server/auth/current-user";
import { countRecentAttempts, recordLoginAttempt } from "@/server/auth/rate-limit";
import { isValidStorageKey, readUpload, saveUpload, UploadError } from "@/server/storage";

// Beyaz tahtaya eklenen görseller (fotoğraf ya da PDF sayfası; PDF tarayıcıda sayfa sayfa görsele çevrilir).
// Görüntülü derste karşı taraf aynı görseli buradan çeker. Anahtar tahmin edilemez; okumak için oturum gerekir.

const FOLDER = "tahta";
/** Kullanıcı başına saatte en fazla yükleme (PDF sayfaları dahil) */
const MAX_UPLOADS_PER_HOUR = 200;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const key = `tahta:${user.id}`;
  if ((await countRecentAttempts(key, 60 * 60 * 1000)) >= MAX_UPLOADS_PER_HOUR) return NextResponse.json({ error: "Çok fazla dosya yüklendi; biraz sonra tekrar deneyin." }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Dosya seçin." }, { status: 400 });
  try {
    const stored = await saveUpload(file, { visibility: "private", folder: FOLDER, maxBytes: 4 * 1024 * 1024, kinds: ["image"], maxSide: 2000 });
    await recordLoginAttempt(key, null, false);
    return NextResponse.json({ key: stored });
  } catch (error) {
    if (error instanceof UploadError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse(null, { status: 401 });
  const key = new URL(request.url).searchParams.get("k") ?? "";
  if (!key.startsWith(`private/${FOLDER}/`) || !isValidStorageKey(key)) return new NextResponse(null, { status: 404 });
  const file = await readUpload(key);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), { headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=86400" } });
}
