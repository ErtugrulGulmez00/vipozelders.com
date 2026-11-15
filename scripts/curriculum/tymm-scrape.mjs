// MEB TYMM (tymm.meb.gov.tr) öğretim programlarından ders → sınıf → tema → "İçerik Çerçevesi" çıkarır.
// Yavaş tempoda (istek başına ~0,7 sn) yalnızca herkese açık sayfaları okur. Çıktı: JSON.
import { writeFileSync } from "node:fs";

const BASE = "https://tymm.meb.gov.tr";
const out = process.argv[2];
const COURSES = process.argv.slice(3);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(path) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(BASE + path, { headers: { "User-Agent": "Mozilla/5.0 (PiKampus mufredat okuyucu)" } });
      if (res.ok) {
        await sleep(700);
        return await res.text();
      }
    } catch {}
    await sleep(2000);
  }
  throw new Error("alınamadı " + path);
}

const decode = (s) =>
  s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
    .replace(/[ \t]+/g, " ")
    .trim();

function section(html, title) {
  const re = new RegExp(`<div class="col-md-3[^"]*title">\\s*${title}\\s*</div>\\s*<div class="col-md-9[^"]*content">([\\s\\S]*?)</div>\\s*</div>`);
  const m = re.exec(html);
  return m ? decode(m[1]) : null;
}

const result = {};
for (const course of COURSES) {
  const page = await get(`/ogretim-programlari/ders/${course}`);
  const gradeLinks = [...new Set([...page.matchAll(new RegExp(`href="(/ogretim-programlari/${course}/\\d+)"[^>]*>([\\s\\S]*?)</a>`, "g"))].map((m) => `${m[1]}|${decode(m[2])}`))];
  result[course] = [];
  for (const entry of gradeLinks) {
    const [link, label] = entry.split("|");
    const gradePage = await get(link);
    const units = [...new Set([...gradePage.matchAll(new RegExp(`href="(/${course}/unite/\\d+)"[^>]*>([\\s\\S]*?)</a>`, "g"))].map((m) => `${m[1]}|${decode(m[2])}`))];
    const grade = { label, link, units: [] };
    for (const u of units) {
      const [ulink, uname] = u.split("|");
      const html = await get(ulink);
      grade.units.push({ name: uname, link: ulink, content: section(html, "İçerik Çerçevesi") });
    }
    result[course].push(grade);
    console.log(course, label, grade.units.length, "ünite");
  }
}
writeFileSync(out, JSON.stringify(result, null, 1));
console.log("yazıldı", out);
