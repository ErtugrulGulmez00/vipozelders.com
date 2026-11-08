import { BookMarked, ChartColumn, HeartHandshake, NotebookPen, UserRound, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/money";
import { parseCoachTiers } from "@/lib/pi-koc";
import { getSiteSettings } from "@/server/site";
import { CoachApplicationForm } from "./coach-application-form";

export const metadata: Metadata = {
  title: "Pi Koç: koçlar için öğrenci takip paneli",
  description: "Öğrenci koçları için program, kaynak, deneme analizi ve veli takibi tek panelde. LGS ve YKS koçluğu için, aylık 299 TL'den başlayan fiyatlarla.",
};

const FEATURES = [
  { Icon: UserRound, tile: "bg-brand-600 text-white", title: "Öğrenci kartı", text: "Her öğrencinin bilgileri, velisi, denemeleri ve görüşmeleri tek kartta." },
  { Icon: HeartHandshake, tile: "bg-gold-400 text-ink-900", title: "Koçluk görüşmeleri", text: "Haftalık görüşme gününü belirleyin, her görüşmenin notunu tutun." },
  { Icon: BookMarked, tile: "bg-mint-400 text-ink-950", title: "Kaynak ve program", text: "Kitap atayın, konu konu ilerlemeyi görün, gün gün çalışma programı yazın." },
  { Icon: ChartColumn, tile: "bg-ink-900 text-gold-400", title: "Deneme analizi", text: "Yayınevinin sonuç PDF'ini yükleyin ya da optik okutun; net gelişimi, karne ve konu eksikleri hazır." },
  { Icon: NotebookPen, tile: "bg-iris-500 text-white", title: "Ödev ve soru", text: "Ödev verin, teslimi kontrol edin. Öğrenci takıldığı sorunun fotoğrafını size göndersin." },
  { Icon: Wallet, tile: "bg-brand-100 text-brand-700", title: "Veli ve tahsilat", text: "Veli kendi girişiyle takip eder. Ödeme planı, tahsilat ve makbuz panelde." },
];

const STEPS = [
  ["Başvurun", "Formu doldurun, kaç öğrenciyle çalıştığınızı seçin."],
  ["Hesabınızı açalım", "Sizi arayıp panelinizi açıyoruz; giriş bilgileriniz e-postanıza gelir."],
  ["Öğrencilerinizi ekleyin", "Excel'den aktarın ya da tek tek ekleyin, velileri davet edin."],
];

const CHUNKY = "inline-flex items-center justify-center rounded-2xl border-b-[5px] font-display font-extrabold transition-colors active:translate-y-px";

export default async function PiKocPage() {
  const settings = await getSiteSettings();
  const trialDays = settings.centerTrialDays;
  const tiers = parseCoachTiers(settings.piKocTiers);
  const cta = trialDays > 0 ? "Ücretsiz deneyin" : "Başvurun";

  return (
    <>
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:py-14 lg:grid-cols-[1fr_1.05fr]">
          <div className="flex min-w-0 flex-col gap-5">
            <p className="self-start rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-bold text-brand-700">Pi Koç · Bireysel koçlar için</p>
            <h1 className="font-display text-[2.6rem] font-extrabold leading-[1.08] tracking-tight text-ink-900 sm:text-[3.3rem]">Öğrencilerinizi tek panelden takip edin.</h1>
            <p className="text-lg leading-relaxed text-ink-600">Program, kaynak, deneme ve veli bilgilendirmesi tek yerde. LGS ve YKS koçları için.</p>
            <div className="flex flex-wrap items-center gap-4">
              <a href="#basvuru" className={cn(CHUNKY, "min-h-14 border-brand-800 bg-brand-600 px-7 text-base text-white hover:bg-brand-700")}>
                {cta}
              </a>
              <a href="#fiyatlar" className="font-bold text-brand-700 hover:underline">
                Fiyatları görün
              </a>
            </div>
            {trialDays > 0 ? <p className="text-sm text-ink-500">{trialDays} gün ücretsiz · kart bilgisi gerekmez</p> : null}
          </div>
          <div className="min-w-0 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-xl">
            {/* Görselin sol menüsü kurum paneline ait; koçta o bölümler yok, kırpılır */}
            <Image src="/kurumlar/deneme.png" alt="Panelde deneme analizi ekranı" width={1366} height={820} loading="eager" sizes="(min-width: 1024px) 700px, 124vw" className="-ml-[23.6%] h-auto w-[124%] max-w-none" />
          </div>
        </div>
      </section>

      <section className="bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">Koçluğun günlük işleri tek yerde</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, tile, title, text }) => (
              <div key={title} className="rounded-3xl bg-white p-6">
                <span className={cn("inline-flex size-12 items-center justify-center rounded-2xl", tile)}>
                  <Icon className="size-6" aria-hidden />
                </span>
                <h3 className="mt-4 font-display text-xl font-extrabold text-ink-900">{title}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="fiyatlar" className="scroll-mt-20 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">Öğrenci sayınıza göre fiyat</h2>
          <p className="mt-2 text-ink-600">Bütün özellikler her pakette aynı; fark yalnızca aynı anda takip edebileceğiniz öğrenci sayısı.</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tiers.map((tier) => (
              <div key={tier.students} className="flex flex-col rounded-3xl border-2 border-ink-100 p-6">
                <p className="font-bold text-ink-900">{tier.students} öğrenciye kadar</p>
                <p className="mt-2 font-display text-4xl font-extrabold text-ink-900">
                  {formatMoney(tier.priceTl * 100)}
                  <span className="text-base font-semibold text-ink-500"> / ay</span>
                </p>
                <p className="mt-1 text-sm text-ink-500">KDV dahil</p>
                <Link href={`?ogrenci=${tier.students}#basvuru`} className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-ink-100 font-bold text-ink-900 hover:bg-ink-50">
                  Bu paketle başvur
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm text-ink-500">Ödemeyi şimdilik havale ya da EFT ile alıyoruz.</p>
        </div>
      </section>

      <section id="basvuru" className="scroll-mt-20 bg-ink-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-16 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-ink-900">Nasıl başlarım?</h2>
            <ol className="mt-6 space-y-5">
              {STEPS.map(([title, text], i) => (
                <li key={title} className="flex gap-4">
                  <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-ink-900 font-display font-extrabold text-white">{i + 1}</span>
                  <span>
                    <span className="block font-bold text-ink-900">{title}</span>
                    <span className="block text-ink-600">{text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-3xl bg-white p-6 sm:p-8">
            <h2 className="font-display text-2xl font-extrabold text-ink-900">Pi Koç başvurusu</h2>
            <div className="mt-5">
              <Suspense fallback={<Skeleton className="h-96" />}>
                <CoachApplicationForm tiers={tiers.map((t) => t.students)} />
              </Suspense>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
