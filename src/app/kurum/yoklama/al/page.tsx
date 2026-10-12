import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, EmptyState, PageHeader } from "@/components/ui/primitives";
import { dateStringToDbDate, formatDate, isDateString, minutesToTime, timeToMinutes, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { AttendanceSheet } from "../attendance-sheet";

export const metadata: Metadata = { title: "Yoklama al" };

export default async function TakeAttendancePage({ searchParams }: PageProps<"/kurum/yoklama/al">) {
  const ctx = await requireCenter("attendance.take");
  const sp = await searchParams;
  const date = isDateString(String(sp.tarih ?? "")) ? String(sp.tarih) : toLocalDateString(new Date());
  const group = await db.centerGroup.findFirst({ where: { id: String(sp.grup ?? ""), centerId: ctx.center.id } });
  if (!group) notFound();
  const slot = sp.ders ? await db.centerScheduleSlot.findFirst({ where: { id: String(sp.ders), groupId: group.id } }) : null;
  const startMinute = slot?.startMinute ?? (sp.baslangic ? Number(sp.baslangic) : timeToMinutes(String(sp.saat ?? "")));
  if (startMinute === null || !Number.isInteger(startMinute) || startMinute < 0 || startMinute >= 1440) notFound();
  const session = await db.centerAttendanceSession.findUnique({
    where: { groupId_date_startMinute: { groupId: group.id, date: dateStringToDbDate(date), startMinute } },
    include: { records: true },
  });
  const endMinute = slot?.endMinute ?? session?.endMinute ?? timeToMinutes(String(sp.bitis ?? "")) ?? startMinute + 40;
  const subject = slot?.subject ?? session?.subject ?? (String(sp.konu ?? "").trim().slice(0, 60) || "Ders");
  const members = await db.centerStudent.findMany({
    where: {
      centerId: ctx.center.id,
      OR: [{ status: "ACTIVE", groups: { some: { groupId: group.id } } }, ...(session ? [{ id: { in: session.records.map((r) => r.studentId) } }] : [])],
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: { id: true, firstName: true, lastName: true, studentNumber: true },
  });
  const records = new Map(session?.records.map((r) => [r.studentId, r]) ?? []);
  const future = zonedDateTime(date, startMinute).getTime() > new Date().getTime() + 60 * 60_000;
  return (
    <>
      <PageHeader
        title={`${group.name} · ${subject}`}
        description={`${formatDate(zonedDateTime(date, 12 * 60))} · ${minutesToTime(startMinute)}–${minutesToTime(endMinute)}`}
        actions={
          <Link href={`/kurum/yoklama?tarih=${date}`} className="text-sm font-semibold text-brand-700 hover:underline">
            ← Günün dersleri
          </Link>
        }
      />
      {session?.takenAt ? (
        <Alert tone="info" className="mb-4">
          Bu dersin yoklaması alınmış; değişiklik yapıp yeniden kaydedebilirsiniz. Daha önce bildirilen devamsızlık için veliye ikinci kez mesaj gitmez.
        </Alert>
      ) : null}
      {future ? (
        <Alert tone="warning" className="mb-4">
          Ders henüz başlamadı. Yoklamayı ders saatinde almanız önerilir.
        </Alert>
      ) : null}
      {members.length === 0 ? (
        <EmptyState
          title="Sınıfta öğrenci yok"
          description="Önce sınıfa öğrenci ekleyin."
          action={
            <Link href={`/kurum/siniflar/${group.id}`} className="font-semibold text-brand-700 hover:underline">
              Sınıf sayfasına git
            </Link>
          }
        />
      ) : (
        <AttendanceSheet
          hidden={{ groupId: group.id, date, start: minutesToTime(startMinute), end: minutesToTime(endMinute), subject, ...(slot ? { slotId: slot.id } : {}) }}
          notifyAvailable={ctx.center.notifyAbsence}
          students={members.map((m) => {
            const record = records.get(m.id);
            return {
              id: m.id,
              name: `${m.firstName} ${m.lastName}`,
              studentNumber: m.studentNumber,
              status: record?.status ?? "PRESENT",
              note: record?.note ?? null,
              notified: Boolean(record?.notifiedAt),
            };
          })}
        />
      )}
    </>
  );
}
