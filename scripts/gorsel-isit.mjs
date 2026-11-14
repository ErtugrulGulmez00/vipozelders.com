// Canlıya almadan sonra görsel önbelleğini ısıtır: site haritasındaki sayfalarda geçen bütün optimize görsel
// adreslerini (her genişlik) bir kez ister. Böylece ilk ziyaretçi görselin hazırlanmasını (~1 sn) beklemez.
// Kullanım: node scripts/gorsel-isit.mjs [https://pikampus.com]
const base = (process.argv[2] ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

async function text(url) {
  const res = await fetch(url, { headers: { "User-Agent": "pikampus-gorsel-isitma" } });
  return res.ok ? res.text() : "";
}

const sitemap = await text(`${base}/sitemap.xml`);
const pages = new Set(["/"]);
for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
  try {
    pages.add(new URL(m[1]).pathname);
  } catch {}
}

const images = new Set();
for (const path of pages) {
  const html = await text(base + path);
  for (const m of html.matchAll(/\/_next\/image\?[^"'\s,]+/g)) images.add(m[0].replace(/&amp;/g, "&"));
}

let done = 0;
let slow = 0;
const queue = [...images];
async function worker() {
  while (queue.length) {
    const url = queue.shift();
    const t = Date.now();
    await fetch(base + url, { headers: { Accept: "image/avif,image/webp,*/*" } })
      .then((r) => r.arrayBuffer())
      .catch(() => null);
    if (Date.now() - t > 500) slow++;
    done++;
  }
}
await Promise.all(Array.from({ length: 3 }, worker));
console.log(`${pages.size} sayfa, ${done} görsel adresi istendi (${slow} tanesi yeni hazırlandı)`);
