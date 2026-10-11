import { MessageSquareQuote } from "lucide-react";
import type { Metadata } from "next";
import { Badge, Card, EmptyState, PageHeader, RatingSummary, Stars } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { shortName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { ReplyForm } from "./reply-form";

export const metadata: Metadata = { title: "Yorumlar" };

export default async function TeacherReviewsPage() {
  const user = await requireRole("TEACHER");
  const [profile, reviews] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { ratingAvg: true, ratingCount: true } }),
    db.review.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: "desc" },
      include: { student: { select: { firstName: true, lastName: true } }, booking: { select: { levelName: true, subjectName: true } } },
    }),
  ]);
  return (
    <>
      <PageHeader title="Yorumlar" description={<RatingSummary average={profile.ratingAvg} count={profile.ratingCount} />} />
      {reviews.length === 0 ? (
        <EmptyState icon={<MessageSquareQuote className="size-8" />} title="Henüz değerlendirme almadınız" description="Dersleri tamamlanan öğrenciler ve veliler değerlendirme yapabilir." />
      ) : (
        <div className="space-y-4">
          {reviews.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={r.rating} />
                <span className="text-sm font-semibold text-slate-800">{shortName(r.student)}</span>
                <span className="text-xs text-slate-400">
                  {formatDate(r.createdAt)} · {r.booking.levelName} {r.booking.subjectName}
                </span>
                {r.status === "HIDDEN" ? <Badge tone="rose">Yönetici tarafından gizlendi</Badge> : null}
              </div>
              {r.comment ? <p className="mt-2 text-sm text-slate-700">{r.comment}</p> : null}
              <ReplyForm reviewId={r.id} initial={r.teacherReply} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
