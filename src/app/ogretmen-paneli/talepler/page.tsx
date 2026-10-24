import { Clock, Inbox, MapPin, Monitor } from "lucide-react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { FlashNotice } from "@/components/panel/flash-notice";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime, formatDuration, formatLessonRange } from "@/lib/dates";
import { durationLabel, IN_PERSON_PLACE_LABEL, MODE_LABEL } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { RequestActions } from "./request-actions";
import { ApprovePackageForm } from "@/components/packages/forms";
import { SectionTabs, teacherLessonTabs } from "@/components/panel/section-tabs";

export const metadata: Metadata = { title: "Ders talepleri" };

export default async function RequestsPage({ searchParams }: PageProps<"/ogretmen-paneli/talepler">) {
  const user = await requireRole("TEACHER");
  const pendingCount = await db.booking.count({ where: { teacherId: user.id, status: "PENDING_APPROVAL" } });
  const { durum } = await searchParams;
  await connection();
  const now = new Date();
  const requests = await db.booking.findMany({
    where: { teacherId: user.id, status: "PENDING_APPROVAL" },
    orderBy: { approvalDeadline: "asc" },
    include: { district: { include: { city: true } }, student: { select: { firstName: true } } },
  });

  return (
    <>
      <SectionTabs tabs={teacherLessonTabs(pendingCount)} active="/ogretmen-paneli/talepler" />
      <PageHeader title="Talepler ve sorular" description="Ödemesi alınmış ders talepleri ve fotoğrafla gelen sorular. Süresi içinde yanıt vermezseniz talep iptal edilir ve öğrenciye iade yapılır." />
      <FlashNotice code={durum} />
      {/* Tekrarlayan ders: aynı paketten birden fazla talep tek seferde onaylanabilir */}
      {Object.entries(requests.reduce<Record<string, number>>((acc, b) => (b.packageId ? { ...acc, [b.packageId]: (acc[b.packageId] ?? 0) + 1 } : acc), {}))
        .filter(([, count]) => count > 1)
        .map(([packageId, count]) => (
          <Card key={packageId} className="mb-4 flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50/60 p-4 text-sm">
            <span>Düzenli ders: aynı öğrenciden {count} haftalık talep var.</span>
            <ApprovePackageForm packageId={packageId} count={count} />
          </Card>
        ))}
      {requests.length === 0 ? (
        <EmptyState icon={<Inbox className="size-8" />} title="Yanıt bekleyen talep yok" />
      ) : (
        <div className="space-y-4">
          {requests.map((b) => (
            <Card key={b.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 space-y-1">
                  <p className="text-lg font-semibold text-slate-900">
                    {b.levelName} · {b.subjectName} <span className="text-sm font-normal text-slate-500">({b.serviceName})</span>
                    {b.packageId ? <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Paket · ödendi</span> : null}
                  </p>
                  {b.mode === "QUESTION" ? (
                    <p className="text-sm font-medium text-brand-700">Fotoğrafla soru · çözüm bekliyor</p>
                  ) : (
                    <p className="text-sm text-slate-700">{formatLessonRange(b.startAt, b.endAt)} · {durationLabel(b.durationMinutes)}</p>
                  )}
                  <p className="flex items-center gap-1 text-sm text-slate-600">
                    {b.mode === "ONLINE" ? <Monitor className="size-4" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                    {MODE_LABEL[b.mode]}
                    {b.inPersonPlace ? ` · ${IN_PERSON_PLACE_LABEL[b.inPersonPlace]}` : ""}
                    {b.district ? ` · ${b.district.name} / ${b.district.city.name}` : ""}
                  </p>
                  <p className="text-sm text-slate-600">
                    Öğrenci: <strong>{b.learnerName}</strong>
                    {b.learnerGrade ? ` (${b.learnerGrade})` : ""} · Veli/hesap: {b.student.firstName}
                  </p>
                  {b.studentNote ? <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">“{b.studentNote}”</p> : null}
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-900">{formatMoney(b.teacherAmount)}</p>
                  <p className="text-xs text-slate-500">kazancınız ({b.mode === "QUESTION" ? "soru" : "ders"} ücreti {formatMoney(b.price)})</p>
                  {b.approvalDeadline ? (
                    <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      <Clock className="size-3.5" aria-hidden /> {formatDuration(b.approvalDeadline.getTime() - now.getTime())} içinde yanıtlayın
                    </p>
                  ) : null}
                  {b.approvalDeadline ? <p className="mt-1 text-[11px] text-slate-400">Son: {formatDateTime(b.approvalDeadline)}</p> : null}
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4">
                {b.mode === "QUESTION" ? (
                  <div className="flex flex-wrap items-start gap-2">
                    <LinkButton href={`/ogretmen-paneli/dersler/${b.id}`}>Soruyu aç ve çöz</LinkButton>
                    <RequestActions bookingId={b.id} rejectOnly />
                  </div>
                ) : (
                  <RequestActions bookingId={b.id} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
