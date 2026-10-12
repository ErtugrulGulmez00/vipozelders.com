import type { NextRequest } from "next/server";

/**
 * PayTR ödeme formundan dönüş (merchant_ok_url / merchant_fail_url). Bu adres ödemeyi onaylamaz;
 * sonuç bildirimle gelir. Form iframe içinde olduğu için sayfa üst pencereyi sonuç sayfasına taşır.
 */
function breakout(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get("b") ?? "";
  const target = /^[a-z0-9]{10,40}$/i.test(bookingId) ? `/odeme/sonuc/${bookingId}` : "/hesabim/derslerim";
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>Yönlendiriliyor…</title></head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:48px 16px;color:#334155">
<p>Ödeme sonucunuz açılıyor…</p><p><a href="${target}" target="_top">Açılmazsa buraya dokunun</a></p>
<script>try{window.top.location.replace(${JSON.stringify(target)})}catch(e){window.location.replace(${JSON.stringify(target)})}</script>
</body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

export const GET = breakout;
export const POST = breakout;
