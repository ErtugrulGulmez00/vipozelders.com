import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { pendingTwoFactor } from "@/server/auth/two-factor";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "İki adımlı doğrulama", robots: { index: false } };

export default function TwoFactorPage({ searchParams }: PageProps<"/giris/dogrulama">) {
  return (
    <Card className="p-6 sm:p-8">
      <span className="inline-flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
        <ShieldCheck className="size-6" aria-hidden />
      </span>
      <h1 className="mt-4 text-2xl font-bold text-slate-900">İki adımlı doğrulama</h1>
      <p className="mt-1 text-sm text-slate-500">Telefonunuzdaki doğrulayıcı uygulamada (Google Authenticator vb.) görünen 6 haneli kodu yazın.</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-32" />}>
          <Challenge searchParams={searchParams} />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        <Link href="/giris" className="font-semibold text-brand-700 hover:underline">
          Girişe dön
        </Link>
      </p>
    </Card>
  );
}

async function Challenge({ searchParams }: { searchParams: PageProps<"/giris/dogrulama">["searchParams"] }) {
  const pending = await pendingTwoFactor();
  if (!pending) redirect("/giris");
  const { next } = await searchParams;
  return <TwoFactorForm next={typeof next === "string" ? next : ""} />;
}
