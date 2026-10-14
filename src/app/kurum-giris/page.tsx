import { BookOpenCheck, ClipboardCheck, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/app/(auth)/giris/login-form";
import { LoginTabs } from "@/components/site/login-tabs";
import { PiMark } from "@/components/site/pi-mark";
import { Card, Skeleton } from "@/components/ui/primitives";
import { resolveCenter } from "@/server/center/context";
import { getCenterBranding } from "@/server/center/public";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Kurum paneli girişi",
  description: "Etüt merkezi ve dershane personeli için Pi Kampüs kurum paneli girişi.",
  robots: { index: false },
};

/** Kurum personeline özel giriş kapısı: aynı hesaplar, kurum temalı sayfa, girişten sonra doğrudan /kurum. */
export default function CenterLoginPage({ searchParams }: PageProps<"/kurum-giris">) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="hidden flex-col justify-between bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 p-10 text-white lg:flex">
        <Link href="/kurumlar-icin" className="inline-flex items-center gap-2.5">
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-white/10 text-gold-300">
            <PiMark className="size-6" />
          </span>
          <span className="text-lg font-bold">Pi Kampüs · Kurum paneli</span>
        </Link>
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-tight">Kurumunuzun tamamı tek panelde</h1>
          <ul className="mt-6 space-y-3 text-brand-100">
            {[
              { Icon: ClipboardCheck, text: "Yoklama ve velilere anında devamsızlık bildirimi" },
              { Icon: BookOpenCheck, text: "Deneme analizi, karne ve eksik konular" },
              { Icon: Wallet, text: "Taksit, tahsilat, makbuz ve gider takibi" },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-5 text-gold-300" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-brand-200">Veliler ve öğrenciler “Kişisel giriş” sekmesinden girer.</p>
      </aside>
      <main className="flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md">
          <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
            <LoginCard searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function LoginCard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const slug = typeof sp.kurum === "string" ? sp.kurum.slice(0, 120) : "";
  const [resolved, branding] = await Promise.all([resolveCenter(), slug ? getCenterBranding(slug) : Promise.resolve(null)]);
  // Zaten oturum açmış personel doğrudan panele geçer.
  if (resolved.kind === "ok") redirect("/kurum");
  const logo = branding ? uploadUrl(branding.logoKey) : null;
  return (
    <Card className="p-6 sm:p-8">
      <LoginTabs active="center" />
      <div className="mb-6 flex items-center gap-3">
        {logo ? (
          <Image src={logo} alt="" width={48} height={48} unoptimized className="size-12 rounded-xl border border-slate-100 object-contain" />
        ) : (
          <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-600 text-gold-300 lg:hidden">
            <PiMark className="size-7" />
          </span>
        )}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{branding ? branding.name : "Kurum paneli girişi"}</h1>
          <p className="text-sm text-slate-500">{branding ? "Personel girişi · Pi Kampüs kurum paneli" : "Etüt merkezi ve dershane personeli"}</p>
        </div>
      </div>
      <LoginForm defaultNext="/kurum" />
      <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
        <p>Giriş bilgilerinizi kurum yöneticiniz verir; ilk girişte kendi şifrenizi belirlersiniz.</p>
        <p>
          Kurumunuz henüz Pi Kampüs kullanmıyor mu?{" "}
          <Link href="/kurumlar-icin" className="font-semibold text-brand-700 hover:underline">
            Başvurun
          </Link>
        </p>
      </div>
    </Card>
  );
}
