import {
  BellRing,
  BookOpenCheck,
  CalendarClock,
  CalendarRange,
  Check,
  ClipboardCheck,
  GraduationCap,
  LineChart,
  Megaphone,
  Receipt,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EditionCards, TierCards } from "@/components/center/pricing";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { centerPlans } from "@/server/center/plans";
import { getCities, getSiteSettings } from "@/server/site";
import { CenterApplicationForm } from "./center-application-form";

export const metadata: Metadata = {
  title: "Etüt merkezi ve dershane yönetim paneli",
  description: "Öğrenci ve veli takibi, yoklama ve devamsızlık bildirimi, deneme analizi ve eksik konular, ödeme planı, tahsilat ve makbuz: etüt merkeziniz ya da dershaneniz için tek panel.",
};

const FEATURES = [
  { Icon: Users, title: "Öğrenci ve veli kayıtları", text: "Okul, sınıf, hedef sınav, veli bilgileri ve notlar tek kartta. Excel listenizi bir seferde aktarın." },
  { Icon: ClipboardCheck, title: "Yoklama ve devamsızlık bildirimi", text: "Programdaki her ders için tek dokunuşla yoklama; gelmeyen öğrencinin velisine anında e-posta ve uygulama bildirimi." },
  { Icon: BookOpenCheck, title: "Deneme analizi", text: "LGS, TYT, AYT şablonları; D/Y ya da cevap anahtarıyla okuma, net ve kurum sıralaması, ders ve konu analizi." },
  { Icon: LineChart, title: "Eksik konular ve karne", text: "Her öğrencinin zayıf konuları, net gelişim grafiği ve yazdırılabilir deneme karnesi otomatik hazırlanır." },
  { Icon: Wallet, title: "Ödeme planı ve tahsilat", text: "Peşinat, indirim ve taksitler; tahsilat en eski taksitten düşer, sıra numaralı makbuz çıkar." },
  { Icon: BellRing, title: "Otomatik ödeme hatırlatma", text: "Vadesi yaklaşan ve geciken taksitler için velilere otomatik hatırlatma; gecikenler listesi tek ekranda." },
  { Icon: CalendarRange, title: "Ders programı", text: "Sınıflar, öğretmenler ve derslikler için çakışma uyarılı haftalık program; yazdırıp panoya asın." },
  { Icon: CalendarClock, title: "Etüt planlama", text: "Birebir ve küçük grup etütleri; öğretmen, derslik ve öğrenci çakışmasını sistem yakalar." },
  { Icon: Receipt, title: "Gider ve gelir raporu", text: "Kira, maaş, fatura giderleri; aylık gelir-gider grafiği ve Excel çıktıları." },
  { Icon: Megaphone, title: "Duyurular", text: "Tüm kuruma ya da bir sınıfa duyuru; veliye e-posta ve uygulama bildirimi." },
  { Icon: UserPlus, title: "Ön kayıt ve vitrin sayfası", text: "Kurumunuzun Pi Kampüs'teki tanıtım sayfasından gelen ön kayıtlar doğrudan panelinize düşer." },
  { Icon: ShieldCheck, title: "Personel yetkileri", text: "Müdür, öğretmen ve muhasebe rolleri; herkes yalnızca kendi bölümünü görür. Tüm işlemler kayıt altında." },
];

const faq = (trialDays: number) => [
  { q: "Kurulum ne kadar sürer?", a: "Aynı gün. Öğrenci listenizi Excel'den aktarır, sınıflarınızı ve ders programınızı girersiniz; isterseniz ekibimiz kurulumu sizinle birlikte yapar." },
  { q: "Veriler güvende mi?", a: "Veriler şifreli bağlantıyla taşınır, T.C. kimlik numaraları veritabanında şifreli saklanır. Her personel yalnızca yetkili olduğu bölümleri görür ve yapılan işlemler kayıt altına alınır." },
  ...(trialDays > 0
    ? [{ q: "Ücretsiz deneme var mı?", a: `Evet, ${trialDays} gün ücretsiz deneyebilirsiniz; kart bilgisi istenmez. Süre bitince kayıtlarınız silinmez, panel salt okunur olur; aboneliğinizi başlatınca kaldığınız yerden devam edersiniz.` }]
    : []),
  { q: "Veliler ne görür?", a: "Davet bağlantısıyla ücretsiz veli hesabına bağlanan veli; devamsızlığı, etütleri, yayınladığınız deneme sonuçlarını ve eksik konuları, ödeme planını ve duyuruları görür." },
  { q: "Velilere bildirim nasıl gidiyor?", a: "Devamsızlık, ödeme hatırlatma ve duyurular velilere e-posta ve veli portalı / uygulama bildirimi olarak gider; her planda ücretsizdir." },
  { q: "Telefondan kullanılır mı?", a: "Evet. Panel telefon ve tabletle uyumludur; öğretmenler yoklamayı sınıfta telefondan alabilir." },
];

export default async function ForCentersPage() {
  const [settings, cities] = await Promise.all([getSiteSettings(), getCities()]);
  const plans = centerPlans(settings);
  const trialDays = settings.centerTrialDays;
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-950 via-brand-900 to-brand-700 text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-gold-300">
              <GraduationCap className="size-3.5" aria-hidden /> Etüt merkezleri, dershaneler ve kurslar için
            </p>
            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">Kurumunuzun tamamı tek panelde</h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">
              Yoklama, deneme analizi, veli iletişimi ve muhasebe: defter, Excel ve WhatsApp grupları arasında kaybolmayın.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#basvuru" className={buttonClasses("gold", "lg")}>
                {trialDays > 0 ? `${trialDays} gün ücretsiz deneyin` : "Hemen başvurun"}
              </a>
              <a href="#planlar" className={buttonClasses("outline", "lg", "border-white/30 bg-white/10 text-white hover:bg-white/20")}>
                Planlar ve fiyatlar
              </a>
            </div>
            <p className="mt-4 text-sm text-brand-100">
              Zaten müşterimiz misiniz?{" "}
              <Link href="/kurum-giris" className="font-semibold text-white underline">
                Kurum paneli girişi
              </Link>
            </p>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-100">
              {[trialDays > 0 ? "Kart bilgisi gerekmez" : "Telefondan kullanım", "Birebir kurulum desteği", "Sınırsız personel"].map((t) => (
                <li key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-gold-300" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <PanelPreview />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Bir etüt merkezinin ihtiyaç duyduğu her şey</h2>
        <p className="mt-2 max-w-2xl text-slate-600">Öğretmenleriniz derse, sekreteriniz tahsilata, siz de kurumunuzun gelişimine odaklanın.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ Icon, title, text }) => (
            <Card key={title} className="p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{text}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Veliler her şeyi telefonundan görür</h2>
            <p className="mt-3 text-slate-600">
              Veli portalında çocuğunun devamsızlığını, deneme netlerini ve eksik konularını, ödeme planını ve duyurularınızı takip eder. Telefon trafiğiniz azalır, veli memnuniyeti artar.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-slate-700">
              {[
                "Derse gelmeyen öğrenci için anında bildirim",
                "Deneme karnesi, net gelişim grafiği ve kurum sıralaması",
                "Eksik konular için Pi Kampüs'ün onaylı özel ders öğretmenlerine tek tıkla ulaşım",
                "Taksit hatırlatmaları ve ödeme geçmişi",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="mx-auto w-full max-w-sm rounded-[2rem] border-8 border-slate-900 bg-slate-50 p-4 shadow-xl">
            <p className="text-xs font-semibold text-brand-700">Veli portalı</p>
            <p className="text-lg font-bold text-slate-900">Ali Yılmaz · 8-A</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white p-3 shadow-xs">
                <p className="text-[11px] text-slate-500">Son deneme</p>
                <p className="text-xl font-bold text-slate-900">74,33 net</p>
                <p className="text-[11px] text-emerald-600">▲ 6,0 gelişim</p>
              </div>
              <div className="rounded-xl bg-white p-3 shadow-xs">
                <p className="text-[11px] text-slate-500">Devam</p>
                <p className="text-xl font-bold text-slate-900">%96</p>
                <p className="text-[11px] text-slate-500">2 devamsızlık</p>
              </div>
            </div>
            <div className="mt-2 rounded-xl bg-white p-3 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500">Eksik konular</p>
              {[
                ["Üslü ifadeler", 40],
                ["Basınç", 45],
                ["Fiilimsiler", 48],
              ].map(([topic, rate]) => (
                <div key={topic} className="mt-1.5">
                  <div className="flex justify-between text-xs">
                    <span>{topic}</span>
                    <span className="font-semibold text-rose-600">%{rate}</span>
                  </div>
                  <div className="mt-0.5 h-1.5 rounded-full bg-slate-100">
                    <div className="h-1.5 rounded-full bg-rose-500" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 rounded-xl bg-white p-3 text-xs shadow-xs">
              <p className="font-semibold text-slate-500">Sonraki taksit</p>
              <p className="mt-0.5 flex justify-between">
                <span>15 Kasım</span> <span className="font-bold">₺2.500</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="planlar" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Paketler</h2>
        <p className="mt-2 text-slate-600">Kurumunuzun çalışma şekline göre paketi seçin; fiyat yalnızca aktif öğrenci sayısına göre değişir. Tüm paketlerde sınırsız personel ve veli portalı.</p>
        <div className="mt-8">
          <EditionCards cta={{ href: "#basvuru", label: trialDays > 0 ? "Ücretsiz deneyin" : "Başvurun" }} />
        </div>
        <h3 className="mt-12 text-xl font-bold text-slate-900">Öğrenci sayısına göre fiyat</h3>
        <p className="mt-1 text-sm text-slate-600">İki pakette de aynı. Yıllık ödemede daha avantajlı.</p>
        <div className="mt-6">
          <TierCards plans={plans} />
        </div>
      </section>

      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 lg:grid-cols-[1fr_440px]">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Sık sorulan sorular</h2>
            <div className="mt-6 space-y-3">
              {faq(trialDays).map((item) => (
                <details key={item.q} className="group rounded-xl border border-slate-200 bg-slate-50 p-4 open:bg-white">
                  <summary className="cursor-pointer list-none font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">{item.q}</summary>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
          <Card id="basvuru" className="h-fit scroll-mt-20 p-6">
            <h2 className="text-xl font-bold text-slate-900">Kurum başvurusu</h2>
            <p className="mt-1 mb-5 text-sm text-slate-500">
              Ekibimiz sizi arayıp paneli birlikte kurar.{trialDays > 0 ? ` İlk ${trialDays} gün ücretsizdir.` : ""}
            </p>
            <CenterApplicationForm cities={cities.map((c) => ({ id: c.id, name: c.name }))} />
          </Card>
        </div>
      </section>
    </>
  );
}

/** Tanıtım için kurum paneli önizlemesi (gerçek veri değil). */
function PanelPreview() {
  return (
    <div className="relative hidden lg:block" aria-hidden>
      <div className="rounded-2xl bg-white p-4 text-slate-900 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold">Başarı Etüt Merkezi</p>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">Aktif</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            ["Aktif öğrenci", "184"],
            ["Bugün gelmeyen", "3"],
            ["Bu ay tahsilat", "₺312.400"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-100 p-2.5">
              <p className="text-[10px] text-slate-500">{label}</p>
              <p className="text-base font-bold">{value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-slate-100 p-3">
          <p className="text-[11px] font-semibold text-slate-500">Bugünkü dersler</p>
          {[
            ["16:00", "8-A · Matematik", "Tam katılım", "bg-emerald-50 text-emerald-700"],
            ["16:50", "8-B · Fen Bilimleri", "2 gelmedi", "bg-amber-50 text-amber-800"],
            ["17:40", "12-SAY · Fizik", "Yoklama al", "bg-brand-50 text-brand-700"],
          ].map(([time, title, status, tone]) => (
            <div key={title} className="mt-2 flex items-center justify-between text-xs">
              <span>
                <span className="font-semibold">{time}</span> {title}
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${tone}`}>{status}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-slate-100 p-3">
          <p className="text-[11px] font-semibold text-slate-500">LGS Deneme 4 · ders ortalamaları</p>
          {[
            ["Türkçe", 72],
            ["Matematik", 58],
            ["Fen", 66],
            ["İnkılap", 81],
          ].map(([name, rate]) => (
            <div key={name} className="mt-1.5 flex items-center gap-2 text-[11px]">
              <span className="w-16">{name}</span>
              <div className="h-2 flex-1 rounded-full bg-slate-100">
                <div className={`h-2 rounded-full ${Number(rate) >= 70 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${rate}%` }} />
              </div>
              <span className="w-8 text-right font-semibold">%{rate}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-6 rounded-xl bg-white px-4 py-3 text-xs text-slate-800 shadow-xl">
        <p className="font-semibold">📩 Veliye bildirildi</p>
        <p className="text-slate-500">Öğrenciniz Ali 16:50 Fen dersine katılmamıştır.</p>
      </div>
    </div>
  );
}
