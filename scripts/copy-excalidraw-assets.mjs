// Beyaz tahtanın yazı tiplerini public/excalidraw altına kopyalar (npm install sonrası otomatik çalışır).
// Çince yazı tipi (Xiaolai, 13 MB) kopyalanmaz; gerekirse tarayıcı CDN'den indirir.
import fs from "node:fs";
import path from "node:path";

const source = path.resolve("node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const target = path.resolve("public/excalidraw/fonts");

if (!fs.existsSync(source)) {
  console.log("Excalidraw yazı tipleri bulunamadı, atlandı.");
  process.exit(0);
}
fs.rmSync(target, { recursive: true, force: true });
fs.mkdirSync(target, { recursive: true });
for (const entry of fs.readdirSync(source)) {
  if (entry === "Xiaolai") continue;
  fs.cpSync(path.join(source, entry), path.join(target, entry), { recursive: true });
}
console.log("Beyaz tahta yazı tipleri public/excalidraw/fonts altına kopyalandı.");
