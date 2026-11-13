/**
 * Yönlendirme adresi: ters vekil (Caddy) arkasında request.url iç adrestir (http://localhost:3000); tarayıcının geldiği
 * adres Host ve X-Forwarded-Proto başlıklarından kurulur (kurum.<alan adı> gibi alt adresler korunur).
 */
export function publicUrl(path: string, request: { url: string; headers: Headers }): URL {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || new URL(request.url).protocol.replace(":", "");
  return new URL(path, host ? `${proto}://${host}` : request.url);
}
