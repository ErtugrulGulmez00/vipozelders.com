"use client";

import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { messageTeacherAction, sendMessageAction } from "@/actions/messages";
import { ActionForm, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/form";

/** Konuşma sayfasındaki yazma kutusu. */
export function MessageForm({ threadId }: { threadId: string }) {
  return (
    <ActionForm action={sendMessageAction} resetOnSuccess className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea name="body" rows={3} maxLength={2000} required placeholder="Mesajınızı yazın…" aria-label="Mesaj" />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500">Güvenliğiniz için telefon, e-posta ve adres bilgileri paylaşılamaz; dersler ve ödemeler site üzerinden yapılır.</p>
        <SubmitButton size="sm" pendingText="Gönderiliyor…">
          Gönder
        </SubmitButton>
      </div>
    </ActionForm>
  );
}

function LoginHint() {
  const result = useActionResult();
  if (!result.error?.includes("giriş yapın")) return null;
  return (
    <p className="text-sm">
      <Link href="/giris" className="font-semibold text-brand-700 underline">
        Giriş yapın
      </Link>{" "}
      ya da{" "}
      <Link href="/kayit" className="font-semibold text-brand-700 underline">
        ücretsiz üye olun
      </Link>
      .
    </p>
  );
}

/** Öğretmen profilinde "Öğretmene soru sor": ödeme yapmadan önce kısa mesaj. */
export function MessageTeacherBox({ teacherId, teacherFirstName }: { teacherId: string; teacherFirstName: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50">
        <MessageCircle className="size-4" aria-hidden /> {teacherFirstName} öğretmene mesaj gönder
      </button>
    );
  }
  return (
    <ActionForm action={messageTeacherAction} className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <input type="hidden" name="teacherId" value={teacherId} />
      <Textarea name="body" rows={3} maxLength={2000} required placeholder="Örn: Kızım 7. sınıf, LGS matematikte zorlanıyor. Haftada iki ders düşünüyoruz; nasıl çalışırsınız?" aria-label="Mesaj" />
      <LoginHint />
      <p className="text-xs text-slate-500">İletişim bilgileri (telefon, e-posta) otomatik gizlenir.</p>
      <SubmitButton size="sm" className="w-full" pendingText="Gönderiliyor…">
        Gönder
      </SubmitButton>
    </ActionForm>
  );
}
