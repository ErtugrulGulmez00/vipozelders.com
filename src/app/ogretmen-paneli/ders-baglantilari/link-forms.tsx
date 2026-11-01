"use client";

import { MessageCircle, X } from "lucide-react";
import { cancelLessonLinkAction, createLessonLinkAction } from "@/actions/lesson-links";
import { ActionForm, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { CopyButton } from "@/components/ui/copy-button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";

type Option = { value: string; label: string };

export function LinkShare({ url }: { url: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
      <input readOnly value={url} aria-label="Ders bağlantısı" className="min-w-0 flex-1 bg-transparent px-1 text-xs text-slate-600 outline-none" onFocus={(e) => e.target.select()} />
      <CopyButton value={url} />
      <a
        href={`https://wa.me/?text=${encodeURIComponent(`Ders bağlantınız: ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
      >
        <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
      </a>
    </div>
  );
}

function CreatedLink() {
  const state = useActionResult();
  const url = state.ok ? (state.data?.url as string | undefined) : undefined;
  return url ? (
    <div className="sm:col-span-2">
      <LinkShare url={url} />
    </div>
  ) : null;
}

export function LessonLinkForm({
  free,
  offerings,
  sources,
  defaultSource,
  durations,
  today,
  noteMin,
}: {
  free: boolean;
  offerings: Option[];
  sources: Option[];
  defaultSource?: string;
  durations: Option[];
  today: string;
  noteMin: number;
}) {
  return (
    <ActionForm action={createLessonLinkAction} className="grid gap-3 sm:grid-cols-2">
      {free ? (
        <Field label="Ders" className="sm:col-span-2">
          <Select name="offeringId" defaultValue={offerings[0]?.value ?? "genel"}>
            {offerings.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value="genel">Genel görüşme (koçluk)</option>
          </Select>
        </Field>
      ) : (
        <Field label="Telafi edilecek ücretli ders" className="sm:col-span-2" hint="Ücreti ödenmiş, iadesi yapılmamış son 30 günlük online dersleriniz (öğrenciyle ikinizin de katıldığı dersler hariç). Her derse bir telafi bağlantısı açılabilir; telafisi açılan dersin sınıfı kapanır.">
          <Select name="sourceBookingId" defaultValue={defaultSource ?? ""} required>
            <option value="">Ders seçin</option>
            {sources.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field label="Gün">
        <Input type="date" name="date" min={today} defaultValue={today} required />
      </Field>
      <Field label="Saat">
        <Input type="time" name="time" step={300} required />
      </Field>
      <Field label="Süre">
        <Select name="duration" defaultValue="60">
          {durations.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label={free ? "Not (isteğe bağlı)" : "Gerekçe"}
        className="sm:col-span-2"
        hint={free ? "Yalnızca siz ve yönetici görür." : `Öğrenci bu dersin ücretini ödemişti; ders neden o saatte yapılamadı? En az ${noteMin} karakter. Yönetici bu notu görür.`}
      >
        <Textarea
          name="note"
          rows={3}
          maxLength={500}
          required={!free}
          minLength={free ? undefined : noteMin}
          placeholder={free ? undefined : "Örn. 12 Kasım 19:00 dersine rahatsızlığım nedeniyle giremedim; öğrenciyle 14 Kasım 18:00'de telafi yapıyoruz."}
        />
      </Field>
      <div className="sm:col-span-2">
        <SubmitButton pendingText="Oluşturuluyor…">Bağlantı oluştur</SubmitButton>
      </div>
      <CreatedLink />
    </ActionForm>
  );
}

export function CancelLinkButton({ linkId }: { linkId: string }) {
  return (
    <ActionForm action={cancelLessonLinkAction}>
      <input type="hidden" name="linkId" value={linkId} />
      <SubmitButton variant="ghost" size="sm" confirmMessage="Bağlantı iptal edilsin mi? Öğrenci bu bağlantıyla derse kaydolamaz." pendingText="…">
        <X className="size-4" aria-hidden /> İptal et
      </SubmitButton>
    </ActionForm>
  );
}
