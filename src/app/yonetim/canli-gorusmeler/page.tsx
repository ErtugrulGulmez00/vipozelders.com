import { Eye, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AutoRefresh } from "@/components/ui/auto-refresh";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatTime } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Canlı görüşmeler" };

/** Şu an süren Pi Koç görüntülü görüşmeleri; yönetim teftiş için görünmeden izleyebilir. */
export default async function LiveMeetingsPage() {
  await requireRole("ADMIN");
  await connection();
  const now = new Date();
  const meetings = await db.coachMeeting.findMany({
    where: { endedAt: null },
    orderBy: { startedAt: "desc" },
    include: { center: { select: { id: true, name: true, members: { where: { role: "OWNER" }, take: 1, select: { user: { select: { firstName: true, lastName: true } } } } } } },
  });
  const students = await db.centerStudent.findMany({ where: { id: { in: meetings.map((m) => m.studentId) } }, select: { id: true, firstName: true, lastName: true, gradeName: true } });
  const studentOf = new Map(students.map((s) => [s.id, s]));
  return (
    <>
      <PageHeader
        title="Canlı görüşmeler"
        description="Şu an süren görüntülü görüşmeler. Teftiş izlemede görünmeden katılırsınız: kameranız ve mikrofonunuz kapalıdır, katılımcılar sizi görmez ve onlara bildirim gitmez. Görüşmeler kaydedilmez; her izleme işlem kayıtlarına yazılır."
      />
      <AutoRefresh intervalMs={15_000} maxMs={2 * 60 * 60_000} />
      {meetings.length ? (
        <Card className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Öğrenci</Th>
                <Th>Koç / hesap</Th>
                <Th>Başlangıç</Th>
                <Th>Odada</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {meetings.map((m) => {
                const s = studentOf.get(m.studentId);
                const owner = m.center.members[0]?.user;
                const minutes = Math.round((now.getTime() - m.startedAt.getTime()) / 60_000);
                return (
                  <tr key={m.id}>
                    <Td className="font-semibold text-slate-900">
                      {s ? `${s.firstName} ${s.lastName}` : "—"}
                      {s?.gradeName ? <span className="block text-xs font-normal text-slate-500">{s.gradeName}</span> : null}
                    </Td>
                    <Td className="text-sm">
                      {owner ? `${owner.firstName} ${owner.lastName}` : "—"}
                      <Link href={`/yonetim/kurumlar/${m.center.id}`} className="block text-xs text-brand-700 hover:underline">
                        {m.center.name}
                      </Link>
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {formatTime(m.startedAt)} <span className="text-xs text-slate-500">({minutes} dk)</span>
                    </Td>
                    <Td>
                      <Badge tone={m.activeCount >= 2 ? "green" : "amber"}>{m.activeCount >= 2 ? `${m.activeCount} kişi` : "Biri bekliyor"}</Badge>
                    </Td>
                    <Td>
                      <Link href={`/teftis/${m.studentId}`} target="_blank" className={buttonClasses("primary", "sm")}>
                        <Eye className="size-4" aria-hidden /> Teftiş izleme
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState icon={<Video className="size-8" />} title="Şu an süren görüşme yok" description="Bir görüşme başlayınca size bildirim gelir ve burada listelenir; sayfa kendini yeniler." />
      )}
    </>
  );
}
