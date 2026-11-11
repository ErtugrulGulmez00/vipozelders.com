import { CalendarClock, CheckCircle2, Quote, XCircle } from "lucide-react";
import { PiMark } from "@/components/site/pi-mark";
import { formatNet } from "@/lib/center/exams";
import { cn } from "@/lib/cn";
import type { WeeklyReportData } from "@/server/koc-report";
import { formatMinutes } from "@/lib/koc-format";
import { BarChart, HBarList, Ring } from "./charts";

const dmy = (d: string) => d.split("-").reverse().join(".");
const pct = (v: number | null) => (v === null ? "—" : `%${Math.round(v * 100)}`);

/** Haftalık koçluk raporu (koç önizlemesi ve velinin açtığı bağlantı aynı görünümü kullanır; yazdırmaya uygundur). */
export function WeeklyReport({ data, note }: { data: WeeklyReportData; note: string | null }) {
  const { student } = data;
  const diff = data.solved - data.previousSolved;
  const planRate = data.plan.total ? data.plan.done / data.plan.total : null;
  return (
    <article className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] border border-ink-100 bg-white shadow-sm print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <header className="relative overflow-hidden bg-ink-900 px-6 py-7 text-white sm:px-9 print:bg-ink-900">
        <div className="pointer-events-none absolute -right-14 -top-20 size-64 rounded-full bg-brand-600/40 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-300">Haftalık koçluk raporu</p>
            <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
              {student.firstName} {student.lastName}
            </h1>
            <p className="mt-1.5 text-sm text-ink-200">
              {dmy(data.weekStart)} – {dmy(data.weekEnd)}
              {[student.gradeName, student.targetExam].filter(Boolean).length ? ` · ${[student.gradeName, student.targetExam].filter(Boolean).join(" · ")}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-10 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <PiMark className="size-6" />
            </span>
            <span className="text-right leading-tight">
              <span className="block text-sm font-bold">{student.center.name}</span>
              <span className="block text-xs text-ink-300">Pi Koç</span>
            </span>
          </div>
        </div>
      </header>

      <div className="space-y-8 px-6 py-7 sm:px-9">
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Çözülen soru" value={data.solved.toLocaleString("tr-TR")} hint={data.previousSolved || data.solved ? `Geçen hafta ${data.previousSolved.toLocaleString("tr-TR")} (${diff >= 0 ? "+" : ""}${diff.toLocaleString("tr-TR")})` : "Bu hafta giriş yok"} good={data.solved || data.previousSolved ? diff >= 0 : undefined} />
          <Kpi label="Doğruluk" value={pct(data.accuracy)} hint="Doğru / (doğru + yanlış)" />
          <Kpi label="Programa uyum" value={pct(planRate)} hint={data.plan.total ? `${data.plan.done}/${data.plan.total} görev` : "Program yazılmadı"} />
          <Kpi label="Çalışma süresi" value={data.studyMinutes ? formatMinutes(data.studyMinutes) : "—"} hint={`${data.activeDays}/7 gün çalıştı`} />
        </section>

        {note ? (
          <section className="rounded-3xl bg-brand-50 p-5 sm:p-6 print:break-inside-avoid">
            <p className="flex items-center gap-2 text-sm font-bold text-brand-800">
              <Quote className="size-4" aria-hidden /> Koçun değerlendirmesi
            </p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-900">{note}</p>
          </section>
        ) : null}

        <section className="grid gap-6 md:grid-cols-[1.3fr_1fr] print:break-inside-avoid">
          <div>
            <h2 className="mb-3 text-sm font-bold text-ink-900">Gün gün çözülen soru</h2>
            <BarChart label="Gün gün çözülen soru" height={190} bars={data.days.map((d) => ({ label: d.label, value: d.solved, hint: dmy(d.date) }))} />
          </div>
          <div>
            <h2 className="mb-3 text-sm font-bold text-ink-900">Derslere göre</h2>
            {data.subjects.length ? (
              <HBarList rows={data.subjects.slice(0, 6).map((s) => ({ label: s.subject, value: s.solved, max: data.subjects[0].solved, display: `${s.solved}${s.accuracy !== null ? ` · ${pct(s.accuracy)}` : ""}`, hint: `${s.correct} doğru, ${s.wrong} yanlış` }))} />
            ) : (
              <p className="text-sm text-slate-500">Bu hafta soru girilmedi.</p>
            )}
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 print:break-inside-avoid">
          <div className="rounded-3xl border border-ink-100 p-5">
            <h2 className="mb-4 text-sm font-bold text-ink-900">Haftalık program</h2>
            {data.plan.total ? (
              <>
                <Ring value={planRate ?? 0} label="Görevlerin tamamlanma oranı" caption={`${data.plan.done}/${data.plan.total} görev`} size={84} />
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {data.plan.bySubject.map((s) => (
                    <span key={s.subject} className={cn("rounded-lg px-2 py-1 text-xs", s.done === s.total ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700")}>
                      {s.subject} <b>{s.done}/{s.total}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Bu hafta program yazılmadı.</p>
            )}
          </div>
          <div className="rounded-3xl border border-ink-100 p-5">
            <h2 className="mb-1 text-sm font-bold text-ink-900">{data.exam?.inWeek ? "Bu haftaki deneme" : "Son deneme"}</h2>
            {data.exam ? (
              <>
                <p className="text-xs text-slate-500">
                  {data.exam.kindLabel} · {data.exam.name} · {dmy(data.exam.date)}
                </p>
                <p className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold text-ink-900">{formatNet(data.exam.net)}</span>
                  <span className="text-sm text-slate-500">net</span>
                  {data.exam.change !== null && data.exam.change !== 0 ? (
                    <span className={cn("text-sm font-bold", data.exam.change > 0 ? "text-emerald-700" : "text-rose-700")}>
                      {data.exam.change > 0 ? "+" : ""}
                      {formatNet(data.exam.change)}
                    </span>
                  ) : null}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.exam.sections.map((s) => (
                    <span key={s.name} className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
                      {s.name} <b className="text-ink-900">{formatNet(s.net)}</b>
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Henüz deneme sonucu yok.</p>
            )}
            {data.goal ? (
              <p className="mt-4 rounded-2xl bg-ink-50 px-3 py-2 text-sm text-ink-900">
                <b>Hedef{data.goal.label ? `: ${data.goal.label}` : ""}</b> · {data.goal.kindLabel} {formatNet(data.goal.targetNet)} net
                {data.goal.gap === null ? null : data.goal.gap === 0 ? <span className="font-bold text-emerald-700"> · hedefe ulaşıldı</span> : <span className="font-bold"> · {formatNet(data.goal.gap)} net kaldı</span>}
              </p>
            ) : null}
          </div>
        </section>

        {data.sessions.length ? (
          <section className="print:break-inside-avoid">
            <h2 className="mb-3 text-sm font-bold text-ink-900">Bu haftaki görüşme</h2>
            <ul className="space-y-3">
              {data.sessions.map((s, i) => (
                <li key={`${s.date}-${i}`} className="rounded-3xl border border-ink-100 p-4">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    {s.held ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <XCircle className="size-4 text-rose-500" aria-hidden />}
                    {dmy(s.date)} · {s.held ? "Görüşme yapıldı" : "Görüşme yapılamadı"}
                  </p>
                  {s.notes ? <p className="mt-2 whitespace-pre-line text-sm text-slate-800">{s.notes}</p> : null}
                  {s.priorityTopics.length ? (
                    <p className="mt-2 flex flex-wrap gap-1">
                      {s.priorityTopics.map((t) => (
                        <span key={t} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {t}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {s.nextGoal ? <p className="mt-2 text-sm font-medium text-ink-900">Gelecek hafta hedefi: {s.nextGoal}</p> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <CalendarClock className="size-4" aria-hidden />
            {data.meeting ? `Koç görüşmesi ${data.meeting}` : "Görüşme günü belirlenmedi"}
            {student.center.phone ? ` · ${student.center.phone}` : ""}
          </span>
          <span>Pi Koç ile hazırlandı · pikampus.com</span>
        </footer>
      </div>
    </article>
  );
}

function Kpi({ label, value, hint, good }: { label: string; value: string; hint?: string; good?: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-extrabold text-ink-900">{value}</p>
      {hint ? <p className={cn("mt-0.5 text-[11px]", good === true ? "text-emerald-700" : good === false ? "text-rose-700" : "text-slate-500")}>{hint}</p> : null}
    </div>
  );
}
