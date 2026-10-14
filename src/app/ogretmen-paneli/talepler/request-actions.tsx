"use client";

import { useState } from "react";
import { approveRequestAction, rejectRequestAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";

const PRESETS = ["O saatte müsait değilim", "Bu konu/kademe için uygun değilim", "Belirtilen adres hizmet bölgem dışında", "Fotoğraf okunmuyor, soruyu net çekip tekrar gönderin"];

export function RequestActions({ bookingId, rejectOnly }: { bookingId: string; rejectOnly?: boolean }) {
  const [rejecting, setRejecting] = useState(false);
  return (
    <div className="space-y-3">
      {!rejecting ? (
        <div className="flex flex-wrap gap-2">
          {rejectOnly ? null : (
            <ActionForm action={approveRequestAction}>
              <input type="hidden" name="bookingId" value={bookingId} />
              <SubmitButton pendingText="Onaylanıyor…">Onayla</SubmitButton>
            </ActionForm>
          )}
          <Button variant="outline" onClick={() => setRejecting(true)}>
            Reddet
          </Button>
        </div>
      ) : (
        <ActionForm action={rejectRequestAction} className="space-y-3 rounded-xl bg-rose-50/60 p-3">
          <input type="hidden" name="bookingId" value={bookingId} />
          <Field label="Gerekçe">
            <Select name="reasonPreset" defaultValue={PRESETS[0]}>
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
              <option value="">Diğer (aşağıya yazın)</option>
            </Select>
          </Field>
          <Field label="Öğrenciye not (isteğe bağlı)">
            <Textarea name="reason" rows={2} maxLength={250} placeholder="Örn: Perşembe 19:00 için tekrar talep gönderebilirsiniz." />
          </Field>
          <div className="flex gap-2">
            <SubmitButton variant="danger" pendingText="Reddediliyor…">
              Talebi reddet
            </SubmitButton>
            <Button variant="ghost" onClick={() => setRejecting(false)}>
              Vazgeç
            </Button>
          </div>
        </ActionForm>
      )}
    </div>
  );
}
