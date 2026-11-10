import { AlertTriangle, BookOpenCheck, CalendarCheck2, CheckCircle2, ListChecks, PlusCircle, Target, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { BarChart } from "@/components/koc/charts";
import { meetingLabel, StudentAvatar, StudentCard } from "@/components/koc/student-card";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { kocOverview, questionStats } from "@/server/koc";

export const metadata: Metadata = { title: "Genel bakış" };

function Kpi({ icon, label, value, hint, tone = "ink" }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "ink" | "brand" }) {
  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center gap-2">
        <span className={cn("inline-flex size-8 items-center justify-center rounded-xl", tone === "brand" ? "bg-brand-50 text-brand-600" : "bg-ink-50 text-ink-600")}>{icon}</span>
        <p className="text-sm font-medium text-slate-500">{label}</p>
      </div>
      <p className="mt-3 font-display text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default async function KocHome() {
  await connection();
  const ctx = await requireCenter();
  const today = toLocalDateString(new Date());
  const [overview, stats] = await Promise.all([kocOverview(ctx, today), questionStats(ctx.center.id, today)]);
  const { cards, todayWeekday } = overview;
  const withMeeting = cards.filter((c) => c.meeting);
  const met = withMeeting.filter((c) => c.metThisWeek).length;
  const planTotal = cards.reduce((t, c) => t + c.planTotal, 0);
  const planDone = cards.reduce((t, c) => t + c.planDone, 0);
  const todays = cards.filter((c) => c.meeting?.weekday === todayWeekday).sort((a, b) => (a.meeting?.minute ?? 0) - (b.meeting?.minute ?? 0));
  const attention = cards.filter((c) => c.alerts.length).slice(0, 6);
  const diff = stats.thisWeek - stats.lastWeek;
  const hour = Number(new Intl.DateTimeFormat("tr-TR", { hour: "numeric", hour12: false, timeZone: "Europe/Istanbul" }).format(new Date()));
  const greet = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";

  return (
    <>
      <section className="relative mb-6 overflow-hidden rounded-[2rem] bg-ink-900 px-6 py-7 text-white sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-60 rounded-full bg-gold-400/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-medium text-ink-200">
              {WEEKDAY_NAMES[todayWeekday - 1]}, {formatDate(new Date())}
            </p>
            <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {greet} {ctx.user.firstName}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-ink-200">
              {cards.length === 0
                ? "İlk öğrencinizi ekleyin; görüşmeler, program, soru takibi ve deneme grafikleri burada toplanır."
                : todays.length
                  ? `Bugün ${todays.length} görüşmeniz var. Bu hafta ${withMeeting.length} görüşmenin ${met} tanesi yapıldı.`
                  : `Bugün planlı görüşme yok. Bu hafta ${withMeeting.length} görüşmenin ${met} tanesi yapıldı.`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/koc/ogrenciler/yeni" className="shadow-lg shadow-brand-900/30">
              <PlusCircle className="size-4" aria-hidden /> Öğrenci ekle
            </LinkButton>
            <LinkButton href="/koc/hafta" variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/15">
              <CalendarCheck2 className="size-4" aria-hidden /> Haftalık görüşmeler
            </LinkButton>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Kpi icon={<Users className="size-4" />} label="Aktif öğrenci" value={`${cards.length}`} hint={`Plan sınırı ${ctx.center.studentLimit}`} />
        <Kpi icon={<CalendarCheck2 className="size-4" />} label="Bu hafta görüşme" value={`${met}/${withMeeting.length}`} hint={withMeeting.length ? `${withMeeting.length - met} görüşme kaldı` : "Görüşme günü girilmedi"} />
        <Kpi
          tone="brand"
          icon={<Target className="size-4" />}
          label="Bu hafta çözülen soru"
          value={stats.thisWeek.toLocaleString("tr-TR")}
          hint={stats.lastWeek || stats.thisWeek ? `Geçen hafta ${stats.lastWeek.toLocaleString("tr-TR")} (${diff >= 0 ? "+" : ""}${diff.toLocaleString("tr-TR")})` : "Soru takibi öğrenci sayfasında"}
        />
        <Kpi icon={<ListChecks className="size-4" />} label="Program tamamlama" value={planTotal ? `%${Math.round((planDone / planTotal) * 100)}` : "—"} hint={planTotal ? `${planDone}/${planTotal} madde` : "Bu hafta program yok"} />
      </div>

      {cards.length ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <Card>
            <CardHeader title="Son 14 gün çözülen soru" description="Tüm öğrencilerin günlük toplamı" />
            <CardBody>
              <BarChart label="Son 14 gün çözülen soru" bars={stats.days.map((d) => ({ label: d.date.slice(8), value: d.solved, hint: `${d.date.slice(8)}.${d.date.slice(5, 7)}` }))} />
            </CardBody>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="Bugünkü görüşmeler" action={<Link href="/koc/hafta" className="text-sm font-semibold text-brand-700 hover:underline">Hafta</Link>} />
              {todays.length ? (
                <ul className="divide-y divide-slate-100">
                  {todays.map((s) => (
                    <li key={s.id}>
                      <Link href={`/koc/ogrenciler/${s.id}?sekme=gorusmeler`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                        <StudentAvatar id={s.id} firstName={s.firstName} lastName={s.lastName} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-ink-900">{s.name}</span>
                          <span className="text-xs text-slate-500">{meetingLabel(s.meeting)}</span>
                        </span>
                        {s.metThisWeek ? <CheckCircle2 className="size-5 text-emerald-500" aria-label="Görüşme yapıldı" /> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardBody>
                  <p className="text-sm text-slate-500">Bugün planlı görüşme yok.</p>
                </CardBody>
              )}
            </Card>
            <Card>
              <CardHeader title="Dikkat isteyenler" />
              {attention.length ? (
                <ul className="divide-y divide-slate-100">
                  {attention.map((s) => (
                    <li key={s.id}>
                      <Link href={`/koc/ogrenciler/${s.id}`} className="flex items-start gap-3 px-5 py-3 hover:bg-slate-50">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink-900">{s.name}</span>
                          <span className="text-xs text-slate-600">{s.alerts.join(" · ")}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <CardBody>
                  <p className="text-sm text-slate-500">Her şey yolunda görünüyor.</p>
                </CardBody>
              )}
            </Card>
          </div>
        </div>
      ) : null}

      <div className="mt-8 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-extrabold tracking-tight text-ink-900">Öğrencilerim</h2>
        {cards.length ? (
          <Link href="/koc/ogrenciler" className="text-sm font-semibold text-brand-700 hover:underline">
            Tümü
          </Link>
        ) : null}
      </div>
      {cards.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cards.slice(0, 9).map((s) => (
            <StudentCard key={s.id} s={s} />
          ))}
        </div>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            [<Users key="i" className="size-5" />, "1. Öğrencinizi ekleyin", "Sınıf, hedef ve haftalık görüşme gününü yazın."],
            [<ListChecks key="i" className="size-5" />, "2. Haftalık program yapın", "Gün gün ders, konu, kaynak ve hedef soru."],
            [<BookOpenCheck key="i" className="size-5" />, "3. Soru ve denemeleri girin", "Grafikler kendiliğinden oluşur, gelişimi izlersiniz."],
          ].map(([icon, title, text]) => (
            <div key={String(title)} className="rounded-3xl border border-ink-100 bg-white p-5">
              <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
              <p className="mt-3 font-semibold text-ink-900">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{text}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
