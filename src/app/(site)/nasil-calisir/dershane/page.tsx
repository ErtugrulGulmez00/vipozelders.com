import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { TierCards } from "@/components/center/pricing";
import { BrowserShot, GuideSection, GuideSwitcher, Note } from "@/components/site/guide";
import { GuideZoom } from "@/components/site/guide-zoom";
import { buttonClasses } from "@/components/ui/button";
import { EDITIONS } from "@/lib/center/editions";
import { centerPlans } from "@/server/center/plans";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = {
  title: "Dershane paneli nasıl çalışır?",
  description: "Dershane paketi: Etüt Merkezi paketindeki her şeye ek olarak sınıf bazlı ders programı, yoklama, sınıf defteri, derslik yönetimi ve kurum raporları.",
};

// Dershane'ye özel ekranların ayrıntılı rehberi hazırlanana kadar: paket kapsamı, ortak bölümler için Etüt merkezi rehberi ve fiyatlar
export default async function DershaneGuidePage() {
  const settings = await getSiteSettings();
  const plans = centerPlans(settings, "DERSHANE");
  const trial = settings.centerTrialDays;
  const applyHref = "/kurumlar-icin?paket=DERSHANE#basvuru";
  const [, ...extras] = EDITIONS.DERSHANE.features;

  return (
    <>
      <GuideSwitcher active="dershane" />
      <GuideZoom />
      <section className="bg-ink-900 text-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <p className="text-xs font-bold tracking-[0.12em] text-gold-400 uppercase">Dershane paketi</p>
          <h1 className="mt-3 max-w-[18ch] text-4xl font-extrabold tracking-tight sm:text-6xl">
            Sınıf bazlı yönetim, <span className="text-gold-400">tek panelde</span>.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-ink-200">Dershane paketi, Etüt Merkezi paketindeki her şeyi içerir; üstüne sınıfların toplu ders programını, yoklamasını, sınıf defterini, derslikleri ve kurum raporlarını ekler.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href={applyHref} className={buttonClasses("primary", "lg")}>
              {trial > 0 ? `${trial} gün ücretsiz deneyin` : "Başvurun"}
            </Link>
            <Link href="/nasil-calisir/etut-merkezi" className={buttonClasses("outline", "lg", "border-white/30 bg-transparent text-white hover:bg-white/10")}>
              Ortak bölümlerin rehberi
            </Link>
          </div>
        </div>
      </section>

      <GuideSection id="kapsam" eyebrow="Paket kapsamı" title="Etüt Merkezi'ndeki her şey, artı sınıf yönetimi" className="border-t-0">
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div className="grid gap-4">
            <ul className="grid gap-3 text-[15.5px]">
              {extras.map((f) => (
                <li key={f} className="flex gap-2.5">
                  <Check className="mt-0.5 size-5 shrink-0 text-emerald-600" aria-hidden /> {f}
                </li>
              ))}
            </ul>
            <Note>
              Öğrenci ve veli kaydı, etüt, ödev, koçluk, deneme analizi, fotoğrafla soru, muhasebe ve veli portalı iki pakette aynıdır; ekran ekran anlatımı{" "}
              <Link href="/nasil-calisir/etut-merkezi" className="font-semibold text-brand-700 underline">
                Etüt merkezi rehberinde
              </Link>
              .
            </Note>
          </div>
          <figure className="m-0">
            <BrowserShot shot={{ src: "/kurumlar/raporlar.png", url: "pikampus.com/kurum/raporlar", alt: "Kurum, sınıf ve öğrenci raporları", width: 1366, height: 820 }} />
            <figcaption className="mt-2.5 text-sm text-ink-500">Kurum → sınıf → öğrenci raporu: devam, ödev, son deneme neti ve geciken ödeme tek tabloda.</figcaption>
          </figure>
        </div>
      </GuideSection>

      <GuideSection id="fiyat" eyebrow="Fiyat" title="Dershane paketi" lead="Fiyat aktif öğrenci sayınıza göre belirlenir; pasif ve ayrılan öğrenciler sayılmaz. Tüm kademelerde bütün modüller, sınırsız personel ve veli portalı dahildir. Fiyatlara KDV dahildir.">
        <div className="mt-8">
          <TierCards plans={plans} edition="DERSHANE" />
        </div>
      </GuideSection>
    </>
  );
}
