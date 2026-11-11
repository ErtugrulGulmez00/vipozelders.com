import { CalendarHeart, ChartLine, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/app/(auth)/giris/login-form";
import { LoginTabs } from "@/components/site/login-tabs";
import { PiMark } from "@/components/site/pi-mark";
import { Card, Skeleton } from "@/components/ui/primitives";
import { kocHome, sideHome } from "@/lib/sides";
import { getCurrentUser } from "@/server/auth/current-user";
import { sideFacts } from "@/server/sides";

export const metadata: Metadata = {
  title: "Pi Koç girişi",
  description: "Bireysel koçlar ve öğrencileri için Pi Koç girişi.",
  robots: { index: false },
};

/** Pi Koç kapısı: koç /koc paneline, öğrencisi ve velisi /kocum ekranına girer (aynı hesap sistemi). */
export default function KocLoginPage() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-ink-950 p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
        <Link href="/pi-koc" className="relative inline-flex items-center gap-3">
          <span className="inline-flex size-11 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-900/40">
            <PiMark className="size-6" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-xl font-extrabold">Pi Koç</span>
            <span className="block text-xs text-ink-300">Bireysel koçluk asistanı</span>
          </span>
        </Link>
        <div className="relative">
          <h2 className="max-w-md font-display text-3xl font-extrabold leading-tight">Öğrencinin gelişimi, tek bakışta</h2>
          <ul className="mt-6 space-y-3 text-ink-100">
            {[
              { Icon: ChartLine, text: "Net gelişimi, haftalık soru ve program grafikleri" },
              { Icon: ListChecks, text: "Öğrenci görevlerini işaretler, çözdüğü soruyu girer" },
              { Icon: CalendarHeart, text: "Haftalık görüşmeler ve görüşme notları" },
            ].map(({ Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <Icon className="size-5 text-brand-400" aria-hidden /> {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-ink-300">Koçlar ve öğrencileri buradan girer.</p>
      </aside>
      <main className="flex items-center justify-center bg-[#f6f5fb] px-4 py-12">
        <div className="w-full max-w-md">
          <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
            <LoginCard />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function LoginCard() {
  const user = await getCurrentUser();
  // Zaten oturum açmış ve Pi Koç tarafı olan kişi doğrudan oraya geçer
  if (user && !user.mustChangePassword) {
    const facts = await sideFacts(user.id, user.role);
    if (kocHome(facts)) redirect(sideHome(facts, "koc"));
  }
  return (
    <Card className="p-6 sm:p-8">
      <LoginTabs active="koc" />
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex size-12 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 text-white lg:hidden">
          <PiMark className="size-7" />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pi Koç girişi</h1>
          <p className="text-sm text-slate-500">Koç ve öğrenci girişi</p>
        </div>
      </div>
      <LoginForm gate="koc" />
      <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-center text-sm text-slate-600">
        <p>Öğrenci giriş bilgilerini koçu verir; ilk girişte kendi şifrenizi belirlersiniz.</p>
        <p>
          Koçsanız ve henüz hesabınız yoksa{" "}
          <Link href="/pi-koc#basvuru" className="font-semibold text-brand-700 hover:underline">
            Pi Koç&apos;a başvurun
          </Link>
        </p>
      </div>
    </Card>
  );
}
