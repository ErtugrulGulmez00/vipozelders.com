import { CheckCircle2, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { StudentAvatar } from "@/components/koc/student-card";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { addDaysToDateString, minutesToTime, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { kocOverview } from "@/server/koc";

export const metadata: Metadata = { title: "Haftalık görüşmeler" };

export default async function KocWeekPage() {
  await connection();
  const ctx = await requireCenter();
  const today = toLocalDateString(new Date());
  const { cards, weekStart, todayWeekday } = await kocOverview(ctx, today);
  const unscheduled = cards.filter((c) => !c.meeting);
  const dm = (d: string) => `${d.slice(8)}.${d.slice(5, 7)}`;
  return (
    <>
      <PageHeader title="Haftalık görüşmeler" description={`${dm(weekStart)} – ${dm(addDaysToDateString(weekStart, 6))} · öğrencinin haftalık görüşme gününe göre`} />
      <div className="grid gap-3 md:grid-cols-7">
        {WEEKDAY_NAMES.map((day, i) => {
          const weekday = i + 1;
          const list = cards.filter((c) => c.meeting?.weekday === weekday).sort((a, b) => (a.meeting?.minute ?? 0) - (b.meeting?.minute ?? 0));
          const isToday = weekday === todayWeekday;
          return (
            <div key={day} className={cn("min-w-0 rounded-3xl border p-3", isToday ? "border-brand-300 bg-brand-50/60" : "border-ink-100 bg-white")}>
              <p className={cn("text-sm font-bold", isToday ? "text-brand-700" : "text-ink-900")}>{day}</p>
              <p className="mb-3 text-xs text-slate-500">{dm(addDaysToDateString(weekStart, i))}</p>
              <ul className="space-y-2">
                {list.map((s) => {
                  const overdue = !s.metThisWeek && weekday < todayWeekday;
                  return (
                    <li key={s.id}>
                      <Link href={`/koc/ogrenciler/${s.id}?sekme=gorusmeler`} className={cn("block rounded-2xl p-2.5 text-sm ring-1 transition hover:shadow-sm", s.metThisWeek ? "bg-emerald-50 ring-emerald-200" : overdue ? "bg-amber-50 ring-amber-200" : "bg-white ring-ink-100")}>
                        <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                          {s.metThisWeek ? <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
                          {s.meeting?.minute !== null && s.meeting?.minute !== undefined ? minutesToTime(s.meeting.minute) : "Saat yok"}
                        </span>
                        <span className="mt-0.5 block truncate font-semibold text-ink-900">{s.name}</span>
                        <span className="block text-[11px] text-slate-500">{s.metThisWeek ? "Görüşüldü" : overdue ? "Görüşme kaydı yok" : "Bekliyor"}</span>
                      </Link>
                    </li>
                  );
                })}
                {list.length === 0 ? <li className="text-xs text-slate-400">—</li> : null}
              </ul>
            </div>
          );
        })}
      </div>
      {unscheduled.length ? (
        <Card className="mt-6">
          <CardHeader title="Görüşme günü olmayan öğrenciler" description="Öğrenci sayfasında Bilgiler sekmesinden gün ve saat verin." />
          <CardBody className="flex flex-wrap gap-2">
            {unscheduled.map((s) => (
              <Link key={s.id} href={`/koc/ogrenciler/${s.id}?sekme=bilgiler`} className="inline-flex items-center gap-2 rounded-2xl bg-slate-50 py-1.5 pl-1.5 pr-3 text-sm font-medium text-ink-900 hover:bg-slate-100">
                <StudentAvatar id={s.id} firstName={s.firstName} lastName={s.lastName} />
                {s.name}
              </Link>
            ))}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
