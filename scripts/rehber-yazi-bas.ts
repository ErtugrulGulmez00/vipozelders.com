// prisma/blog-posts.ts'teki rehber yazılarını ekler ya da günceller (yalnızca değişenler). Sonra yeniden derleme gerekir.
// Kullanım: npx tsx --conditions=react-server --env-file=.env scripts/rehber-yazi-bas.ts [--uygula]
import { BLOG_POSTS } from "../prisma/blog-posts";
import { db } from "../src/server/db";

const apply = process.argv.includes("--uygula");
for (const post of BLOG_POSTS) {
  const row = await db.blogPost.findUnique({ where: { slug: post.slug }, select: { title: true, excerpt: true, content: true, category: true } });
  if (row && row.title === post.title && row.excerpt === post.excerpt && row.content === post.content && row.category === post.category) continue;
  console.log(row ? "güncellenir:" : "eklenir:", post.slug);
  if (!apply) continue;
  await db.blogPost.upsert({
    where: { slug: post.slug },
    create: { ...post, authorName: "Pi Kampüs Rehber", isPublished: true, publishedAt: new Date() },
    update: { title: post.title, excerpt: post.excerpt, content: post.content, category: post.category },
  });
}
await db.$disconnect();
