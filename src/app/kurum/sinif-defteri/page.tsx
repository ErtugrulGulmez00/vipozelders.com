import { BookText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { shortDate } from "@/components/center/center-ui";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { addDaysToDateString, dateStringToDbDate, isDateString, minutesToTime, toLocalDateString } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Sınıf defteri" };

/** Yoklamada girilen "işlenen konu"lar: sınıf ve tarihe göre ders ders ne anlatıldı. */
export default async function ClassLogPage({ searchParams }: PageProps<"/kurum/sinif-defteri">) {
  const ctx = await requireCenter("students.view");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const from = isDateString(String(sp.bas ?? "")) ? String(sp.bas) : addDaysToDateString(today, -13);
  const groupId = String(sp.grup ?? "");
  const subject = String(sp.ders ?? "").trim();
  const teacherOnly = ctx.member.role === "TEACHER";
  const [groups, sessions] = await Promise.all([
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerAttendanceSession.findMany({
      where: {
        centerId: ctx.center.id,
        date: { gte: dateStringToDbDate(from), lte: dateStringToDbDate(today) },
        ...(groupId ? { groupId } : {}),
        ...(subject ? { subject: { contains: subject, mode: "insensitive" } } : {}),
        ...(teacherOnly ? { teacherId: ctx.member.id } : {}),
      },
      include: { group: { select: { name: true } }, records: { select: { status: true } } },
      orderBy: [{ date: "desc" }, { startMinute: "desc" }],
      take: 300,
    }),
  ]);
  const teacherIds = [...new Set(sessions.map((s) => s.teacherId).filter(Boolean))] as string[];
  const teachers = new Map(
    (await db.centerMember.findMany({ where: { id: { in: teacherIds } }, include: { user: { select: { firstName: true, lastName: true } } } })).map((m) => [m.id, `${m.user.firstName} ${m.user.lastName}`]),
  );
  const missing = sessions.filter((s) => !s.topic).length;
  return (
    <>
      <PageHeader title="Sınıf defteri" description="Her derste işlenen konu yoklamayla birlikte girilir. Hangi sınıfın hangi konuda kaldığını buradan izleyin." />
      <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Sınıf</span>
          <select name="grup" defaultValue={groupId} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm">
            <option value="">Tüm sınıflar</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Ders</span>
          <input name="ders" defaultValue={subject} placeholder="Matematik" className="h-9 w-36 rounded-lg border border-slate-300 px-2 text-sm" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-500">Başlangıç</span>
          <input name="bas" type="date" defaultValue={from} className="h-9 rounded-lg border border-slate-300 px-2 text-sm" />
        </label>
        <button type="submit" className="h-9 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          Göster
        </button>
      </form>
      {sessions.length === 0 ? (
        <EmptyState icon={<BookText className="size-8" />} title="Bu aralıkta ders kaydı yok" description="Yoklama alınırken “işlenen konu” alanı doldurulduğunda burada görünür." />
      ) : (
        <Card>
          {missing ? <p className="border-b border-slate-100 px-5 py-2 text-xs text-amber-700">{missing} derste işlenen konu girilmemiş.</p> : null}
          <Table>
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th>Sınıf · Ders</Th>
                <Th>İşlenen konu</Th>
                <Th>Öğretmen</Th>
                <Th className="text-right">Devam</Th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const absent = s.records.filter((r) => r.status === "ABSENT").length;
                return (
                  <tr key={s.id}>
                    <Td className="whitespace-nowrap text-xs">
                      {shortDate(s.date)} {minutesToTime(s.startMinute)}
                    </Td>
                    <Td className="text-sm">
                      <span className="font-medium text-slate-900">{s.group.name}</span> · {s.subject}
                    </Td>
                    <Td className="text-sm">
                      {s.topic ?? (!ctx.can("attendance.take") ? (
                        <span className="text-xs text-slate-400">Konu girilmedi</span>
                      ) : (
                        <Link href={`/kurum/yoklama/al?grup=${s.groupId}&tarih=${s.date.toISOString().slice(0, 10)}&baslangic=${s.startMinute}${s.slotId ? `&ders=${s.slotId}` : ""}`} className="text-xs font-semibold text-amber-700 hover:underline">
                          Konu gir
                        </Link>
                      ))}
                    </Td>
                    <Td className="text-xs text-slate-600">{s.teacherId ? (teachers.get(s.teacherId) ?? "—") : "—"}</Td>
                    <Td className="text-right">{absent ? <Badge tone="amber">{absent} gelmedi</Badge> : <Badge tone="green">Tam</Badge>}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
