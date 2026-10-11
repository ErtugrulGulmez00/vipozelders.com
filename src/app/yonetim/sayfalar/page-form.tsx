"use client";

import { useRouter } from "next/navigation";
import { savePageAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";

export function PageForm({ page }: { page?: { id: string; title: string; slug: string; content: string; showInFooter: boolean; isPublished: boolean; sortOrder: number } }) {
  const router = useRouter();
  return (
    <ActionForm
      action={async (state, formData) => {
        const result = await savePageAction(state, formData);
        if (result.ok && !page && result.data?.id) router.push(`/yonetim/sayfalar/${result.data.id}`);
        return result;
      }}
      className="space-y-4"
    >
      {page ? <input type="hidden" name="id" value={page.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_100px]">
        <Field label="Başlık">
          <Input name="title" defaultValue={page?.title} required />
        </Field>
        <Field label="Adres (slug)" hint="/sayfa/… · boşsa başlıktan üretilir">
          <Input name="slug" defaultValue={page?.slug} />
        </Field>
        <Field label="Sıra">
          <Input name="sortOrder" type="number" defaultValue={page?.sortOrder ?? 0} />
        </Field>
      </div>
      <Field
        label="İçerik"
        hint="Biçim: “## Başlık”, “- madde”, “> uyarı kutusu”, boş satırla yeni paragraf. {siteName}, {companyName}, {companyAddress}, {contactEmail}, {fullRefundHours}, {partialRefundPercent} gibi ifadeler site ayarlarıyla doldurulur."
      >
        <Textarea name="content" rows={24} defaultValue={page?.content} className="font-mono text-[13px]" required />
      </Field>
      <div className="flex flex-wrap gap-6">
        <Checkbox name="isPublished" defaultChecked={page?.isPublished ?? true} label="Yayında" />
        <Checkbox name="showInFooter" defaultChecked={page?.showInFooter ?? true} label="Alt bilgide (footer) göster" />
      </div>
      <SubmitButton size="lg">Kaydet</SubmitButton>
    </ActionForm>
  );
}
