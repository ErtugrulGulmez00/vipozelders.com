import { BadgeCheck, CalendarClock, PenLine, ShieldCheck, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/primitives";
import { getCities, getSiteSettings } from "@/server/site";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = {
  title: "Öğretmen olarak katılın",
  description: "Kendi fiyatınızı ve takviminizi belirleyin; öğrencilere online veya yüz yüze ulaşın. Ödemeniz güvencede.",
};

export default async function BecomeTeacherPage() {
  const [settings, cities] = await Promise.all([getSiteSettings(), getCities()]);
  const commission = (settings.commissionRateBps / 100).toLocaleString("tr-TR");
  const benefits = [
    { Icon: Wallet, title: "Kendi fiyatınız", text: `Her ders ve kademe için ücreti siz belirlersiniz. Platform hizmet bedeli yalnızca tamamlanan derslerden %${commission}.` },
    { Icon: CalendarClock, title: "Kendi takviminiz", text: "Haftalık müsait saatlerinizi girin; veliler yalnızca boş saatlerinizden randevu alır, onayı siz verirsiniz." },
    { Icon: PenLine, title: "Site içi sanal sınıf", text: "Kamera, ekran paylaşımı, sohbet ve ortak beyaz tahta. Ek program ya da bağlantı paylaşmak gerekmez." },
    { Icon: ShieldCheck, title: "Ödemeniz güvencede", text: `Veli dersi rezervasyonda öder; ders tamamlanıp ${settings.disputeWindowHours} saatlik itiraz süresi dolunca hakedişiniz serbest kalır.` },
  ];
  const steps = ["Formu doldurun", "Kısa görüşme ve belge kontrolü", "Öğretmen hesabınız açılır", "Profilinizi tamamlayıp ders vermeye başlayın"];

  return (
    <>
      <section className="bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 text-white">
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
