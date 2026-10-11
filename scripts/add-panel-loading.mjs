// Panel sayfalarının her klasörüne iskelet yükleme ekranı ekler (anında sayfa geçişi için).
import fs from "node:fs";
import path from "node:path";

const roots = ["src/app/hesabim", "src/app/ogretmen-paneli", "src/app/yonetim"];
const content = 'import { PanelLoading } from "@/components/panel/panel-loading";\n\nexport default function Loading() {\n  return <PanelLoading />;\n}\n';
let added = 0;
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) walk(path.join(dir, entry.name));
  }
  if (fs.existsSync(path.join(dir, "page.tsx")) && !fs.existsSync(path.join(dir, "loading.tsx"))) {
    fs.writeFileSync(path.join(dir, "loading.tsx"), content);
    added++;
  }
}
for (const root of roots) if (fs.existsSync(root)) walk(root);
console.log(`${added} loading.tsx eklendi`);
