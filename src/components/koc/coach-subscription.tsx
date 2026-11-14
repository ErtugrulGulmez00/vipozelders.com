import { Check, ChevronDown, Clock, MessageCircle, Sparkles, TrendingUp, Users, Video } from "lucide-react";
import { PI_KOC_CONSENT, whatsappLink } from "@/components/center/pricing";
import { RateBar } from "@/components/center/center-ui";
import { FEATURE_ICONS, TierIcon } from "@/components/koc/premium";
import { RedeemPromoForm } from "@/components/koc/promo-forms";
import { Badge } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { COACH_FREE_NAME, coachTierName, parseCoachTiers, type CoachFeature, type CoachPlan } from "@/lib/pi-koc";

// Pi Koç abonelik sayfası: üstte paket durumu, ortada paketler, altta gruplu özellikler ve ödeme bilgisi.

/** Özelliklerin tek satırlık açıklamaları (abonelik sayfası) */
const GROUPS: { title: string; Icon: typeof Users; items: { key: CoachFeature | "video"; anchor?: string; title: string; text: string }[] }[] = [
  {
    title: "Takip ve analiz",
    Icon: TrendingUp,
    items: [
      { key: "pdfImport", anchor: "pdf", title: "PDF'ten deneme aktarımı", text: "Yayınevi sonuç PDF'i tek seferde bütün öğrencilere işlenir" },
      { key: "topicAnalysis", anchor: "konu", title: "Konu eksik haritası", text: "Zayıf konular renkli görünür, tek tıkla programa eklenir" },
      { key: "targetSchool", title: "Hedef okul takibi", text: "Denemelerdeki puanla tabana ne kadar kaldığı" },
      { key: "lgsRobot", anchor: "lgs", title: "LGS ve YKS tercih listesi", text: "Öğrenci başına tercih listesi, not ve çıktı" },
    ],
  },
  {
    title: "Veli iletişimi",
    Icon: Users,
    items: [
      { key: "autoReport", anchor: "rapor", title: "Her hafta otomatik veli raporu", text: "Pazar akşamı velilere kendiliğinden gider" },
      { key: "branding", title: "Kendi markanızla rapor", text: "Raporda logonuz ve adınız; Pi Koç yazısı yok" },
      { key: "reminders", title: "Otomatik hatırlatmalar", text: "Kayıt girmeyen öğrenciye hatırlatma, size liste" },
    ],
  },
  {
    title: "Zaman kazandıranlar",
    Icon: Clock,
    items: [
      { key: "ai", anchor: "yz", title: "Yapay zekâ asistanı", text: "Haftalık yorum, özet ve yol haritası önerisi" },
      { key: "templates", title: "Hazır program kütüphanesi", text: "LGS, TYT, AYT ve okul dönemi için hazır haftalar" },
      { key: "fees", title: "Tahsilat takibi", text: "Kim ödedi, kim bekliyor, son 6 ayın tahsilatı" },
      { key: "video", title: "Süre sınırsız görüntülü ders", text: "Görüşme başına süre sınırı kalkar" },
      { key: "featured", title: "Vitrinde öne çıkma", text: "Özel ders vitrininde üst sıralarda görünürsünüz" },
    ],
  },
];

type Payment = { id: string; createdAt: Date; periodStart: Date; periodEnd: Date; months: number; method: string; amount: number };

export function CoachSubscription({
  plan,
  centerName,
  studentLimit,
  activeStudents,
  promoUntil,
  settings,
  whatsapp,
  payments,
}: {
  plan: CoachPlan;
  centerName: string;
  studentLimit: number;
  activeStudents: number;
  promoUntil: Date | null;
  settings: { piKocTiers: string; piKocFreeStudents: number; piKocFreeMeetingMinutes: number; piKocFreeAiPerMonth: number; centerBankInfo: string; contactEmail: string; contactPhone: string };
  whatsapp: string | null;
  payments: Payment[];
}) {
  const tiers = parseCoachTiers(settings.piKocTiers);
  const usage = activeStudents / Math.max(studentLimit, 1);
  const free = plan.state === "free";
  const planName = free ? COACH_FREE_NAME : coachTierName(plan.studentLimit);

  return (
    <div className="space-y-10">
      {/* Paket durumu: tek şerit */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" data-testid="coach-plan">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
          <div className="flex items-center gap-3">
            <TierIcon students={free ? 0 : plan.studentLimit} />
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paketiniz</p>
              <p className="text-lg font-extrabold text-ink-900">
                {planName}{" "}
                {free ? <Badge tone="slate">Ücretsiz</Badge> : plan.state === "promo" ? <Badge tone="green">Deneme kodu</Badge> : plan.state === "trial" ? <Badge tone="brand">Deneme</Badge> : <Badge tone="green">Ücretli</Badge>}
              </p>
              <p className="text-xs text-slate-500">{plan.endsAt ? `${formatDate(plan.endsAt)} tarihine kadar${plan.daysLeft !== null && plan.daysLeft > 0 ? ` (${plan.daysLeft} gün)` : ""}` : "Süresiz"}</p>
            </div>
          </div>
          <div className="min-w-56 flex-1">
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-slate-600">Aktif öğrenci</span>
              <span className="font-semibold text-slate-900">
                {activeStudents} / {studentLimit}
              </span>
            </div>
            <RateBar value={usage} tone={usage > 0.9 ? "rose" : usage > 0.75 ? "amber" : "brand"} />
          </div>
        </div>
        {plan.state === "promo" ? (
          <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Deneme kodunuzla bütün ücretli özellikler açık. Süre bitince ücretsiz pakete dönersiniz; devam etmek için aşağıdan bir paket seçebilirsiniz.
          </p>
        ) : null}
        {free && !promoUntil ? (
          <details id="kod" className="group mt-4 scroll-mt-24 border-t border-slate-100 pt-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-sm font-semibold text-brand-700 hover:underline [&::-webkit-details-marker]:hidden">
              Deneme kodunuz var mı? <ChevronDown className="size-4 transition group-open:rotate-180" aria-hidden />
            </summary>
            <p className="mt-2 text-sm text-slate-500">Size verilen kodu girin; süresince Rehber paketi (5 öğrenci, bütün ücretli özellikler) açılır. Kod hesap başına bir kez kullanılır.</p>
            <div className="mt-3 max-w-xl">
              <RedeemPromoForm />
            </div>
          </details>
        ) : null}
      </section>

      {/* Paketler */}
      <section>
        <h2 className="text-2xl font-extrabold tracking-tight text-ink-900">Paketinizi seçin</h2>
        <p className="mt-1 text-sm text-slate-600">
          Bütün ücretli paketlerde özellikler aynıdır; fark, aynı anda takip edebileceğiniz <b>öğrenci sayısıdır</b>. Fiyatlara KDV dahildir.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {settings.piKocFreeStudents > 0 ? (
            <div className={cn("flex flex-col rounded-3xl border bg-white p-5", free ? "border-slate-400 ring-2 ring-slate-200" : "border-slate-200")}>
              <div className="flex items-start justify-between gap-2">
                <TierIcon students={0} />
                {free ? <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Paketiniz</span> : null}
              </div>
              <p className="mt-4 text-lg font-extrabold text-ink-900">{COACH_FREE_NAME}</p>
              <p className="text-sm text-slate-500">{settings.piKocFreeStudents} öğrenciye kadar</p>
              <p className="mt-3 text-2xl font-black text-ink-900">Ücretsiz</p>
              <ul className="mt-3 space-y-1 text-xs text-slate-600">
                <li>Program, soru ve deneme takibi</li>
                <li>Görüşme başına {settings.piKocFreeMeetingMinutes} dk görüntülü ders</li>
                <li>Ayda bir otomatik veli raporu</li>
                {settings.piKocFreeAiPerMonth ? <li>Ayda {settings.piKocFreeAiPerMonth} yapay zekâ önerisi</li> : null}
              </ul>
            </div>
          ) : null}
          {tiers.map((t, i) => {
            const current = Boolean(plan.paid && t.students === studentLimit);
            const popular = i === 1;
            return (
              <div key={t.students} className={cn("relative flex flex-col rounded-3xl border p-5", popular ? "border-transparent bg-ink-950 text-white shadow-lg" : "border-slate-200 bg-white", current && "ring-2 ring-brand-400")}>
                <div className="flex items-start justify-between gap-2">
                  <TierIcon students={t.students} />
                  {current ? (
                    <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">Paketiniz</span>
                  ) : popular ? (
                    <span className="rounded-full bg-gold-400 px-2 py-0.5 text-[11px] font-extrabold text-ink-950">En çok seçilen</span>
                  ) : null}
                </div>
                <p className={cn("mt-4 text-lg font-extrabold", popular ? "text-white" : "text-ink-900")}>{t.name}</p>
                <p className={cn("text-sm", popular ? "text-ink-200" : "text-slate-500")}>{t.students} öğrenciye kadar</p>
                <p className={cn("mt-3 text-2xl font-black", popular ? "text-gold-300" : "text-ink-900")}>
                  {formatMoney(t.priceTl * 100)} <span className={cn("text-sm font-semibold", popular ? "text-ink-200" : "text-slate-500")}>/ ay</span>
                </p>
                <p className={cn("text-xs", popular ? "text-ink-200" : "text-slate-500")}>öğrenci başı {formatMoney(Math.round((t.priceTl / t.students) * 100))}</p>
                <div className="mt-auto pt-4">
                  {whatsapp && !current ? (
                    <a
                      href={whatsappLink(whatsapp, `Merhaba, Pi Koç ${t.name} paketini (${t.students} öğrenci, aylık ${formatMoney(t.priceTl * 100)}) almak istiyorum. Hesabım: ${centerName}. ${PI_KOC_CONSENT}`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "inline-flex min-h-10 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-xl text-sm font-bold",
                        popular ? "bg-gold-400 text-ink-950 hover:bg-gold-300" : "bg-emerald-600 text-white hover:bg-emerald-700",
                      )}
                    >
                      <MessageCircle className="size-4" aria-hidden /> Satın al
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-slate-500">&quot;Satın al&quot; WhatsApp&apos;ta hazır bir mesaj açar; ödemeyi havale / EFT ile yaparsınız, kaydedilince paketiniz açılır.</p>
      </section>

      {/* Ücretli pakette açılanlar: üç grup */}
      <section>
        <h2 className="flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink-900">
          <Sparkles className="size-5 text-gold-500" aria-hidden /> Ücretli pakette açılanlar
        </h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {GROUPS.map(({ title, Icon, items }) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-white p-5">
              <p className="flex items-center gap-2 font-bold text-ink-900">
                <span className="inline-flex size-8 items-center justify-center rounded-xl bg-gold-400/20 text-gold-700">
                  <Icon className="size-4" aria-hidden />
                </span>
                {title}
              </p>
              <ul className="mt-4 space-y-3">
                {items.map((item) => {
                  const ItemIcon = item.key === "video" ? Video : FEATURE_ICONS[item.key];
                  return (
                    <li key={item.key} id={item.anchor} className="flex scroll-mt-24 gap-3 rounded-xl target:bg-gold-50 target:ring-2 target:ring-gold-300">
                      <ItemIcon className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                      <span>
                        <span className="block text-sm font-semibold text-ink-900">{item.title}</span>
                        <span className="block text-xs text-slate-500">{item.text}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Ödeme bilgisi ve geçmişi */}
      <section className={cn("grid gap-4", payments.length ? "lg:grid-cols-[1fr_1.2fr]" : "")}>
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          <p className="font-bold text-ink-900">Ödeme</p>
          <p className="mt-2">Paketin tutarını havale / EFT ile gönderin; açıklamaya adınızı ve paketi yazın (ör. &quot;{centerName} · Mentor&quot;). Ödemeniz kaydedilince paketiniz açılır. Süre bitip yenilenmezse ücretsiz pakete dönersiniz; kayıtlarınız silinmez.</p>
          {settings.centerBankInfo ? <p className="mt-3 whitespace-pre-line rounded-xl bg-white p-3 font-mono text-xs">{settings.centerBankInfo}</p> : null}
          <p className="mt-3 text-xs text-slate-500">
            Sorularınız için {settings.contactEmail}
            {settings.contactPhone ? ` · ${settings.contactPhone}` : ""}
          </p>
        </div>
        {payments.length ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="font-bold text-ink-900">Ödemeleriniz</p>
          {payments.length ? (
            <ul className="mt-3 divide-y divide-slate-100 text-sm">
              {payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="flex items-center gap-2 text-slate-600">
                    <Check className="size-4 text-emerald-600" aria-hidden />
                    {formatDate(p.createdAt)} · {formatDate(p.periodStart)} – {formatDate(p.periodEnd)} ({p.months} ay)
                  </span>
                  <span className="font-semibold text-ink-900">{formatMoney(p.amount)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Henüz ödeme yok.</p>
          )}
        </div>
        ) : null}
      </section>
    </div>
  );
}
