import { ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact, formatLessonRange } from "@/lib/dates";
import { db } from "@/server/db";
import { ResolveReportForm } from "./resolve-form";

export const metadata: Metadata = { title: "Ders bildirimleri" };

const name = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`;

export default async function ClassroomReportsPage() {
  const [open, closed] = await Promise.all([
    db.classroomReport.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "asc" },
      include: {
        reporter: { select: { firstName: true, lastName: true, role: true } },
        booking: { select: { id: true, code: true, startAt: true, endAt: true, learnerName: true, levelName: true, subjectName: true, student: { select: { firstName: true, lastName: true, phone: true, email: true } }, teacher: { select: { slug: true, status: true, user: { select: { firstName: true, lastName: true, phone: true } } } } } },
      },
    }),
    db.classroomReport.findMany({ where: { resolvedAt: { not: null } }, orderBy: { resolvedAt: "desc" }, take: 30, include: { booking: { select: { code: true } } } }),
  ]);

  return (
    <>
      <PageHeader
        title="Ders bildirimleri"
        description="Sanal sınıfta “Uygunsuz durum bildir” ile yapılan bildirimler. Öğrenci tarafı bildirdiğinde ders odası kapanır ve öğretmenin profili inceleme bitene kadar askıya alınır. Gerekirse veliyi ve öğretmeni arayın; ciddi durumlarda yasal mercilere (ALO 183, 155) başvurun."
      />
      {open.length === 0 ? (
        <Card>
          <EmptyState icon={<ShieldAlert className="size-8" />} title="Açık bildirim yok" />
        </Card>
      ) : (
        <div className="space-y-4">
          {open.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1 text-sm">
                  <p className="flex flex-wrap items-center gap-2">
                    <Badge tone="rose">{r.reason}</Badge>
                    <span className="text-xs text-slate-500">{formatCompact(r.createdAt)}</span>
                    {r.teacherSuspended ? <Badge tone="amber">Öğretmen askıda</Badge> : null}
                  </p>
                  <p>
                    <strong>Bildiren:</strong> {name(r.reporter)} ({r.reporter.role === "TEACHER" ? "öğretmen" : "veli/öğrenci"})
                  </p>
                  {r.details ? <p className="whitespace-pre-line rounded-lg bg-slate-50 p-3 text-slate-700">{r.details}</p> : null}
                  <p>
                    <strong>Ders:</strong>{" "}
                    <Link href={`/yonetim/randevular/${r.booking.id}`} className="font-medium text-brand-700 hover:underline">
                      {r.booking.code}
                    </Link>{" "}
                    · {r.booking.levelName} {r.booking.subjectName} · {formatLessonRange(r.booking.startAt, r.booking.endAt)} · Öğrenci: {r.booking.learnerName}
                  </p>
                  <p>
                    <strong>Veli:</strong> {name(r.booking.student)} · {r.booking.student.phone ?? "telefon yok"} · {r.booking.student.email ?? ""}
                  </p>
                  <p>
                    <strong>Öğretmen:</strong>{" "}
                    <Link href={`/ogretmen/${r.booking.teacher.slug}`} className="text-brand-700 hover:underline">
                      {name(r.booking.teacher.user)}
                    </Link>{" "}
                    · {r.booking.teacher.user.phone ?? "telefon yok"}
                  </p>
                </div>
                <div className="w-full sm:w-80">
                  <ResolveReportForm id={r.id} teacherSuspended={r.teacherSuspended} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {closed.length ? (
        <Card className="mt-6 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Kapatılanlar</h2>
          <ul className="space-y-1 text-xs text-slate-500">
            {closed.map((r) => (
              <li key={r.id}>
                {formatCompact(r.resolvedAt!)} · {r.booking.code} · {r.reason} · {r.resolutionNote}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
