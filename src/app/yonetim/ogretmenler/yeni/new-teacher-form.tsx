"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { createTeacherAction } from "@/actions/admin";
import { ActionForm, FieldError, SubmitButton, useActionResult } from "@/components/forms/action-form";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />} {copied ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}

export function Credentials() {
  const state = useActionResult();
  if (!state.ok || !state.data?.username) return null;
  const { username, password, teacherId, emailSent } = state.data as { username: string; password: string; teacherId: string; emailSent: boolean };
  const message = `Öğretmen paneli girişiniz:\nKullanıcı adı: ${username}\nGeçici şifre: ${password}\nİlk girişte kendi şifrenizi belirleyeceksiniz.`;
  return (
    <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
      <p className="flex items-center gap-2 font-semibold text-emerald-900">
        <KeyRound className="size-5" aria-hidden /> Giriş bilgileri hazır
      </p>
      <p className="mt-1 text-sm text-emerald-800">Bu şifre yalnızca şimdi gösteriliyor. Öğretmene güvenli bir kanaldan iletin; ilk girişte değiştirmesi istenecek.{emailSent ? " Ayrıca e-postasına şifre belirleme bağlantısı gönderildi." : ""}</p>
      <dl className="mt-4 grid gap-2 rounded-xl bg-white p-4 font-mono text-sm">
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
      <div className="mt-4 flex flex-wrap gap-2">
        <CopyButton value={message} />
        <Link href={`/yonetim/ogretmenler/${teacherId}`} className={buttonClasses("primary", "sm")}>
          Profilini doldur
        </Link>
      </div>
    </div>
  );
}

export function NewTeacherForm() {
  return (
    <ActionForm action={createTeacherAction} resetOnSuccess className="space-y-4" hideMessages={false}>
      <Credentials />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" htmlFor="firstName">
          <Input id="firstName" name="firstName" required />
        </Field>
        <Field label="Soyad" htmlFor="lastName">
          <Input id="lastName" name="lastName" required />
        </Field>
      </div>
      <FieldError name="firstName" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="E-posta (isteğe bağlı)" htmlFor="email" hint="Girilirse şifre belirleme bağlantısı gönderilir.">
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Telefon (isteğe bağlı)" htmlFor="phone">
          <Input id="phone" name="phone" type="tel" placeholder="05XX XXX XX XX" />
        </Field>
      </div>
      <FieldError name="email" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kullanıcı adı (boş bırakılırsa otomatik)" htmlFor="username" hint="Örn: ayse.yilmaz">
          <Input id="username" name="username" />
        </Field>
        <Field label="Kısa başlık (isteğe bağlı)" htmlFor="headline">
          <Input id="headline" name="headline" placeholder="Matematik öğretmeni · LGS uzmanı" />
        </Field>
      </div>
      <SubmitButton size="lg" pendingText="Oluşturuluyor…">
        Öğretmeni ekle ve giriş bilgisi üret
      </SubmitButton>
    </ActionForm>
  );
}
