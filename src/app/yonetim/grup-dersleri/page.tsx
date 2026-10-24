import { Users } from "lucide-react";
import type { Metadata } from "next";
import { CancelCourseForm } from "@/components/groups/forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { scheduleSummary } from "@/lib/groups";
import { GROUP_COURSE_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/text";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Grup dersleri" };

export default async function AdminGroupsPage({ searchParams }: PageProps<"/yonetim/grup-dersleri">) {
  const { ders } = await searchParams;
  const courseId = typeof ders === "string" ? ders : "";
  const [sales, courses] = await Promise.all([
    db.groupEnrollment.aggregate({ where: { paidAt: { not: null } }, _sum: { price: true, refundedAmount: true, commissionAmount: true }, _count: true }),
    db.groupCourse.findMany({
      where: courseId ? { id: courseId } : {},
      orderBy: { createdAt: "desc" },
      take: 40,
      include: {
        teacher: { select: { user: { select: { firstName: true, lastName: true } } } },
        sessions: { orderBy: { index: "asc" }, select: { startAt: true, endAt: true, status: true } },
        _count: { select: { enrollments: { where: { status: "PAID" } } } },
      },
    }),
  ]);

  return (
    <>
      <PageHeader title="Grup dersleri" description="Öğretmenlerin açtığı grup dersleri. İptal ederseniz yapılmamış oturumların ücreti öğrencilere iade edilir; yapılan oturumların payı öğretmende kalır." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Satış (net)" value={formatMoney((sales._sum.price ?? 0) - (sales._sum.refundedAmount ?? 0))} hint={`${sales._count} kayıt`} icon={<Users className="size-5" />} />
        <StatCard label="Komisyon" value={formatMoney(sales._sum.commissionAmount ?? 0)} hint="İadeler düşülmeden" />
        <StatCard label="Ders" value={courses.length} />
      </div>
      {courses.length === 0 ? (
        <Card>
          <EmptyState title="Henüz grup dersi yok" />
        </Card>
      ) : (
        <div className="space-y-4">
          {courses.map((c) => {
            const status = GROUP_COURSE_STATUS[c.status];
            const noShows = c.sessions.filter((s) => s.status === "TEACHER_NO_SHOW").length;
            return (
              <Card key={c.id}>
                <CardHeader title={`${c.code} · ${c.title}`} description={`${fullName(c.teacher.user)} · ${c.levelName} ${c.subjectName}`} action={<Badge tone={status?.tone}>{status?.label}</Badge>} />
                <CardBody className="space-y-3 text-sm text-slate-600">
                  <p>{scheduleSummary(c.sessions)}</p>
                  <p>
                    {formatMoney(c.price)} / kişi · {c._count.enrollments}/{c.capacity} kayıt (en az {c.minParticipants}) · son kayıt {formatDateTime(c.enrollDeadline)}
                    {noShows ? <span className="font-semibold text-rose-600"> · öğretmenin katılmadığı oturum: {noShows}</span> : null}
                  </p>
                  {c.status === "OPEN" || c.status === "CONFIRMED" ? <CancelCourseForm courseId={c.id} admin /> : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
