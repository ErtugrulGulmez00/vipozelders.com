"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="size-12 text-amber-500" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Beklenmeyen bir hata oluştu</h1>
      <p className="mt-2 text-slate-600">Sorun geçici olabilir. Tekrar deneyin; devam ederse destek ekibimize bu kodu iletin.</p>
      {error.digest ? <p className="mt-2 font-mono text-xs text-slate-400">Hata kodu: {error.digest}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button type="button" onClick={() => retry()} className={buttonClasses("primary", "md")}>
          Tekrar dene
        </button>
        <Link href="/" className={buttonClasses("outline", "md")}>
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
