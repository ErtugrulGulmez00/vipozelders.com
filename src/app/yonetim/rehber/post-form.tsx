"use client";

import { useRouter } from "next/navigation";
import { deleteBlogPostAction, saveBlogPostAction } from "@/actions/blog";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";

type Post = { id: string; title: string; slug: string; excerpt: string | null; content: string; category: string | null; authorName: string | null; coverKey: string | null; isPublished: boolean };

export function PostForm({ post }: { post?: Post }) {
  const router = useRouter();
  return (
    <div className="space-y-6">
      <ActionForm
        action={async (state, formData) => {
          const result = await saveBlogPostAction(state, formData);
          if (result.ok && !post && result.data?.id) router.push(`/yonetim/rehber/${result.data.id}`);
          return result;
        }}
        className="space-y-4"
      >
        {post ? <input type="hidden" name="id" value={post.id} /> : null}
        <Field label="Başlık" hint="Google'da görünen başlık; velinin arayacağı kelimeleri içersin (ör. “LGS'ye kaç ay kala özel ders alınmalı?”).">
          <Input name="title" defaultValue={post?.title} required maxLength={160} />
          <FieldError name="title" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Adres (slug)" hint="/rehber/… · boşsa başlıktan üretilir">
            <Input name="slug" defaultValue={post?.slug} />
            <FieldError name="slug" />
          </Field>
          <Field label="Kategori" hint="Ör: LGS, YKS, Veli rehberi">
            <Input name="category" defaultValue={post?.category ?? ""} maxLength={40} />
          </Field>
          <Field label="Yazar">
            <Input name="authorName" defaultValue={post?.authorName ?? ""} maxLength={80} placeholder="Pi Kampüs Rehber" />
          </Field>
        </div>
        <Field label="Kısa özet" hint="Listede ve Google sonuçlarında görünür (en fazla 300 karakter).">
          <Textarea name="excerpt" rows={2} maxLength={300} defaultValue={post?.excerpt ?? ""} />
        </Field>
        <Field label="Kapak görseli (isteğe bağlı)" hint="JPG/PNG/WebP, en fazla 4 MB.">
          <FileInput name="cover" accept="image/*" placeholder={post?.coverKey ? "Yeni görsel seç (mevcut korunur)" : "Görsel seç"} />
          <FieldError name="cover" />
        </Field>
        {post?.coverKey ? <Checkbox name="removeCover" label="Kapak görselini kaldır" /> : null}
        <Field label="İçerik" hint="Biçim: “## Ara başlık”, “- madde”, “> bilgi kutusu”, boş satırla yeni paragraf.">
          <Textarea name="content" rows={24} defaultValue={post?.content} className="font-mono text-[13px]" required />
          <FieldError name="content" />
        </Field>
        <Checkbox name="isPublished" defaultChecked={post?.isPublished ?? false} label="Yayında" />
        <SubmitButton size="lg">Kaydet</SubmitButton>
      </ActionForm>
      {post ? (
        <ActionForm
          action={async (state, formData) => {
            const result = await deleteBlogPostAction(state, formData);
            if (result.ok) router.push("/yonetim/rehber");
            return result;
          }}
        >
          <input type="hidden" name="id" value={post.id} />
          <SubmitButton variant="danger" size="sm" confirmMessage="Yazı kalıcı olarak silinsin mi?">
            Yazıyı sil
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
