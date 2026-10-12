import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { PrintButton } from "@/components/center/center-client";
import { buttonClasses } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { WEEKDAY_NAMES, minutesToTime } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { centerTeachers } from "@/server/center/groups";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Ders programı" };

const COLORS = ["bg-brand-50 border-brand-200", "bg-emerald-50 border-emerald-200", "bg-amber-50 border-amber-200", "bg-sky-50 border-sky-200", "bg-violet-50 border-violet-200", "bg-rose-50 border-rose-200"];

export default async function SchedulePage({ searchParams }: PageProps<"/kurum/program">) {
  const ctx = await requireCenter("students.view");
  const sp = await searchParams;
  const groupId = String(sp.grup ?? "");
  const teacherId = String(sp.ogretmen ?? (ctx.member.role === "TEACHER" && sp.ogretmen === undefined ? ctx.member.id : ""));
  const [slots, groups, teachers] = await Promise.all([
    db.centerScheduleSlot.findMany({
      where: { centerId: ctx.center.id, group: { isActive: true }, ...(groupId ? { groupId } : {}), ...(teacherId ? { teacherId } : {}) },
      include: { group: { select: { id: true, name: true } }, teacher: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: [{ weekday: "asc" }, { startMinute: "asc" }],
    }),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    centerTeachers(ctx.center.id),
  ]);
  const colorByGroup = new Map(groups.map((g, i) => [g.id, COLORS[i % COLORS.length]]));
  const days = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || slots.some((s) => s.weekday === d));
  return (
    <>
      <PageHeader title="Haftalık ders programı" description="Sınıf ya da öğretmene göre süzün; yazdırıp panoya asabilirsiniz." actions={<PrintButton />} />
      <Form action="/kurum/program" className="mb-4 flex flex-wrap gap-2 print:hidden">
        <Select name="grup" defaultValue={groupId} className="w-full sm:w-52" aria-label="Sınıf">
          <option value="">Tüm sınıflar</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select name="ogretmen" defaultValue={teacherId} className="w-full sm:w-52" aria-label="Öğretmen">
          <option value="">Tüm öğretmenler</option>
          {teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <button type="submit" className={buttonClasses("secondary")}>
          Göster
        </button>
      </Form>
      {slots.length === 0 ? (
        <EmptyState
          title="Programda ders yok"
          description="Sınıf sayfasından haftalık ders saatlerini ekleyin."
          action={
            <Link href="/kurum/siniflar" className={buttonClasses("primary")}>
              Sınıflara git
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto p-3">
          <div className="grid min-w-[760px] gap-2" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
            {days.map((day) => (
              <div key={day}>
                <p className="mb-2 rounded-lg bg-slate-100 px-2 py-1.5 text-center text-xs font-bold uppercase tracking-wide text-slate-600">{WEEKDAY_NAMES[day - 1]}</p>
                <div className="space-y-2">
                  {slots
                    .filter((s) => s.weekday === day)
                    .map((s) => (
                      <div key={s.id} className={`rounded-lg border p-2 text-xs ${colorByGroup.get(s.groupId) ?? COLORS[0]}`}>
                        <p className="font-bold text-slate-900">
                          {minutesToTime(s.startMinute)}–{minutesToTime(s.endMinute)}
                        </p>
                        <p className="font-semibold text-slate-800">{s.subject}</p>
                        <p className="text-slate-600">{s.group.name}</p>
                        {s.teacher ? <p className="text-slate-500">{s.teacher.user.firstName} {s.teacher.user.lastName}</p> : null}
                        {s.room ? <p className="text-slate-500">{s.room}</p> : null}
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
