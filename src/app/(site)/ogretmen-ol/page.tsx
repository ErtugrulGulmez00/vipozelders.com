import { BadgeCheck, CalendarClock, PenLine, ShieldCheck, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { parsePayoutDays } from "@/server/pricing";
import { getCities, getSiteSettings } from "@/server/site";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = {
  title: "Öğretmen olarak katılın",
  description: "Kendi fiyatınızı ve takviminizi belirleyin; öğrencilere online veya yüz yüze ulaşın. Ödemeniz güvencede.",
};

export default async function BecomeTeacherPage() {
  const [settings, cities] = await Promise.all([getSiteSettings(), getCities()]);
  const commission = (settings.commissionRateBps / 100).toLocaleString("tr-TR");
  const payoutDays = parsePayoutDays(settings.payoutDays);
  const payoutText = payoutDays.length ? `Her ayın ${payoutDays.join(" ve ")}. günü IBAN'ınıza havale edilir.` : "IBAN'ınıza havale edilir.";
  // Örnek: 60 dakikası 1.000 ₺ olan bir ders
  const examplePrice = 100_000;
  const exampleNet = Math.round(examplePrice * (1 - settings.commissionRateBps / 10_000));
  const faq = [
    { q: "Öğrenci bulabilecek miyim?", a: "Veliler sizi kademe, ders ve fiyata göre aramada bulur; profiliniz ne kadar dolu (fotoğraf, tanıtım, uygun saatler) olursa o kadar üstte çıkarsınız. Ayrıca soru havuzundan soru çözerek ve ücretsiz tanışma görüşmesi sunarak ilk öğrencilerinize daha hızlı ulaşırsınız." },
    { q: "Ders vermezsem ücret öder miyim?", a: `Hayır. Üyelik, aylık ücret ya da ilan bedeli yoktur. Hizmet bedeli (%${commission}) yalnızca tamamlanan derslerden kesilir.` },
    { q: "Soru çözerek de kazanabilir miyim?", a: `Evet. Onaylı öğretmenler soru havuzundaki soruları üstlenip çözebilir; çözülen soru başına ${formatMoney(settings.poolTeacherFeeTl * 100)} kazanırsınız.` },
    { q: "Vergi durumum ne olacak?", a: "Özel ders gelirinizin vergilendirilmesi kendi statünüze bağlıdır (serbest meslek, şahıs şirketi ya da esnaf muafiyeti gibi). Hakedişleriniz adınıza dekontla ödenir; kendi durumunuz için mali müşavirinize danışmanızı öneririz." },
    { q: "Devlet okulunda kadrolu öğretmenim, başvurabilir miyim?", a: "Kadrolu öğretmenlerin ücretli özel ders vermesi mevzuatla sınırlandırılmıştır. Başvuru sırasında statünüzü beyan edersiniz; mevzuatın size izin verdiğinden emin olmanız gerekir." },
  ];
  const benefits = [
    { Icon: Wallet, title: "Kendi fiyatınız", text: `Her ders ve kademe için ücreti siz belirlersiniz. Platform hizmet bedeli yalnızca tamamlanan derslerden %${commission}.` },
    { Icon: CalendarClock, title: "Kendi takviminiz", text: "Haftalık müsait saatlerinizi girin; veliler yalnızca boş saatlerinizden randevu alır, onayı siz verirsiniz." },
    { Icon: PenLine, title: "Site içi sanal sınıf", text: "Kamera, ekran paylaşımı, sohbet ve ortak beyaz tahta. Ek program ya da bağlantı paylaşmak gerekmez." },
    { Icon: ShieldCheck, title: "Ödemeniz güvencede", text: `Veli dersi önceden öder, para bizde güvende bekler. Ders yapıldıktan sonra kazancınız en geç ${settings.settlementDays} gün içinde ödenebilir bakiyenize geçer. ${payoutText}` },
  ];
  const steps = ["Formu doldurun", "Kısa görüşme ve belge kontrolü", "Öğretmen hesabınız açılır", "Profilinizi tamamlayıp ders vermeye başlayın"];

  return (
    <>
      <section className="bg-ink-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300">
            <Users className="size-3.5" aria-hidden /> Öğretmen ağımıza katılın
          </p>
          <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Bilginizi daha çok öğrenciye ulaştırın</h1>
          <p className="mt-3 max-w-2xl text-brand-100">Okul öncesinden üniversite sınavına kadar her kademede öğretmen arıyoruz. Başvurun, ekibimiz sizinle iletişime geçsin.</p>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_440px]">
        <div className="space-y-8">
          <div className="grid gap-4 sm:grid-cols-2">
            {benefits.map(({ Icon, title, text }) => (
              <Card key={title} className="p-5">
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-3 font-semibold text-slate-900">{title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
              </Card>
            ))}
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <h2 className="font-semibold text-slate-900">Örnek kazanç</h2>
            <dl className="mt-3 space-y-1.5 text-sm text-slate-700">
              <div className="flex justify-between gap-3">
                <dt>Velinin ödediği ders ücreti</dt>
                <dd className="font-semibold">{formatMoney(examplePrice)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Platform hizmet bedeli (%{commission})</dt>
                <dd className="font-semibold">−{formatMoney(examplePrice - exampleNet)}</dd>
              </div>
              <div className="flex justify-between gap-3 border-t border-emerald-200 pt-1.5 text-base">
                <dt className="font-semibold text-slate-900">Sizin kazancınız</dt>
                <dd className="font-bold text-emerald-700">{formatMoney(exampleNet)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-slate-500">Haftada 10 ders verirseniz ayda yaklaşık {formatMoney(exampleNet * 40)} kazanırsınız. Ücretinizi kendiniz belirlersiniz.</p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Süreç nasıl işliyor?</h2>
            <ol className="mt-4 space-y-3">
              {steps.map((step, index) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{index + 1}</span>
                  <span className="text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-2xl bg-slate-100 p-5 text-sm text-slate-600">
            <p className="flex items-center gap-2 font-semibold text-slate-900">
              <BadgeCheck className="size-4 text-emerald-600" aria-hidden /> Hangi belgeler isteniyor?
            </p>
            <p className="mt-1">
              Hesabınız açıldıktan sonra öğretmen panelinden kimlik ve diploma yüklersiniz; yüz yüze ders verecekseniz e-Devlet’ten alınmış barkodlu adli sicil kaydı da istenir. Doğrulanan öğretmenler profilinde “Onaylı öğretmen” rozeti taşır.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Sık sorulan sorular</h2>
            <div className="mt-4 space-y-3">
              {faq.map((item) => (
                <details key={item.q} className="rounded-xl border border-slate-200 bg-white p-4">
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">{item.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </div>

        <Card className="h-fit p-6 lg:sticky lg:top-20">
          <h2 className="text-xl font-bold text-slate-900">Başvuru formu</h2>
          <p className="mt-1 mb-5 text-sm text-slate-500">Birkaç dakikanızı alır. Bilgileriniz yalnızca başvurunuzu değerlendirmek için kullanılır.</p>
          <ApplicationForm cities={cities.map((c) => ({ id: c.id, name: c.name }))} />
        </Card>
      </div>
    </>
  );
}
