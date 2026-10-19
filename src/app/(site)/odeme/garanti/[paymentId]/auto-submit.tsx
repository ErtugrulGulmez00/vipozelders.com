"use client";

import { useEffect, useRef } from "react";

/** Bankanın ortak ödeme sayfasına imzalı formu kendiliğinden gönderir (tarayıcı JavaScript'i kapalıysa düğme kalır). */
export function AutoSubmitForm({ action, fields }: { action: string; fields: Record<string, string> }) {
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    form.current?.submit();
  }, []);
  return (
    <form ref={form} method="post" action={action}>
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="mt-6 inline-flex h-11 items-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700">
        Ödeme sayfasına geç
      </button>
    </form>
  );
}
