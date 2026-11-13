import { CalendarHeart, ChartLine, CheckCircle2, FileText, ListChecks } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { KocAddToAccountForm, KocSignupForm } from "@/components/koc/signup-form";
import { PiMark } from "@/components/site/pi-mark";
import { Skeleton } from "@/components/ui/primitives";
import { kocHome } from "@/lib/sides";
import { parseCoachTiers } from "@/lib/pi-koc";
import { getCurrentUser } from "@/server/auth/current-user";
import { getSiteSettings } from "@/server/site";
import { sideFacts } from "@/server/sides";

export const metadata: Metadata = {
  title: "Pi Koç'a ücretsiz başlayın",
  description: "Bireysel koçlar için öğrenci takip paneli. Kart bilgisi gerekmez; hesabınız hemen açılır.",
};

const POINTS = [
  { Icon: ChartLine, text: "Net, soru ve hedef grafikleri" },
  { Icon: ListChecks, text: "Haftalık program, şablonlar, konu eksik haritası" },
  { Icon: CalendarHeart, text: "Görüşme notları ve online görüşme" },
  { Icon: FileText, text: "Tek tıkla haftalık veli raporu" },
];

export default function KocSignupPage({ searchParams }: PageProps<"/pi-koc/kayit">) {
  return (
    <section className="relative overflow-hidden bg-[#f6f5fb]">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:py-16 lg:grid-cols-[1fr_1.05fr] lg:items-start">
        <div className="relative overflow-hidden rounded-[2rem] bg-ink-950 p-8 text-white sm:p-10">
          <div className="pointer-events-none absolute -left-24 -top-24 size-80 rounded-full bg-brand-600/30 blur-3xl" aria-hidden />
          <div className="relative">
            <span className="inline-flex size-12 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-900/40">
              <PiMark className="size-7" />
            </span>
            <h1 className="mt-6 font-display text-4xl font-extrabold leading-[1.1] tracking-tight">
              Öğrencilerinizi <span className="text-brand-400">tek panelden</span> takip edin
            </h1>
            <p className="mt-3 text-ink-200">Hesabınız hemen açılır, kart bilgisi istemeyiz. Ücretsiz paket süresizdir.</p>
            <ul className="mt-8 space-y-4">
              {POINTS.map(({ Icon, text }) => (
                <li key={text} className="flex items-center gap-3 text-ink-100">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/10">
                    <Icon className="size-[18px] text-brand-300" aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-8 flex items-center gap-2 text-sm text-ink-300">
              <CheckCircle2 className="size-4 text-emerald-400" aria-hidden /> Öğrencileriniz de kendi hesabıyla girer.
            </p>
          </div>
        </div>
        <div className="rounded-[2rem] border border-ink-100 bg-white p-6 shadow-xl shadow-ink-900/5 sm:p-8">
          <Suspense fallback={<Skeleton className="h-[34rem]" />}>
            <SignupCard searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function SignupCard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [sp, user, settings] = await Promise.all([searchParams, getCurrentUser(), getSiteSettings()]);
  if (user && !user.mustChangePassword && kocHome(await sideFacts(user.id, user.role))) redirect("/koc");
  const tiers = parseCoachTiers(settings.piKocTiers).map((t) => ({ students: t.students, label: `${t.name} · ${t.students} öğrenciye kadar · aylık ${t.priceTl.toLocaleString("tr-TR")} TL` }));
  const asked = Number(sp.ogrenci);
  const chosen = tiers.some((t) => t.students === asked) ? asked : null;
  const freeStudents = settings.piKocFreeStudents;
  return (
    <>
      <h2 className="font-display text-2xl font-extrabold tracking-tight text-ink-900">{freeStudents > 0 ? `${freeStudents} öğrenciye kadar ücretsiz` : "Pi Koç hesabınızı açın"}</h2>
      <p className="mt-1 mb-6 text-sm text-slate-500">
        {user ? "Mevcut hesabınıza Pi Koç ekleyin." : "Bir dakikada hesabınızı açın, ilk öğrencinizi ekleyin."}
      </p>
      {user ? (
        <KocAddToAccountForm tiers={tiers} chosen={chosen} name={`${user.firstName} ${user.lastName}`} freeStudents={freeStudents} />
      ) : (
        <KocSignupForm tiers={tiers} chosen={chosen} freeStudents={freeStudents} />
      )}
      <p className="mt-6 border-t border-slate-100 pt-5 text-center text-sm text-slate-600">
        {user ? null : (
          <>
            Hesabınız var mı?{" "}
            <Link href="/koc-giris" className="font-semibold text-brand-700 hover:underline">
              Pi Koç girişi
            </Link>
            {" · "}
            <Link href="/giris?next=/pi-koc/kayit" className="font-semibold text-brand-700 hover:underline">
              Öğretmen hesabımla başla
            </Link>
          </>
        )}
      </p>
    </>
  );
}
