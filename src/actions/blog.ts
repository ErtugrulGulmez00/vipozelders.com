"use server";

import { refresh, updateTag } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { slugify } from "@/lib/text";
import { actionUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { CACHE_TAGS } from "@/server/site";
import { deleteUpload, saveUpload, UploadError } from "@/server/storage";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

export async function saveBlogPostAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  const id = text(formData, "id");
  const title = text(formData, "title");
  const content = String(formData.get("content") ?? "").trim();
  if (title.length < 5) return failure("Başlık en az 5 karakter olmalı.", { title: "Başlık yazın." });
  if (content.length < 50) return failure("Yazı içeriği çok kısa.", { content: "İçerik yazın." });
  const slug = slugify(text(formData, "slug") || title).slice(0, 90);
  if (!slug) return failure("Adres üretilemedi; adres alanını doldurun.", { slug: "Adres yazın." });
  if (await db.blogPost.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) }, select: { id: true } })) return failure("Bu adres başka bir yazıda kullanılıyor.", { slug: "Kullanılıyor." });

  const existing = id ? await db.blogPost.findUnique({ where: { id } }) : null;
  if (id && !existing) return failure("Yazı bulunamadı.");
  const cover = formData.get("cover");
  let coverKey = existing?.coverKey ?? null;
  if (cover instanceof File && cover.size > 0) {
    try {
      coverKey = await saveUpload(cover, { visibility: "public", folder: "rehber", maxBytes: 4 * 1024 * 1024, kinds: ["image"] });
    } catch (error) {
      if (error instanceof UploadError) return failure(error.message, { cover: error.message });
      throw error;
    }
    if (existing?.coverKey) await deleteUpload(existing.coverKey);
  } else if (formData.get("removeCover") === "on" && existing?.coverKey) {
    await deleteUpload(existing.coverKey);
    coverKey = null;
  }

  const isPublished = formData.get("isPublished") === "on";
  const data = {
    title: title.slice(0, 160),
    slug,
    excerpt: text(formData, "excerpt").slice(0, 300) || null,
    content,
    category: text(formData, "category").slice(0, 40) || null,
    authorName: text(formData, "authorName").slice(0, 80) || null,
    coverKey,
    isPublished,
    // İlk yayına alındığı an korunur
    publishedAt: isPublished ? existing?.publishedAt ?? new Date() : existing?.publishedAt ?? null,
  };
  const post = existing ? await db.blogPost.update({ where: { id: existing.id }, data }) : await db.blogPost.create({ data });
  await db.auditLog.create({ data: { actorId: user.id, action: existing ? "blog.update" : "blog.create", entityType: "BlogPost", entityId: post.id } });
  updateTag(CACHE_TAGS.blog);
  refresh();
  return success(isPublished ? "Yazı kaydedildi ve yayında." : "Taslak kaydedildi.", { id: post.id });
}

export async function deleteBlogPostAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Bu işlem için yönetici yetkisi gerekli.");
  const post = await db.blogPost.findUnique({ where: { id: text(formData, "id") } });
  if (!post) return failure("Yazı bulunamadı.");
  await db.blogPost.delete({ where: { id: post.id } });
  if (post.coverKey) await deleteUpload(post.coverKey);
  await db.auditLog.create({ data: { actorId: user.id, action: "blog.delete", entityType: "BlogPost", entityId: post.id, details: { title: post.title } } });
  updateTag(CACHE_TAGS.blog);
  refresh();
  return success("Yazı silindi.");
}
