"use client";

import { addQuestionMessageAction } from "@/actions/question-bookings";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { FileInput } from "@/components/ui/file-input";
import { Checkbox, Field, Textarea } from "@/components/ui/form";

/** Soru yazışmasına mesaj ekleme formu. Öğretmen çözümü yazıyla, fotoğrafla ya da videoyla gönderir. */
export function QuestionMessageForm({ bookingId, asTeacher, awaitingSolution }: { bookingId: string; asTeacher: boolean; awaitingSolution: boolean }) {
  return (
    <ActionForm action={addQuestionMessageAction} resetOnSuccess className="space-y-3">
      <input type="hidden" name="bookingId" value={bookingId} />
      <Field label={asTeacher && awaitingSolution ? "Çözüm açıklaması" : "Mesajınız"}>
        <Textarea
          name="body"
          rows={asTeacher && awaitingSolution ? 5 : 3}
          maxLength={4000}
          placeholder={asTeacher ? (awaitingSolution ? "Çözümü adım adım yazın; isterseniz çözümün fotoğrafını ya da kısa bir anlatım videosu ekleyin." : "Öğrencinin sorusunu yanıtlayın.") : "Örn: 3. adımda neden 2 ile çarptık?"}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Fotoğraf (isteğe bağlı)">
          <FileInput name="image" accept="image/*" capture="environment" placeholder="Fotoğraf çek / seç" />
        </Field>
        {asTeacher ? (
          <Field label="Video (isteğe bağlı)" hint="En fazla 25 MB; telefonda birkaç dakikalık kayıt.">
            <FileInput name="video" accept="video/*" capture="environment" placeholder="Video çek / seç" />
          </Field>
        ) : null}
      </div>
      {asTeacher && awaitingSolution ? <Checkbox name="isSolution" defaultChecked label="Bu mesaj sorunun çözümüdür (öğrenciye “çözüm geldi” bildirimi gider)" /> : null}
      <SubmitButton pendingText="Gönderiliyor…">{asTeacher && awaitingSolution ? "Gönder" : "Mesajı gönder"}</SubmitButton>
    </ActionForm>
  );
}
