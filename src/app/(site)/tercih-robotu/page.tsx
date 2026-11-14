import { ArrowRight, School, University } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { faqJsonLd, JsonLd } from "@/components/site/json-ld";

export const metadata: Metadata = {
  title: "LGS ve YKS tercih robotu: ücretsiz taban puanı ve sıralama hesaplama",
  description:
    "LGS ve YKS için ücretsiz tercih robotu. Puanınızı, başarı sıranızı ya da yüzdelik diliminizi girin; liseler ve üniversite programları geçen yılın verilerine göre güvenli, uygun ve riskli diye ayrılsın.",
  alternates: { canonical: "/tercih-robotu" },
};

const FAQ = [
  {
    q: "Tercih robotu nasıl çalışır?",
    a: "Girdiğiniz puanı, başarı sırasını ya da yüzdelik dilimi her okulun ve programın geçen yılki taban değeriyle karşılaştırır. Tabanın belirgin üstündeyseniz okul güvenli, tabana yakınsanız uygun, biraz altındaysanız riskli, belirgin altındaysanız hayal tercihi olarak gösterilir.",
  },
  {
    q: "Sonuçlar kesin mi?",
    a: "Hayır, sonuçlar tahmindir. Kontenjanlar, aday sayısı ve puan dağılımı her yıl değişir; bu yüzden geçen yılın tabanı bu yıl birkaç puan yukarı ya da aşağı gidebilir. Kesin bilgi için ÖSYM ve MEB'in resmî kılavuzları ve sonuçları esas alınır.",
  },
  {
    q: "Puan mı girmeliyim, sıralama mı?",
    a: "YKS'de başarı sırası, LGS'de yüzdelik dilim daha doğru sonuç verir; çünkü puanlar her yıl sınavın zorluğuna göre değişirken sıralama daha kararlıdır. Elinizde yalnızca puan varsa robot puana göre de çalışır.",
  },
  {
    q: "Kaç tercih yapabilirim?",
    a: "YKS'de en fazla 24 programı tercih edebilirsiniz. LGS'de merkezi sınavla öğrenci alan liseler için en fazla 5 tercih yapılır; adrese dayalı yerel yerleştirme tercihleri ayrıca yapılır. Güncel kuralları her yıl yayımlanan tercih kılavuzundan kontrol edin.",
  },
  {
    q: "Tercih listesi nasıl sıralanmalı?",
    a: "Listenin başına en çok istediğiniz ama iddialı okulları, ortasına puanınıza uygun olanları, sonuna da yerleşme ihtimalinizin yüksek olduğu güvenli tercihleri koyun. Listede hiç güvenli tercih yoksa hiçbir yere yerleşememe riski artar.",
  },
  {
    q: "Veriler nereden geliyor?",
    a: "YKS taban puanları ve kontenjanları ÖSYM'nin yayımladığı yerleştirme tablolarından, başarı sıraları YÖK Atlas'tan alınır. LGS verileri MEB yerleştirme sonuçlarına dayanan kamuya açık listelerden derlenir.",
  },
  {
    q: "Ücretli mi?",
    a: "Tercih robotunda arama ücretsizdir ve üyelik gerektirmez. Koçlar ve öğretmenler öğrencilerine tercih listesi hazırlamak, not almak ve çıktı vermek için Pi Koç'u, etüt merkezleri kurum panelini kullanır.",
  },
];

export default function PlacementLandingPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:py-14">
      <JsonLd
        data={[
          faqJsonLd(FAQ),
          {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Pi Kampüs LGS ve YKS tercih robotu",
            applicationCategory: "EducationalApplication",
            operatingSystem: "Web",
            inLanguage: "tr",
            offers: { "@type": "Offer", price: 0, priceCurrency: "TRY" },
          },
        ]}
      />
      <p className="text-sm font-bold uppercase tracking-wide text-brand-700">Ücretsiz · üyelik gerektirmez</p>
      <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl">LGS ve YKS tercih robotu</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-600">
        Puanınızı, başarı sıranızı ya da yüzdelik diliminizi girin; liseler ve üniversite programları geçen yılın taban değerlerine göre güvenli, uygun ve riskli diye ayrılsın. İl, okul türü ve üniversite türüne göre süzebilirsiniz.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/tercih-robotu/lgs" className="group rounded-3xl border border-ink-100 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <School className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-extrabold text-ink-900">LGS tercih robotu</h2>
          <p className="mt-1 text-sm text-slate-600">Lise taban puanları ve yüzdelik dilimler. Fen, Anadolu, Sosyal Bilimler, İmam Hatip ve meslek liseleri.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
            Liseleri bul <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
        <Link href="/tercih-robotu/yks" className="group rounded-3xl border border-ink-100 bg-white p-6 shadow-sm transition hover:border-brand-300 hover:shadow-md">
          <span className="inline-flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
            <University className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-xl font-extrabold text-ink-900">YKS tercih robotu</h2>
          <p className="mt-1 text-sm text-slate-600">Üniversite taban puanları ve başarı sıraları. Sayısal, eşit ağırlık, sözel, dil ve önlisans programları.</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-700">
            Programları bul <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
          </span>
        </Link>
      </div>

      <section className="mt-14">
        <h2 className="text-2xl font-bold text-ink-900">Sık sorulan sorular</h2>
        <dl className="mt-5 divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-white">
          {FAQ.map((item) => (
            <div key={item.q} className="p-5">
              <dt className="font-semibold text-ink-900">{item.q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mt-10 rounded-3xl bg-ink-900 p-6 text-white sm:p-8">
        <h2 className="text-xl font-bold">Öğrencilerinize tercih listesi mi hazırlıyorsunuz?</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink-200">
          Pi Koç&apos;ta öğrenci başına tercih listesi, not ve çıktı hazırlarsınız; hedef okulu seçince denemelerdeki puanla tabana ne kadar kaldığını takip edersiniz. Etüt merkezleri aynı özellikleri kurum panelinde kullanır.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/pi-koc" className="inline-flex min-h-11 items-center rounded-xl bg-brand-600 px-5 font-bold text-white hover:bg-brand-500">
            Pi Koç&apos;u ücretsiz deneyin
          </Link>
          <Link href="/kurumlar-icin" className="inline-flex min-h-11 items-center rounded-xl bg-white/10 px-5 font-bold text-white ring-1 ring-white/30 hover:bg-white/20">
            Kurum paneli
          </Link>
        </div>
      </section>
    </div>
  );
}
