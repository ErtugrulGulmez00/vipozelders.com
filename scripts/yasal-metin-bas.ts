// prisma/legal-pages.ts içeriğini sayfalara basar (yalnızca değişenler). Sonra yeniden derleme gerekir ("use cache").
// Kullanım: npx tsx --conditions=react-server --env-file=.env scripts/yasal-metin-bas.ts [--uygula]
import { LEGAL_PAGES } from "../prisma/legal-pages";
import { db } from "../src/server/db";

const apply = process.argv.includes("--uygula");
for (const page of LEGAL_PAGES) {
  const row = await db.page.findUnique({ where: { slug: page.slug }, select: { content: true } });
  if (!row || row.content === page.content) continue;
  console.log(apply ? "güncellendi:" : "güncellenir:", page.slug);
  if (apply) await db.page.update({ where: { slug: page.slug }, data: { content: page.content } });
}
await db.$disconnect();
