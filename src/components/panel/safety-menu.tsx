"use client";

import { Ban, Flag } from "lucide-react";
import { useState } from "react";
import { reportAction, toggleBlockAction } from "@/actions/safety";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Select, Textarea } from "@/components/ui/form";

const REASONS = [
  { key: "taciz", label: "Taciz, hakaret ya da tehdit" },
  { key: "uygunsuz", label: "Uygunsuz ya da müstehcen içerik" },
  { key: "dolandiricilik", label: "Dolandırıcılık ya da sahte hesap" },
  { key: "platform-disi", label: "Platform dışına yönlendirme / ödeme isteme" },
  { key: "spam", label: "İstenmeyen mesaj (spam)" },
  { key: "diger", label: "Diğer" },
];

/** Konuşma ve ders taleplerinde "Bildir" ve "Engelle": karşı tarafı yönetime bildirir ya da engeller. */
export function SafetyMenu({ targetUserId, targetName, kind, refId, blocked }: { targetUserId: string; targetName: string; kind: "thread" | "inquiry" | "message" | "user"; refId?: string; blocked: boolean }) {
  const [open, setOpen] = useState<"report" | "block" | null>(null);
  const btn = "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800";
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <button type="button" className={btn} onClick={() => setOpen(open === "report" ? null : "report")} aria-expanded={open === "report"}>
          <Flag className="size-3.5" aria-hidden /> Bildir
        </button>
        <button type="button" className={btn} onClick={() => setOpen(open === "block" ? null : "block")} aria-expanded={open === "block"}>
          <Ban className="size-3.5" aria-hidden /> {blocked ? "Engeli kaldır" : "Engelle"}
        </button>
      </div>
      {open === "report" ? (
        <ActionForm action={reportAction} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <input type="hidden" name="kind" value={kind} />
          {refId ? <input type="hidden" name="refId" value={refId} /> : null}
          <p className="text-sm font-semibold text-slate-800">{targetName} adlı kişiyi Pi Kampüs ekibine bildir</p>
          <Select name="reason" required defaultValue="" aria-label="Bildirim nedeni">
            <option value="" disabled>
              Neden seçin
            </option>
            {REASONS.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </Select>
          <Textarea name="note" rows={2} maxLength={1000} placeholder="İsterseniz kısaca anlatın (zorunlu değil)" aria-label="Açıklama" />
          <SubmitButton size="sm" pendingText="Gönderiliyor…">
            Bildirimi gönder
          </SubmitButton>
        </ActionForm>
      ) : null}
      {open === "block" ? (
        <ActionForm action={toggleBlockAction} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <input type="hidden" name="targetUserId" value={targetUserId} />
          <input type="hidden" name="block" value={blocked ? "0" : "1"} />
          <p className="text-sm text-slate-700">
            {blocked
              ? `${targetName} adlı kişinin engeli kaldırılsın mı? Yeniden yazışabilirsiniz.`
              : `${targetName} engellensin mi? Bu kişi size mesaj ve ders talebi gönderemez, siz de ona yazamazsınız. İstediğiniz zaman engeli kaldırabilirsiniz.`}
          </p>
          <SubmitButton size="sm" variant={blocked ? "outline" : "danger"} pendingText="Kaydediliyor…">
            {blocked ? "Engeli kaldır" : "Engelle"}
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
