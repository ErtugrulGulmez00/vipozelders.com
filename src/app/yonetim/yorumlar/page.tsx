import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, EmptyState, PageHeader, Stars } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { ReviewModeration } from "./review-moderation";

export const metadata: Metadata = { title: "Yorumlar" };

export default async function AdminReviewsPage() {
  await requireRole("ADMIN");
  const reviews = await db.review.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { teacher: { include: { user: { select: { firstName: true, lastName: true } } } }, student: { select: { firstName: true, lastName: true } }, booking: { select: { code: true, id: true } } },
  });
  return (
    <>
      <PageHeader title="Yorumlar" description="Hakaret, kişisel veri veya reklam içeren yorumları gizleyin; puan ortalaması otomatik güncellenir." />
      {reviews.length === 0 ? <EmptyState title="Yorum yok" /> : null}
      <div className="space-y-3">
        {reviews.map((r) => (
          <Card key={r.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Stars value={r.rating} />
                  <span className="font-semibold text-slate-800">
                    {r.student.firstName} {r.student.lastName}
                  </span>
                  <span className="text-slate-400">→</span>
                  <Link href={`/yonetim/ogretmenler/${r.teacherId}`} className="font-semibold text-brand-700 hover:underline">
                    {r.teacher.user.firstName} {r.teacher.user.lastName}
                  </Link>
                  <Link href={`/yonetim/randevular/${r.booking.id}`} className="text-xs text-slate-400 hover:underline">
                    {r.booking.code}
                  </Link>
                  <span className="text-xs text-slate-400">{formatCompact(r.createdAt)}</span>
                  {r.status === "HIDDEN" ? <Badge tone="rose">Gizli{r.hiddenReason ? `: ${r.hiddenReason}` : ""}</Badge> : null}
                </div>
                {r.comment ? <p className="mt-2 text-sm text-slate-700">{r.comment}</p> : null}
                {r.teacherReply ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">Öğretmen: {r.teacherReply}</p> : null}
              </div>
              <ReviewModeration reviewId={r.id} status={r.status} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
