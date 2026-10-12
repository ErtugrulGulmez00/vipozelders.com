"use client";

import { deleteAnnouncementAction, sendAnnouncementAction } from "@/actions/center/communication";
import { ActionForm, FieldError, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";

export function AnnouncementForm({ groups, smsConfigured }: { groups: { id: string; name: string; count: number }[]; smsConfigured: boolean }) {
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
        <p className="text-slate-600">Veli portalına bağlı velilere her zaman site bildirimi gider.</p>
        <Checkbox name="sendEmail" defaultChecked label="E-posta da gönder" />
        <Checkbox name="sendSms" label={smsConfigured ? "SMS de gönder (kısa tutun; ilk 300 karakter)" : "SMS de gönder (SMS sağlayıcı tanımlı değil; yalnızca kayda geçer)"} />
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
