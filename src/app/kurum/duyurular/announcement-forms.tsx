"use client";

import { deleteAnnouncementAction, sendAnnouncementAction } from "@/actions/center/communication";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { WhatsAppCheckbox, useWhatsAppActive } from "@/components/notification-channel";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

export function AnnouncementForm({ groups }: { groups: { id: string; name: string; count: number }[] }) {
  const whatsapp = useWhatsAppActive();
  return (
    <ActionForm action={sendAnnouncementAction} resetOnSuccess className="space-y-3">
      <Field label="Kime">
        <Select name="groupId" defaultValue="">
          <option value="">Tüm kurum (aktif öğrencilerin velileri)</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.count} öğrenci)
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Başlık">
        <Input name="title" placeholder="Örn: Veli toplantısı" required maxLength={120} />
        <FieldError name="title" />
      </Field>
      <Field label="Duyuru">
        <Textarea name="body" rows={5} maxLength={2000} placeholder="Duyuru metni" required />
        <FieldError name="body" />
      </Field>
      <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
        <p className="text-slate-600">Veli portalına bağlı velilere her zaman site/uygulama bildirimi gider.</p>
        <WhatsAppCheckbox name="sendWhatsapp" defaultChecked label="WhatsApp ile gönder" />
        <Checkbox name="sendEmail" defaultChecked={!whatsapp} label={whatsapp ? "E-posta da gönder" : "E-posta ile gönder"} />
        <p className="text-xs text-slate-500">
          WhatsApp yalnızca bilgilendirme içindir (toplantı, tatil, program değişikliği…). Kampanya, indirim ya da reklam göndermeyin: WhatsApp bu tür mesajları
          şikâyet üzerine engelleyebilir. Her veli için aylık WhatsApp hakkınızdan bir mesaj düşer.
        </p>
      </div>
      <SubmitButton confirmMessage="Duyuru gönderilsin mi?">Duyuruyu yayınla</SubmitButton>
    </ActionForm>
  );
}

export function DeleteAnnouncementButton({ announcementId }: { announcementId: string }) {
  return (
    <ActionForm action={deleteAnnouncementAction} hideMessages>
      <input type="hidden" name="announcementId" value={announcementId} />
      <SubmitButton variant="ghost" size="sm" className="h-7 px-2 text-xs text-slate-500" pendingText="…" confirmMessage="Duyuru veli portalından kaldırılsın mı?">
        Kaldır
      </SubmitButton>
    </ActionForm>
  );
}
