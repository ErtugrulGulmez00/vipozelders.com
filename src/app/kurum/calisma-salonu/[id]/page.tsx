import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CenterFlash, percent, RateBar, rateTone, Tabs } from "@/components/center/center-ui";
import { HallBoard } from "@/components/center/hall-board";
import { AddHallStudentsForm, DeleteHallButton, HallForm, HallStudentRow } from "@/components/center/hall-forms";
import { Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { addDaysToDateString, isDateString, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { hallMarksBetween, hallReport, markSummary } from "@/server/center/study-hall";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Çalışma salonu" };

export default async function StudyHallPage({ params, searchParams }: PageProps<"/kurum/calisma-salonu/[id]">) {
  const ctx = await requireCenter("attendance.take");
  const { id } = await params;
  const sp = await searchParams;
  const tab = String(sp.sekme ?? "yoklama");
  const today = toLocalDateString(new Date());
  const date = isDateString(String(sp.tarih ?? "")) ? String(sp.tarih) : today;
  const hall = await db.centerStudyHall.findFirst({
    where: { id, centerId: ctx.center.id },
    include: { students: { include: { student: { select: { id: true, firstName: true, lastName: true, status: true } } } } },
  });
  if (!hall) notFound();
  const members = hall.students.filter((s) => s.student.status === "ACTIVE").sort((a, b) => (a.deskNo ?? "").localeCompare(b.deskNo ?? "", "tr", { numeric: true }) || a.student.firstName.localeCompare(b.student.firstName, "tr"));
  // Seçili günün haftası (pazartesi başlar): gün şeridi ve haftalık tablo aynı veriyi kullanır
  const weekday = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDaysToDateString(date, -weekday);
  const week = Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
  const weekMarks = await hallMarksBetween(hall.id, week[0], week[6]);
  const marksOn = (studentId: string, d: string) => weekMarks.get(studentId)?.get(d) ?? "";
  const base = `/kurum/calisma-salonu/${hall.id}`;

  return (
    <>
      <PageHeader
        title={hall.name}
        description={`${members.length} öğrenci · ${hall.periods.length} periyot`}
        actions={
          <Link href="/kurum/calisma-salonu?liste=1" className="text-sm font-semibold text-brand-700 hover:underline">
            Salonlar
          </Link>
        }
      />
      <CenterFlash code={sp.durum} />
      <Tabs
        active={tab}
        tabs={[
          { key: "yoklama", label: "Günlük yoklama", href: `${base}?tarih=${date}` },
          { key: "hafta", label: "Haftalık tablo", href: `${base}?sekme=hafta&tarih=${date}` },
          { key: "rapor", label: "Rapor", href: `${base}?sekme=rapor` },
          { key: "ogrenciler", label: "Öğrenciler ve ayarlar", href: `${base}?sekme=ogrenciler` },
        ]}
      />
      {tab === "rapor" ? (
        <HallReportTab hallId={hall.id} today={today} from={isDateString(String(sp.bas ?? "")) ? String(sp.bas) : addDaysToDateString(today, -13)} base={base} />
      ) : tab === "ogrenciler" ? (
        <HallMembersTab ctx={ctx} hall={hall} members={members} />
      ) : (
        <>
          <WeekStrip
            base={base}
            tab={tab}
            date={date}
            today={today}
            week={week}
            stats={Object.fromEntries(
              week.map((d) => {
                let came = 0;
                let marked = 0;
                for (const m of members) {
                  const sum = markSummary(marksOn(m.studentId, d));
                  if (sum.marked) marked++;
                  if (sum.present) came++;
                }
                return [d, { came, marked, total: members.length }];
              }),
            )}
          />
          {members.length === 0 ? (
            <EmptyState title="Salonda öğrenci yok" description="“Öğrenciler ve ayarlar” sekmesinden öğrenci ekleyin." />
          ) : tab === "hafta" ? (
            <WeekTable base={base} week={week} today={today} periods={hall.periods.length} rows={members.map((m) => ({ id: m.studentId, name: `${m.student.firstName} ${m.student.lastName}`, days: week.map((d) => marksOn(m.studentId, d)) }))} />
          ) : (
            <HallBoard key={date} hallId={hall.id} date={date} periods={hall.periods} students={members.map((m) => ({ id: m.studentId, name: `${m.student.firstName} ${m.student.lastName}`, deskNo: m.deskNo, marks: marksOn(m.studentId, date) }))} />
          )}
        </>
      )}
    </>
  );
}

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

/** Haftanın günleri: her günde kaç öğrenci geldi; tıklayınca o güne geçer. */
function WeekStrip({ base, tab, date, today, week, stats }: { base: string; tab: string; date: string; today: string; week: string[]; stats: Record<string, { came: number; marked: number; total: number }> }) {
  const q = tab === "hafta" ? "sekme=hafta&" : "";
  const next = addDaysToDateString(week[0], 7);
  return (
    <div className="mb-5 flex items-stretch gap-2">
      <Link href={`${base}?${q}tarih=${addDaysToDateString(week[0], -7)}`} className="inline-flex w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Önceki hafta">
        <ChevronLeft className="size-4" aria-hidden />
      </Link>
      <div className="grid flex-1 grid-cols-7 gap-1.5">
        {week.map((d, i) => {
          const future = d > today;
          const { came, marked, total } = stats[d];
          const selected = d === date;
          const inner = (
            <>
              <span className={cn("text-[11px] font-semibold uppercase", selected ? "text-brand-100" : "text-slate-500")}>{DAY_NAMES[i]}</span>
              <span className={cn("font-display text-lg font-extrabold leading-tight", selected ? "text-white" : "text-ink-900")}>{Number(d.slice(8))}</span>
              <span className={cn("mt-1 h-1.5 w-full rounded-full", selected ? "bg-white/30" : "bg-slate-100")}>
                <span className={cn("block h-1.5 rounded-full", selected ? "bg-white" : "bg-teal-600")} style={{ width: `${total ? (came / total) * 100 : 0}%` }} />
              </span>
              <span className={cn("mt-1 text-[10px] tabular-nums", selected ? "text-brand-100" : "text-slate-500")}>{marked ? `${came}/${total}` : d === today ? "bugün" : "—"}</span>
            </>
          );
          const cls = cn("flex flex-col items-center rounded-xl px-1 py-2 ring-1 transition", selected ? "bg-brand-600 ring-brand-600" : "bg-white ring-slate-200 hover:ring-brand-300", d === today && !selected && "ring-2 ring-brand-300", future && "opacity-40");
          return future ? (
            <span key={d} className={cls}>
              {inner}
            </span>
          ) : (
            <Link key={d} href={`${base}?tarih=${d}`} className={cls} aria-current={selected ? "date" : undefined}>
              {inner}
            </Link>
          );
        })}
      </div>
      {next <= today ? (
        <Link href={`${base}?${q}tarih=${next}`} className="inline-flex w-9 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Sonraki hafta">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      ) : (
        <span className="w-9 shrink-0" />
      )}
    </div>
  );
}

/** Öğrenci × gün tablosu: her günde periyot çizgileri (geldi / gelmedi / boş) ve haftalık oran. */
function WeekTable({ base, week, today, periods, rows }: { base: string; week: string[]; today: string; periods: number; rows: { id: string; name: string; days: string[] }[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full min-w-[720px] text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="sticky left-0 bg-slate-50 px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide">Öğrenci</th>
            {week.map((d, i) => (
              <th key={d} className={cn("px-2 py-3 text-center font-semibold", d === today && "text-brand-700")}>
                {DAY_NAMES[i]} <span className="font-normal text-slate-400">{`${d.slice(8)}.${d.slice(5, 7)}`}</span>
              </th>
            ))}
            <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wide">Hafta</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((m) => {
            const sums = m.days.map((marks) => markSummary(marks));
            const present = sums.reduce((t, x) => t + x.present, 0);
            const marked = sums.reduce((t, x) => t + x.marked, 0);
            const rate = marked ? present / marked : 0;
            const tone = rateTone(rate);
            return (
              <tr key={m.id}>
                <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2.5 text-sm font-semibold text-slate-900">
                  <Link href={`/kurum/ogrenciler/${m.id}?sekme=devam`} className="hover:underline">
                    {m.name}
                  </Link>
                </td>
                {week.map((d, di) => {
                  const marks = m.days[di];
                  const sum = sums[di];
                  return (
                    <td key={d} className="px-2 py-2.5 text-center">
                      {d > today ? null : sum.marked ? (
                        <Link href={`${base}?tarih=${d}`} className="inline-flex flex-col items-center gap-1" title={`${sum.present} periyot geldi, ${sum.absent} gelmedi`}>
                          <span className="flex gap-0.5">
                            {Array.from({ length: periods }, (_, i) => (
                              <span key={i} className={cn("h-3.5 w-1.5 rounded-sm", marks[i] === "G" ? "bg-teal-600" : marks[i] === "Y" ? "bg-rose-600" : "bg-slate-200")} />
                            ))}
                          </span>
                          <span className={cn("text-[10px] font-semibold tabular-nums", sum.present ? "text-slate-600" : "text-rose-700")}>{sum.present ? `${sum.present}/${periods}` : "gelmedi"}</span>
                        </Link>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-right">
                  {marked ? (
                    <span className={cn("rounded-full px-2 py-0.5 font-bold tabular-nums", tone === "green" ? "bg-teal-50 text-teal-800" : tone === "amber" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800")}>{percent(rate)}</span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-4 border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-1.5 rounded-sm bg-teal-600" /> Geldi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-1.5 rounded-sm bg-rose-600" /> Gelmedi
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-1.5 rounded-sm bg-slate-200" /> İşaretlenmedi
        </span>
        <span>Her çizgi bir periyot; güne tıklayınca o günün yoklaması açılır.</span>
      </div>
    </div>
  );
}

async function HallReportTab({ hallId, today, from, base }: { hallId: string; today: string; from: string; base: string }) {
  const rows = await hallReport(hallId, from, today);
  return (
    <Card>
      <CardHeader
        title="Katılım raporu"
        description={`${from.split("-").reverse().join(".")} – ${today.split("-").reverse().join(".")} · en az katılan başta`}
        action={
          <div className="flex gap-2 text-sm">
            <Link href={`${base}?sekme=rapor&bas=${addDaysToDateString(today, -6)}`} className="font-semibold text-brand-700 hover:underline">
              Son 7 gün
            </Link>
            <Link href={`${base}?sekme=rapor&bas=${addDaysToDateString(today, -29)}`} className="font-semibold text-brand-700 hover:underline">
              Son 30 gün
            </Link>
          </div>
        }
      />
      {rows.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">Bu aralıkta yoklama yok.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.studentId} className="px-5 py-3">
              <div className="mb-1 flex justify-between text-sm">
                <Link href={`/kurum/ogrenciler/${r.studentId}?sekme=devam`} className="font-semibold text-slate-900 hover:underline">
                  {r.name}
                </Link>
                <span className="text-slate-600">
                  {r.days} gün · {r.present}/{r.marked} periyot · <strong>{percent(r.rate)}</strong>
                </span>
              </div>
              <RateBar value={r.rate} tone={rateTone(r.rate)} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

async function HallMembersTab({ ctx, hall, members }: { ctx: Awaited<ReturnType<typeof requireCenter>>; hall: { id: string; name: string; periods: string[]; isActive: boolean }; members: { studentId: string; deskNo: string | null; student: { firstName: string; lastName: string } }[] }) {
  const [groups, students] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerStudent.findMany({
      where: { centerId: ctx.center.id, status: "ACTIVE", halls: { none: { hallId: hall.id } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true, groups: { select: { group: { select: { name: true } } } } },
    }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <Card>
        <CardHeader title="Salondaki öğrenciler" description="Masa numarası yoklama listesinde sıralamayı belirler." />
        <CardBody className="divide-y divide-slate-100">
          {members.length ? members.map((m) => <HallStudentRow key={m.studentId} hallId={hall.id} studentId={m.studentId} name={`${m.student.firstName} ${m.student.lastName}`} deskNo={m.deskNo} />) : <p className="text-sm text-slate-500">Henüz öğrenci yok.</p>}
        </CardBody>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHeader title="Öğrenci ekle" />
          <CardBody>
            <AddHallStudentsForm hallId={hall.id} groups={groups} students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, groups: s.groups.map((g) => g.group.name).join(", ") }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Salon ayarları" action={ctx.can("groups.manage") ? <DeleteHallButton hallId={hall.id} /> : null} />
          <CardBody>
            <HallForm initial={hall} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
