import { connection } from "next/server";
import { MOBILE_APP_PACKAGE } from "@/lib/mobile-app";

/**
 * Android App Links doğrulaması: sitenin davet, ders ve öğretmen bağlantıları Pi Kampüs uygulamasında açılır.
 * ANDROID_APP_SHA256 = uygulama imza sertifikalarının SHA-256 parmak izleri (virgülle); ayarlı değilse 404.
 */
export async function GET() {
  await connection();
  const fingerprints = (process.env.ANDROID_APP_SHA256 ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);
  if (fingerprints.length === 0) return new Response("Not found", { status: 404 });
  return Response.json(
    [{ relation: ["delegate_permission/common.handle_all_urls"], target: { namespace: "android_app", package_name: MOBILE_APP_PACKAGE, sha256_cert_fingerprints: fingerprints } }],
    { headers: { "Cache-Control": "public, max-age=3600" } },
  );
}
