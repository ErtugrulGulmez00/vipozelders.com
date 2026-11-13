"use client";

import { submitInquiryAction } from "@/actions/teacher-inquiries";
import { ActionForm, FieldError, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { PhoneInput } from "@/components/ui/phone-input";

type Offering = { id: string; label: string };

/** Başarıdan sonra form gizlenir, yalnızca onay mesajı kalır. */
function Fields({ children }: { children: React.ReactNode }) {
  const result = useActionResult();
  return result.ok && result.message ? null : <>{children}</>;
}

/** Öğretmen profilinde "Ders talebi gönder": ödeme yok; öğretmen kabul edince veliyi arar. */
export function InquiryForm({
  teacherId,
  teacherFirstName,
  offerings,
  online,
  inPerson,
  defaults,
}: {
  teacherId: string;
  teacherFirstName: string;
  offerings: Offering[];
  online: boolean;
  inPerson: boolean;
  defaults: { name: string; phone: string };
}) {
  return (
    <ActionForm action={submitInquiryAction} className="space-y-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      <Fields>
        {offerings.length > 1 ? (
          <Field label="Ders">
            <Select name="offeringId" defaultValue={offerings[0]?.id}>
              {offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : offerings[0] ? (
          <input type="hidden" name="offeringId" value={offerings[0].id} />
        ) : null}
        {online && inPerson ? (
          <Field label="Ders şekli">
            <Select name="mode" defaultValue="farketmez">
              <option value="farketmez">Fark etmez</option>
              <option value="online">Online</option>
              <option value="yuz-yuze">Yüz yüze</option>
            </Select>
          </Field>
        ) : (
          <input type="hidden" name="mode" value={inPerson ? "yuz-yuze" : "online"} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Öğrencinin adı">
            <Input name="studentName" maxLength={80} placeholder="Deniz" />
          </Field>
          <Field label="Sınıfı">
            <Input name="gradeName" maxLength={40} placeholder="8. sınıf" />
          </Field>
        </div>
        <Field label="Uygun günler ve saatler">
          <Input name="preferredTimes" maxLength={200} placeholder="Hafta içi 18:00 sonrası, cumartesi sabah" />
        </Field>
        <Field label={`${teacherFirstName} öğretmene not`}>
          <Textarea name="note" rows={3} maxLength={1000} placeholder="LGS matematikte problemlerde zorlanıyor; haftada bir ders düşünüyoruz." />
        </Field>
        <Field label="Adınız soyadınız">
          <Input name="name" defaultValue={defaults.name} required maxLength={80} autoComplete="name" />
          <FieldError name="name" />
        </Field>
        <Field label="Telefonunuz" hint="Yalnızca öğretmen talebinizi kabul edince görür.">
          <PhoneInput name="phone" defaultValue={defaults.phone} required placeholder="05XX XXX XX XX" />
          <FieldError name="phone" />
        </Field>
        <Checkbox name="consent" required label="Talebimi kabul ederse telefon numaramın öğretmenle paylaşılmasını onaylıyorum." />
        <FieldError name="consent" />
        <SubmitButton className="w-full" pendingText="Gönderiliyor…">
          Ders talebi gönder
        </SubmitButton>
      </Fields>
    </ActionForm>
  );
}
