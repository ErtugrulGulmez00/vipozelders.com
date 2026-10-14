"use client";

import Link from "next/link";
import { useState } from "react";
import { createQuestionBookingAction } from "@/actions/question-bookings";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

/** Fotoğrafla soru: fotoğraf + not + öğrenci bilgisi, ardından ödeme. */
export function QuestionForm({
  offeringId,
  learners,
  defaultName,
  grades,
}: {
  offeringId: string;
  learners: { name: string; gradeName: string | null }[];
  defaultName: string;
  grades: string[];
}) {
  const [learnerName, setLearnerName] = useState(learners[0]?.name ?? "");
  const [grade, setGrade] = useState(learners[0]?.gradeName ?? "");
  return (
    <ActionForm action={createQuestionBookingAction} className="space-y-5">
      <input type="hidden" name="offeringId" value={offeringId} />
      <Field label="Sorunun fotoğrafı" hint="Telefonda kamerayı açar. Soruyu şıklarıyla birlikte net ve tam çekin.">
        <FileInput name="image" accept="image/*" capture="environment" placeholder="Fotoğraf çek / seç" required />
        <FieldError name="image" />
      </Field>
      <Field label="Not (isteğe bağlı)" htmlFor="note" hint="Nerede takıldığınızı yazarsanız öğretmen çözümü ona göre anlatır.">
        <Textarea id="note" name="note" rows={3} maxLength={1000} placeholder="Örn: İkinci adımdan sonra nasıl devam edeceğimi bulamadım." />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Öğrencinin adı" htmlFor="learnerName" hint={learners.length ? undefined : `Kendiniz için gönderiyorsanız “${defaultName}” yazabilirsiniz.`}>
          <Input id="learnerName" name="learnerName" value={learnerName} onChange={(e) => setLearnerName(e.target.value)} list="learner-names" required />
          <datalist id="learner-names">
            {learners.map((l) => (
              <option key={l.name} value={l.name} />
            ))}
          </datalist>
        </Field>
        <Field label="Sınıfı" htmlFor="learnerGrade">
          <Select id="learnerGrade" name="learnerGrade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="">Seçiniz</option>
            {[...new Set([...grades, ...(grade && !grades.includes(grade) ? [grade] : [])])].filter((g) => g !== "Diğer").map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
            <option value="Diğer">Diğer</option>
          </Select>
        </Field>
      </div>
      <FieldError name="learnerName" />
      <div className="rounded-xl border border-slate-200 p-4">
        <Checkbox
          name="consent"
          required
          label={
            <>
              <Link href="/sayfa/on-bilgilendirme-formu" target="_blank" className="font-medium text-brand-700 underline">
                Ön Bilgilendirme Formu
              </Link>{" "}
              ile{" "}
              <Link href="/sayfa/mesafeli-satis-sozlesmesi" target="_blank" className="font-medium text-brand-700 underline">
                Mesafeli Satış Sözleşmesi
              </Link>
              ’ni okudum ve onaylıyorum.
            </>
          }
        />
        <FieldError name="consent" />
      </div>
      <SubmitButton size="lg" className="w-full" pendingText="Soru yükleniyor…">
        Ödemeye geç
      </SubmitButton>
    </ActionForm>
  );
}
