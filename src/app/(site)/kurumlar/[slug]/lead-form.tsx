"use client";

import Link from "next/link";
import { submitLeadAction } from "@/actions/center-public";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { GRADE_OPTIONS } from "@/lib/center/labels";

export function LeadForm({ slug }: { slug: string }) {
  return (
    <ActionForm action={submitLeadAction} resetOnSuccess className="space-y-4">
      <input type="hidden" name="slug" value={slug} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <Field label="Öğrencinin adı soyadı" htmlFor="l-student">
        <Input id="l-student" name="studentName" required />
        <FieldError name="studentName" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Sınıfı" htmlFor="l-grade">
          <Select id="l-grade" name="gradeName" defaultValue="">
            <option value="">Seçin</option>
            {GRADE_OPTIONS.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </Select>
        </Field>
        <Field label="Veli adı soyadı" htmlFor="l-parent">
          <Input id="l-parent" name="parentName" autoComplete="name" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cep telefonu" htmlFor="l-phone">
          <Input id="l-phone" name="phone" type="tel" autoComplete="tel" placeholder="05XX XXX XX XX" required />
          <FieldError name="phone" />
        </Field>
        <Field label="E-posta (isteğe bağlı)" htmlFor="l-email">
          <Input id="l-email" name="email" type="email" autoComplete="email" />
          <FieldError name="email" />
        </Field>
      </div>
      <Field label="Mesajınız" htmlFor="l-message">
        <Textarea id="l-message" name="message" rows={3} maxLength={1000} placeholder="Hangi program ilginizi çekiyor? Size ne zaman ulaşalım?" />
      </Field>
      <div>
        <Checkbox
          name="kvkk"
          required
          label={
            <>
              Kurumun benimle iletişime geçmesi için bilgilerimin paylaşılmasını onaylıyorum (
              <Link href="/sayfa/kvkk-aydinlatma-metni" target="_blank" className="font-medium text-brand-700 underline">
                KVKK
              </Link>
              ).
            </>
          }
        />
        <FieldError name="kvkk" />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Gönderiliyor…">
        Ön kayıt / bilgi iste
      </SubmitButton>
    </ActionForm>
  );
}
