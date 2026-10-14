import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { RateBar, percent, rateTone } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader, EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { addDaysToDateString, dateStringToDbDate, dbDateToString, isDateString, isoWeekday, toLocalDateString, WEEKDAY_NAMES } from "@/lib/dates";
import { resourceSummary, weekStartOf } from "@/server/center/resources";
import { db } from "@/server/db";
import { CopyWeekButton, PlanItemControls, PlanItemForm, ProgressForm, UnassignResourceButton } from "./study-forms";

const dayLabel = (date: string) => `${WEEKDAY_NAMES[isoWeekday(date) - 1]} ${date.slice(8)}.${date.slice(5, 7)}`;

/**
 * Öğrencinin haftalık çalışma programı ve kaynak/konu ilerlemesi.
 * staff: kurum personeli (madde ekler/siler, ilerleme girer). portal: öğrenci/veli (tamamlandı işaretler, ilerleme girer).
 */
export async function StudyView({ centerId, studentId, week, baseHref, mode, canEdit }: { centerId: string; studentId: string; week?: string; baseHref: string; mode: "staff" | "portal"; canEdit: boolean }) {
  const today = toLocalDateString(new Date());
  const weekStart = weekStartOf(week && isDateString(week) ? week : today);
  const weekEnd = addDaysToDateString(weekStart, 7);
  const [items, assigned, centerResources] = await Promise.all([
    db.centerStudyPlanItem.findMany({
      where: { centerId, studentId, date: { gte: dateStringToDbDate(weekStart), lt: dateStringToDbDate(weekEnd) } },
      include: { resource: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    db.centerStudentResource.findMany({ where: { studentId }, include: { resource: true, progress: true }, orderBy: { assignedAt: "asc" } }),
    mode === "staff" && canEdit ? db.centerResource.findMany({ where: { centerId, isActive: true }, orderBy: [{ subject: "asc" }, { name: "asc" }], select: { id: true, name: true, subject: true, topics: true } }) : Promise.resolve([]),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => addDaysToDateString(weekStart, i));
  const done = items.filter((i) => i.doneAt).length;
  const sep = baseHref.includes("?") ? "&" : "?";
  const portal = mode === "portal";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Haftalık çalışma programı"
          description={items.length ? `${done}/${items.length} madde tamamlandı` : "Bu hafta için program girilmedi."}
          action={
            <div className="flex items-center gap-1">
              <Link href={`${baseHref}${sep}hafta=${addDaysToDateString(weekStart, -7)}`} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Önceki hafta">
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
              <span className="px-2 text-sm font-medium text-slate-700">
                {weekStart.slice(8)}.{weekStart.slice(5, 7)} – {addDaysToDateString(weekStart, 6).slice(8)}.{addDaysToDateString(weekStart, 6).slice(5, 7)}
              </span>
              <Link href={`${baseHref}${sep}hafta=${weekEnd}`} className="inline-flex size-8 items-center justify-center rounded-lg ring-1 ring-slate-200 hover:bg-slate-50" aria-label="Sonraki hafta">
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
          }
        />
        <CardBody className="space-y-4">
          {items.length ? <RateBar value={done / items.length} tone={rateTone(done / items.length)} /> : null}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {days.map((date) => {
              const dayItems = items.filter((i) => dbDateToString(i.date) === date);
              if (!dayItems.length && portal) return null;
              return (
                <div key={date} className={cn("rounded-xl border p-3", date === today ? "border-brand-300 bg-brand-50/40" : "border-slate-200")}>
                  <p className="mb-2 text-sm font-semibold text-slate-800">
                    {dayLabel(date)} {date === today ? <Badge tone="brand">Bugün</Badge> : null}
                  </p>
                  {dayItems.length ? (
                    <ul className="space-y-2">
                      {dayItems.map((i) => (
                        <li key={i.id} className="flex items-start justify-between gap-2 text-sm">
                          <div className={cn("min-w-0", i.doneAt && "text-slate-400 line-through")}>
                            <p className="font-medium text-slate-900">
                              {i.subject}
                              {i.topic ? <span className="font-normal text-slate-600"> · {i.topic}</span> : null}
                            </p>
                            <p className="text-xs text-slate-500">
                              {[i.resource?.name, i.targetQuestions ? `${i.targetQuestions} soru` : null, i.note].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                          <PlanItemControls itemId={i.id} done={Boolean(i.doneAt)} portal={portal} canDelete={!portal && canEdit} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-slate-400">Boş</p>
                  )}
                </div>
              );
            })}
          </div>
          {portal && !items.length ? <p className="text-sm text-slate-500">Kurumunuz bu hafta için program girmedi.</p> : null}
          {!portal && canEdit ? (
            <div className="space-y-3 border-t border-slate-100 pt-4">
              <PlanItemForm studentId={studentId} resources={centerResources} defaultDate={today >= weekStart && today < weekEnd ? today : weekStart} days={days.map((d) => ({ date: d, label: dayLabel(d) }))} />
              {items.length ? <CopyWeekButton studentId={studentId} weekStart={weekStart} /> : null}
            </div>
          ) : null}
        </CardBody>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-900">Kaynaklar ve konu ilerlemesi</h2>
        {assigned.length === 0 ? (
          <EmptyState title="Atanmış kaynak yok" description={portal ? "Kurumunuz kaynak atadığında burada konu konu ilerlemenizi takip edebilirsiniz." : "“Kaynaklar” sayfasından bu öğrenciye kitap/soru bankası atayın."} />
        ) : (
          <div className="space-y-4">
            {assigned.map((a) => {
              const summary = resourceSummary(a.resource.topics, a.progress);
              return (
                <Card key={a.id}>
                  <CardHeader
                    title={`${a.resource.subject} · ${a.resource.name}`}
                    description={`${summary.doneCount}/${a.resource.topics.length} konu bitti · ${summary.solved} soru çözüldü${summary.accuracy !== null ? ` · başarı ${percent(summary.accuracy)}` : ""}`}
                    action={!portal && canEdit ? <UnassignResourceButton studentResourceId={a.id} /> : null}
                  />
                  <CardBody className="space-y-4">
                    <RateBar value={summary.completion} tone="brand" />
                    {/* Konu bazında başarı: doğru / (doğru + yanlış) */}
                    {summary.rows.some((r) => r.accuracy !== null) ? (
                      <div className="flex flex-wrap gap-1.5">
                        {summary.rows
                          .filter((r) => r.accuracy !== null)
                          .map((r) => (
                            <span key={r.topic} className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.accuracy! >= 0.7 ? "bg-emerald-50 text-emerald-700" : r.accuracy! >= 0.5 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700")}>
                              {r.topic} %{Math.round(r.accuracy! * 100)}
                            </span>
                          ))}
                      </div>
                    ) : null}
                    {canEdit || portal ? (
                      <details className="group">
                        <summary className="cursor-pointer text-sm font-semibold text-brand-700">İlerleme gir</summary>
                        <div className="mt-3">
                          <ProgressForm studentResourceId={a.id} rows={summary.rows} portal={portal} />
                        </div>
                      </details>
                    ) : null}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
