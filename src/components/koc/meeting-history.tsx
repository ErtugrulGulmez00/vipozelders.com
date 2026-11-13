import { Video } from "lucide-react";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { formatDate, formatTime } from "@/lib/dates";
import { formatHours } from "@/lib/pi-koc";
import { db } from "@/server/db";

/** Öğrencinin görüntülü görüşme geçmişi (LiveKit olaylarından kaydedilir): tarih, süre, iki tarafın katılıp katılmadığı. */
export async function MeetingHistory({ studentId }: { studentId: string }) {
  const now = new Date();
  const meetings = await db.coachMeeting.findMany({ where: { studentId }, orderBy: { startedAt: "desc" }, take: 20 });
  const minutes = (m: (typeof meetings)[number]) => Math.max(0, Math.round(((m.endedAt ?? now).getTime() - m.startedAt.getTime()) / 60_000));
  const together = meetings.filter((m) => m.peakCount >= 2);
  const total = together.reduce((sum, m) => sum + minutes(m), 0);
  return (
    <Card className="mb-6">
      <CardHeader
        title="Görüntülü görüşmeler"
        description={meetings.length ? `${together.length} görüşme birlikte yapıldı · toplam ${formatHours(total)}` : "Öğrenciyle görüntülü görüşme yaptığınızda burada listelenir."}
      />
      {meetings.length ? (
        <CardBody className="divide-y divide-slate-100 py-0">
          {meetings.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="flex items-center gap-2 text-slate-800">
                <Video className="size-4 text-brand-600" aria-hidden />
                {formatDate(m.startedAt)} · {formatTime(m.startedAt)}
              </span>
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{m.endedAt ? `${minutes(m)} dk` : "Sürüyor"}</span>
                {!m.endedAt ? <Badge tone="green">Canlı</Badge> : m.peakCount >= 2 ? <Badge tone="sky">Birlikte</Badge> : <Badge tone="slate">Öğrenci katılmadı</Badge>}
              </span>
            </div>
          ))}
        </CardBody>
      ) : null}
    </Card>
  );
}
