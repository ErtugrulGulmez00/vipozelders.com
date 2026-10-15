import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { minutesToTime, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { studentCoachingHistory } from "@/server/center/coaching";
import { studentWeakTopics } from "@/server/center/exams";
import { db } from "@/server/db";
import { CoachingSessionForm, DeleteCoachingButton } from "./coaching-forms";

const dmy = (d: string) => d.split("-").reverse().join(".");

/** Öğrenci kartı / veli portalı: koç, haftalık görüşme saati, görüşme geçmişi ve öncelikli konular. */
export async function CoachingView({ centerId, studentId, mode, canWrite, memberId, isManager }: { centerId: string; studentId: string; mode: "staff" | "portal"; canWrite: boolean; memberId?: string; isManager?: boolean }) {
  const portal = mode === "portal";
  const [student, history, weak] = await Promise.all([
    db.centerStudent.findUniqueOrThrow({ where: { id: studentId }, select: { coachId: true, coachWeekday: true, coachMinute: true, coach: { include: { user: { select: { firstName: true, lastName: true } } } } } }),
    studentCoachingHistory(centerId, studentId, { parentOnly: portal }),
    portal ? Promise.resolve([]) : studentWeakTopics(centerId, studentId),
  ]);
  const mine = isManager || student.coachId === memberId;
  const schedule = student.coach
    ? `${student.coach.user.firstName} ${student.coach.user.lastName}${student.coachWeekday ? ` · her ${WEEKDAY_NAMES[student.coachWeekday - 1]}${student.coachMinute !== null ? ` ${minutesToTime(student.coachMinute)}` : ""}` : ""}`
    : null;
  if (portal && !student.coach && !history.sessions.length) return null;
  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
      <Card>
        <CardHeader title={portal ? "Koç görüşmeleri" : "Görüşme geçmişi"} description={schedule ? `Koç: ${schedule}` : "Koç atanmamış"} />
        <CardBody>
          {history.sessions.length === 0 ? (
            <p className="text-sm text-slate-500">{portal ? "Paylaşılan görüşme notu yok." : "Henüz görüşme kaydı yok."}</p>
          ) : (
            <ol className="space-y-3">
              {history.sessions.map((s) => (
                <li key={s.id} className="rounded-xl bg-slate-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-slate-500">
                      {dmy(s.dateString)}
                      {s.coachName ? ` · ${s.coachName}` : ""}
                      {!s.held ? <Badge tone="rose" className="ml-2">Görüşme yapılamadı</Badge> : null}
                      {!portal && s.visibleToParent ? <Badge tone="brand" className="ml-2">Veli görüyor</Badge> : null}
                    </p>
                    {!portal && canWrite && (isManager || s.coachId === memberId) ? <DeleteCoachingButton sessionId={s.id} /> : null}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-800">{s.notes}</p>
                  {s.priorityTopics.length ? (
                    <p className="mt-2 flex flex-wrap gap-1">
                      {s.priorityTopics.map((t) => (
                        <span key={t} className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
                          {t}
                        </span>
                      ))}
                    </p>
                  ) : null}
                  {s.nextGoal ? <p className="mt-1 text-xs text-slate-600">Hedef: {s.nextGoal}</p> : null}
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
      {!portal ? (
        <div className="space-y-6">
          {canWrite && mine ? (
            <Card>
              <CardHeader title="Görüşme kaydet" />
              <CardBody>
                <CoachingSessionForm studentId={studentId} today={toLocalDateString(new Date())} suggestions={[...new Set([...weak.slice(0, 8).map((w) => w.topic), ...history.topTopics.map((t) => t.topic)])]} />
              </CardBody>
            </Card>
          ) : canWrite ? (
            <Card>
              <CardBody>
                <p className="text-sm text-slate-500">Bu öğrencinin koçu siz değilsiniz; görüşmeyi koçu kaydeder.</p>
              </CardBody>
            </Card>
          ) : null}
          {history.topTopics.length ? (
            <Card>
              <CardHeader title="Sık geçen öncelikli konular" />
              <CardBody className="flex flex-wrap gap-1.5">
                {history.topTopics.map((t) => (
                  <span key={t.topic} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {t.topic} · {t.count}
                  </span>
                ))}
              </CardBody>
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
