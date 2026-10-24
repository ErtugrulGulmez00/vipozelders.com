import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime } from "@/lib/dates";
import { GROUP_COURSE_STATUS, GROUP_ENROLLMENT_STATUS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Grup derslerim" };

export default async function MyGroupsPage() {
  const user = await requireRole("STUDENT");
  const now = new Date();
  const enrollments = await db.groupEnrollment.findMany({
    where: { studentId: user.id, status: { in: ["PAID", "INVITED", "CANCELLED"] } },
    include: { course: { include: { sessions: { where: { status: "SCHEDULED", endAt: { gt: now } }, orderBy: { startAt: "asc" }, take: 1 } } } },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return (
    <>
      <PageHeader title="Grup derslerim" description="Kayıtlı olduğunuz grup dersleri ve öğretmenlerinizin davetleri." actions={<LinkButton href="/grup-dersleri" variant="outline">Grup derslerini incele</LinkButton>} />
      {enrollments.length === 0 ? (
        <EmptyState icon={<Users className="size-8" />} title="Henüz grup dersiniz yok" description="4–10 kişilik online grup derslerine birebir dersten daha uygun fiyata katılabilirsiniz." action={<LinkButton href="/grup-dersleri">Grup dersleri</LinkButton>} />
      ) : (
        <Card className="divide-y divide-slate-100">
          {enrollments.map((e) => {
            const status = e.status === "PAID" ? GROUP_COURSE_STATUS[e.course.status] : GROUP_ENROLLMENT_STATUS[e.status];
            const next = e.course.sessions[0];
            return (
              <Link key={e.id} href={e.status === "INVITED" ? `/grup-dersleri/${e.course.code}` : `/hesabim/grup-derslerim/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">{e.course.title}</p>
                  <p className="text-xs text-slate-500">
                    {e.course.levelName} {e.course.subjectName}
                    {e.status === "PAID" && next ? ` · sıradaki ders: ${formatDateTime(next.startAt)}` : ""}
                    {e.status === "INVITED" ? " · öğretmeniniz sizi davet etti" : ""}
                  </p>
                </div>
                <Badge tone={status?.tone}>{status?.label}</Badge>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
