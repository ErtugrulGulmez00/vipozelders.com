import { ArrowRight, ChartColumn, Check, CreditCard, Star, Users } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { CENTER_STUDENT_COUNT_OPTIONS } from "@/lib/center/labels";
import { parseHomeTestimonials, splitOfferLead } from "@/lib/home-page";
import { getSiteSettings } from "@/server/site";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const title = `${settings.siteName} · Etüt merkezi yönetim paneli ve özel ders`;
  const description = "Yoklama, veli bildirimi, deneme analizi ve tahsilat tek panelde. Aileler için LGS ve YKS'ye hazırlıkta onaylı özel ders öğretmenleri.";
  return { title: { absolute: title }, description, alternates: { canonical: "/" }, openGraph: { type: "website", locale: "tr_TR", siteName: settings.siteName, title, description } };
}

const FEATURES = [
  { Icon: Check, tile: "bg-brand-600 text-white", title: "Yoklama ve veli bildirimi", text: "Yoklamayı telefondan alın; gelmeyen öğrencinin velisine hemen bildirim gitsin." },
  { Icon: ChartColumn, tile: "bg-gold-400 text-ink-900", title: "Deneme analizi", text: "Yayınevinin sonuç PDF'ini yükleyin; ders ve konu bazında karneler hazırlansın." },
  { Icon: CreditCard, tile: "bg-ink-900 text-gold-400", title: "Tahsilat ve taksit takibi", text: "Ödeme planı, makbuz ve geciken taksitler tek listede." },
  { Icon: Users, tile: "bg-mint-400 text-ink-950", title: "Veli ve öğrenci portalı", text: "Veliler devamsızlığı, deneme sonuçlarını ve duyuruları kendi hesaplarından görür." },
];

const PROMISES = [
  { title: "Kurulumu birlikte yapıyoruz", text: "Öğrenci listenizi Excel'den aktarır, ilk yoklamayı sizinle birlikte alırız." },
  { title: "Verileriniz sizin", text: "Kayıtlarınızı istediğiniz zaman indirebilirsiniz. Abonelik sona erse de verileriniz silinmez." },
  { title: "Sınırsız personel", text: "Öğretmen, müdür ve muhasebeci için ayrı yetkilerle istediğiniz kadar hesap açın." },
];

/** Alt kenarı kalın düğme (ana sayfanın birincil eylemleri) */
const CHUNKY = "inline-flex items-center justify-center rounded-2xl border-b-[5px] font-display font-extrabold transition-colors active:translate-y-px";

export default async function HomePage() {
  const settings = await getSiteSettings();
  const trialDays = settings.centerTrialDays;
  const offer = settings.homeFounderOffer.trim() ? splitOfferLead(settings.homeFounderOffer) : null;
  const testimonials = parseHomeTestimonials(settings.homeTestimonials);

  return (
    <>
      {/* Karşılama: kurum mesajı, başvuruya götüren çubuk ve gerçek panel ekranları */}
      <section className="bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-10 sm:pt-14 lg:grid-cols-[1fr_1.05fr]">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="self-start rounded-full bg-brand-50 px-3.5 py-1.5 text-sm font-bold text-brand-700">Etüt merkezleri için</p>
            <h1 className="text-4xl font-extrabold leading-[1.06] tracking-tight text-ink-900 sm:text-5xl lg:text-[3.4rem]">Etüt merkezinizi tek ekrandan yönetin.</h1>
            <p className="max-w-xl text-lg leading-relaxed text-ink-600">Yoklama, veli bildirimi, deneme analizi ve tahsilat tek panelde. Kurulumu sizinle birlikte yapıyoruz.</p>

            {/* Seçimler başvuru formuna dolu gider (?paket=…&ogrenci=…#basvuru) */}
            <form action="/kurumlar-icin#basvuru" method="get" className="mt-2 flex flex-col rounded-3xl border border-ink-100 bg-white p-2 shadow-lg shadow-ink-900/10 sm:flex-row sm:items-stretch">
              <label className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-2 text-xs font-bold text-ink-900">
                Öğrenci sayısı
                <select name="ogrenci" defaultValue={CENTER_STUDENT_COUNT_OPTIONS[0]} className="min-h-7 w-full bg-transparent text-[15px] font-medium text-ink-600 focus:outline-none">
                  {CENTER_STUDENT_COUNT_OPTIONS.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <button type="submit" className={cn(CHUNKY, "mt-2 min-h-14 border-brand-800 bg-brand-600 px-6 text-base text-white hover:bg-brand-700 sm:mt-0")}>
                {trialDays > 0 ? "Ücretsiz deneyin" : "Başvurun"}
              </button>
            </form>
            <p className="text-sm text-ink-500">{trialDays > 0 ? `${trialDays} gün ücretsiz · kart bilgisi gerekmez · sınırsız personel` : "Birebir kurulum · sınırsız personel"}</p>

            {offer ? (
              <p className="flex items-start gap-3.5 rounded-2xl border border-gold-300 bg-gold-50 px-4 py-4 text-[15px] leading-relaxed text-ink-700">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-gold-400 text-ink-900">
                  <Star className="size-5" aria-hidden />
                </span>
                <span>
                  {offer.lead ? <strong className="text-ink-900">{offer.lead} </strong> : null}
                  {offer.rest}
                </span>
              </p>
            ) : null}

            <Link href="/ozel-ders" className="inline-flex min-h-12 items-center gap-2.5 self-start rounded-2xl border-2 border-b-4 border-ink-100 px-4 py-2 text-[15px] text-ink-900 hover:bg-ink-50">
              <span className="shrink-0 whitespace-nowrap rounded-full bg-ink-50 px-2 py-0.5 text-[13px] font-bold">Veli misiniz?</span>
              <span>Çocuğunuz için özel ders öğretmeni bulun</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
            <Link href="/pi-koc" className="-mt-2 inline-flex min-h-12 items-center gap-2.5 self-start rounded-2xl border-2 border-b-4 border-ink-100 px-4 py-2 text-[15px] text-ink-900 hover:bg-ink-50">
              <span className="shrink-0 whitespace-nowrap rounded-full bg-ink-50 px-2 py-0.5 text-[13px] font-bold">Koç musunuz?</span>
              <span>Öğrencilerinizi Pi Koç ile takip edin</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden />
            </Link>
          </div>

          <div className="relative min-w-0 pb-14 pl-14 sm:pl-16">
            <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-2xl shadow-ink-900/20">
              <div className="flex items-center gap-1.5 border-b border-ink-100 bg-ink-50 px-3.5 py-2.5">
                <span aria-hidden className="size-2.5 rounded-full bg-brand-200" />
                <span aria-hidden className="size-2.5 rounded-full bg-gold-300" />
                <span aria-hidden className="size-2.5 rounded-full bg-mint-400" />
                {/* Sağa yaslı: soldaki telefon görseli başlığın üstüne binmesin */}
                <span className="ml-auto text-xs text-ink-500">Kurum paneli · Deneme analizi</span>
              </div>
              <Image
                src="/kurumlar/deneme.png"
                alt="Kurum panelinde deneme analizi ekranı: katılım, ortalama net, ders ortalamaları ve net dağılımı"
                width={1366}
                height={820}
                sizes="(min-width: 1024px) 520px, 90vw"
                loading="eager"
                className="block h-auto w-full"
              />
            </div>
            <div className="absolute bottom-0 left-0 aspect-[9/18.5] w-[34%] min-w-30 max-w-[190px] overflow-hidden rounded-[30px] border-[7px] border-ink-900 bg-ink-900 shadow-2xl shadow-ink-900/30">
              <Image
                src="/tanitim/etut-merkezi/t8-yoklama-telefon.jpg"
                alt="Telefonda etüt yoklaması ekranı: öğrenciler geldi veya gelmedi olarak işaretleniyor"
                fill
                sizes="190px"
                className="rounded-[23px] object-cover object-top"
              />
            </div>
            <p className="absolute bottom-0 right-0 text-xs text-ink-500">Panelden gerçek ekranlar, örnek verilerle</p>
          </div>
        </div>
      </section>

      {/* Her gün kullanılan özellikler */}
      <section className="bg-ink-50">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:py-16">
          <h2 className="text-3xl font-extrabold tracking-tight text-ink-900">Her gün kullanacağınız dört özellik</h2>
          <p className="mt-1.5 text-ink-600">Defter, Excel ve WhatsApp grupları arasında kaybolmayın.</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ Icon, tile, title, text }) => (
              <div key={title} className="flex flex-col gap-3 rounded-3xl bg-white p-6">
                <span className={cn("inline-flex size-13 items-center justify-center rounded-2xl", tile)}>
                  <Icon className="size-7" aria-hidden />
                </span>
                <h3 className="text-lg font-extrabold text-ink-900">{title}</h3>
                <p className="text-[15px] leading-relaxed text-ink-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Yorumlar: Site ayarlarından girilene kadar görünmez */}
      {testimonials.length ? (
        <section className="mx-auto max-w-6xl px-4 pt-14 sm:pt-16">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">İlk kurumlarımızdan</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {testimonials.map((t) => (
              <figure key={t.quote} className="flex flex-col gap-3 rounded-3xl border-2 border-ink-50 p-6">
                <blockquote className="text-[17px] leading-relaxed text-ink-700">“{t.quote}”</blockquote>
                {t.name || t.center ? <figcaption className="text-sm font-bold text-ink-500">{[t.name, t.center].filter(Boolean).join(" · ")}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {/* Güvenceler */}
      <section className="mx-auto grid max-w-6xl gap-7 px-4 pt-14 sm:pt-16 md:grid-cols-3">
        {PROMISES.map((item) => (
          <div key={item.title} className="flex flex-col gap-1.5">
            <h3 className="text-lg font-extrabold text-ink-900">{item.title}</h3>
            <p className="text-[15px] leading-relaxed text-ink-600">{item.text}</p>
          </div>
        ))}
      </section>

      {/* Özel ders ve Pi Koç kapıları */}
      <section className="mx-auto grid max-w-6xl gap-5 px-4 pt-14 sm:pt-16 lg:grid-cols-2">
        <div className="flex flex-col gap-6 rounded-[1.75rem] bg-ink-900 p-8 text-white sm:p-10">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-wide text-gold-400">VELİLER İÇİN</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight">Çocuğunuz için özel ders öğretmeni mi arıyorsunuz?</h2>
            <p className="mt-2.5 text-[17px] leading-relaxed text-ink-200">LGS ve YKS’ye hazırlık için kimliği ve diploması kontrol edilmiş öğretmenler. Birçok öğretmenle ilk 15 dakikalık tanışma ücretsizdir.</p>
          </div>
          <Link href="/ozel-ders" className={cn(CHUNKY, "min-h-14 self-start border-gold-600 bg-gold-400 px-6 text-base text-ink-900 hover:bg-gold-300")}>
            Öğretmenleri inceleyin
          </Link>
        </div>
        <div className="flex flex-col gap-6 rounded-[1.75rem] bg-brand-600 p-8 text-white sm:p-10">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-wide text-white/85">PI KOÇ</p>
            <h2 className="mt-2 text-3xl font-extrabold leading-tight">Bireysel koçluk mu yapıyorsunuz?</h2>
            <p className="mt-2.5 text-[17px] leading-relaxed text-white/90">Program, kaynak, deneme analizi ve veli takibi tek panelde. Öğrenci sayınıza göre aylık ödersiniz.</p>
          </div>
          <Link href="/pi-koc" className={cn(CHUNKY, "min-h-14 self-start border-ink-300 bg-white px-6 text-base text-ink-900 hover:bg-ink-50")}>
            Pi Koç&apos;u inceleyin
          </Link>
        </div>
      </section>
    </>
  );
}
