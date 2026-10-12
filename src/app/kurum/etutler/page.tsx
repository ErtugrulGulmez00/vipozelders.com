import { ChevronLeft, ChevronRight, PlusCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CenterFlash, shortDate } from "@/components/center/center-ui";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, PageHeader } from "@/components/ui/primitives";
import { ETUD_STATUS } from "@/lib/center/labels";
import { WEEKDAY_NAMES, addDaysToDateString, dateStringToDbDate, dbDateToString, isDateString, isoWeekday, minutesToTime, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Etütler" };

export default async function EtudsPage({ searchParams }: PageProps<"/kurum/etutler">) {
  const ctx = await requireCenter("etud.manage");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const anchor = isDateString(String(sp.hafta ?? "")) ? String(sp.hafta) : today;
  const monday = addDaysToDateString(anchor, 1 - isoWeekday(anchor));
  const sunday = addDaysToDateString(monday, 6);
  const mine = ctx.member.role === "TEACHER" || sp.benim === "1";
  const etuds = await db.centerEtud.findMany({
    where: { centerId: ctx.center.id, date: { gte: dateStringToDbDate(monday), lte: dateStringToDbDate(sunday) }, ...(mine ? { teacherId: ctx.member.id } : {}) },
    include: {
      teacher: { include: { user: { select: { firstName: true, lastName: true } } } },
      students: { include: { student: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: [{ date: "asc" }, { startMinute: "asc" }],
  });
  const days = Array.from({ length: 7 }, (_, i) => addDaysToDateString(monday, i));
  return (
    <>
      <PageHeader
        title="Etüt planı"
        description="Birebir ve küçük grup etütleri; katılım ve işlenen konu kaydı"
        actions={
          <LinkButton href={`/kurum/etutler/yeni?tarih=${anchor < today ? today : anchor}`} size="sm">
            <PlusCircle className="size-4" aria-hidden /> Etüt planla
          </LinkButton>
        }
      />
      <CenterFlash code={sp.durum} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link href={`/kurum/etutler?hafta=${addDaysToDateString(monday, -7)}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50" aria-label="Önceki hafta">
          <ChevronLeft className="size-4" aria-hidden />
        </Link>
        <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">
          {shortDate(monday)} – {shortDate(sunday)}
        </span>
        <Link href={`/kurum/etutler?hafta=${addDaysToDateString(monday, 7)}`} className="inline-flex size-9 items-center justify-center rounded-lg border border-slate-300 bg-white hover:bg-slate-50" aria-label="Sonraki hafta">
          <ChevronRight className="size-4" aria-hidden />
        </Link>
        {anchor !== today ? (
          <Link href="/kurum/etutler" className="px-2 text-sm font-semibold text-brand-700 hover:underline">
            Bu hafta
          </Link>
        ) : null}
        {ctx.member.role !== "TEACHER" ? (
          <Link href={sp.benim === "1" ? `/kurum/etutler?hafta=${monday}` : `/kurum/etutler?hafta=${monday}&benim=1`} className="ml-auto text-sm font-semibold text-slate-600 hover:text-brand-700">
            {sp.benim === "1" ? "Tüm etütler" : "Yalnız benim etütlerim"}
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {days.map((day) => {
          const list = etuds.filter((e) => dbDateToString(e.date) === day);
          return (
            <Card key={day} className={day === today ? "ring-2 ring-brand-300" : undefined}>
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <p className="text-sm font-bold text-slate-800">
                  {WEEKDAY_NAMES[isoWeekday(day) - 1]} <span className="font-normal text-slate-500">{shortDate(day)}</span>
                </p>
                <Link href={`/kurum/etutler/yeni?tarih=${day}`} className="text-xs font-semibold text-brand-700 hover:underline">
                  + Ekle
                </Link>
              </div>
              {list.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">Etüt yok</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {list.map((e) => (
                    <li key={e.id}>
                      <Link href={`/kurum/etutler/${e.id}`} className="block px-4 py-2.5 hover:bg-slate-50">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900">
                            {minutesToTime(e.startMinute)} {e.subject}
                          </p>
                          <Badge tone={ETUD_STATUS[e.status].tone}>{ETUD_STATUS[e.status].label}</Badge>
                        </div>
                        <p className="text-xs text-slate-500">
                          {e.topic ? `${e.topic} · ` : ""}
                          {e.teacher ? `${e.teacher.user.firstName} ${e.teacher.user.lastName}` : "Öğretmen yok"}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{e.students.map((s) => `${s.student.firstName} ${s.student.lastName.charAt(0)}.`).join(", ")}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
