"use client";

import { KeyRound, MessageCircle, Printer } from "lucide-react";
import { useActionResult } from "@/components/forms/action-form";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";

// Kurum paneli istemci parçaları: formun sonucuna göre gösterilen kutular, yazdırma düğmesi.

/** Hesap açma / şifre sıfırlama sonrası giriş bilgileri (yalnızca bir kez gösterilir). */
export function CredentialsBox({ who = "Personel" }: { who?: string }) {
  const state = useActionResult();
  if (!state.ok || !state.data?.password) return null;
  const { username, password, emailSent } = state.data as { username: string; password: string; emailSent?: boolean };
  const message = `Kurum paneli girişiniz:\nAdres: ${typeof window === "undefined" ? "" : window.location.origin}/kurum-giris\nKullanıcı adı: ${username}\nGeçici şifre: ${password}\nİlk girişte kendi şifrenizi belirleyeceksiniz.`;
  return (
    <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="flex items-center gap-2 font-semibold text-emerald-900">
        <KeyRound className="size-5" aria-hidden /> Giriş bilgileri hazır
      </p>
      <p className="mt-1 text-sm text-emerald-800">
        Bu şifre yalnızca şimdi gösteriliyor. {who} ilk girişte kendi şifresini belirleyecek.{emailSent ? " E-postasına şifre belirleme bağlantısı da gönderildi." : ""}
      </p>
      <dl className="mt-3 grid gap-2 rounded-xl bg-white p-3 font-mono text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-500">Kullanıcı adı</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <span data-testid="new-username">{username}</span> <CopyButton value={username} />
          </dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-500">Geçici şifre</dt>
          <dd className="flex items-center gap-2 font-semibold">
            <span data-testid="new-password">{password}</span> <CopyButton value={password} />
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <CopyButton value={message} label="Mesaj olarak kopyala" />
      </div>
    </div>
  );
}

/** Veli davet bağlantısı: kopyala ya da WhatsApp ile paylaş. */
export function InviteLinkBox() {
  const state = useActionResult();
  const url = state.ok ? (state.data?.url as string | undefined) : undefined;
  if (!url) return null;
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Veli portalı davetiniz: ${url}`)}`;
  return (
    <div className="mt-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
      <p className="break-all font-mono text-xs text-brand-900" data-testid="invite-url">
        {url}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton value={url} label="Bağlantıyı kopyala" />
        <a href={whatsapp} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
          <MessageCircle className="size-3.5" aria-hidden /> WhatsApp ile gönder
        </a>
      </div>
    </div>
  );
}

/** İçe aktarma sonrası satır satır uyarılar. */
export function ImportNotes() {
  const state = useActionResult();
  const notes = state.ok ? String(state.data?.notes ?? "") : "";
  const unknown = state.ok ? String(state.data?.unknown ?? "") : "";
  if (!notes && !unknown) return null;
  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      {unknown ? <p className="mb-2">Tanınmayan sütunlar atlandı: {unknown}</p> : null}
      {notes ? (
        <>
          <p className="font-semibold">Kontrol etmeniz gereken satırlar:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {notes.split("\n").map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function PrintButton({ label = "Yazdır / PDF" }: { label?: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="print:hidden">
      <Printer className="size-4" aria-hidden /> {label}
    </Button>
  );
}
