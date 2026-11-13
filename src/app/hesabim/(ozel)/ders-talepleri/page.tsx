import { GraduationCap, Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ReviewForm } from "@/app/hesabim/(ozel)/derslerim/[id]/student-forms";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { REVIEW_MIN_MEETING_MINUTES, reviewEligibility } from "@/server/reviews";
import { INQUIRY_MODE_LABEL, requesterInquiries } from "@/server/teacher-inquiries";

export const metadata: Metadata = { title: "Ders taleplerim" };

const STATUS = {
  PENDING: { label: "Öğretmenin yanıtı bekleniyor", tone: "amber" },
  ACCEPTED: { label: "Kabul edildi", tone: "green" },
  DECLINED: { label: "Öğretmen şu an öğrenci alamıyor", tone: "slate" },
} as const;

/** Velinin öğretmenlere gönderdiği ders talepleri; kabul edilen öğretmenle görüntülü ders yapıldıysa değerlendirme. */
export default async function MyInquiriesPage() {
  const user = await requireRole("STUDENT");
  await connection();
  const items = await requesterInquiries(user.id);
  // Değerlendirme hakkı öğretmen başına bir kez hesaplanır
  const accepted = [...new Set(items.filter((q) => q.status === "ACCEPTED").map((q) => q.teacherId))];
  const eligibility = new Map(await Promise.all(accepted.map(async (teacherId) => [teacherId, await reviewEligibility(user.id, teacherId)] as const)));
  const shownReview = new Set<string>();

  return (
    <>
      <PageHeader
        title="Ders taleplerim"
        description="Öğretmenlere gönderdiğiniz ders talepleri. Öğretmen kabul edince sizi arar; ders saatini ve ücreti onunla konuşursunuz, ödemeyi doğrudan öğretmene yaparsınız."
        actions={<LinkButton href="/ogretmenler">Öğretmen bul</LinkButton>}
      />
      {items.length ? (
        <div className="space-y-3">
          {items.map((q) => {
            const teacherName = `${q.teacher.firstName} ${q.teacher.lastName.charAt(0)}.`;
            const slug = q.teacher.teacherProfile?.slug;
            const review = q.status === "ACCEPTED" && !shownReview.has(q.teacherId) ? eligibility.get(q.teacherId) : undefined;
            if (review) shownReview.add(q.teacherId);
            return (
              <Card key={q.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {slug ? (
                        <Link href={`/ogretmen/${slug}`} className="hover:underline">
                          {teacherName}
                        </Link>
                      ) : (
                        teacherName
                      )}
                      <span className="font-normal text-slate-500">
                        {" "}
                        · {q.lessonName ?? "Ders belirtilmedi"}
                        {q.studentName ? `, ${q.studentName}` : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatCompact(q.createdAt)} · {INQUIRY_MODE_LABEL[q.mode] ?? q.mode}
                    </p>
                  </div>
                  <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                </div>
                {q.status === "ACCEPTED" ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Öğretmen sizi {q.phone.replace(/^(\d{4})(\d{3})(\d{2})(\d{2})$/, "$1 $2 $3 $4")} numarasından arayacak.
                    {q.centerStudentId ? (
                      <>
                        {" "}
                        Program, ödev, deneme ve koçluk notları{" "}
                        <Link href="/kocum" className="font-semibold text-brand-700 hover:underline">
                          Koçum
                        </Link>{" "}
                        bölümünde.
                      </>
                    ) : null}
                  </p>
                ) : q.status === "PENDING" ? (
                  <p className="mt-3 text-sm text-slate-600">Öğretmen talebinizi kabul edince telefon numaranızı görür ve sizi arar; size e-postayla da haber veririz.</p>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Aynı derste başka öğretmenlere göz atabilirsiniz.{" "}
                    <Link href="/ogretmenler" className="font-semibold text-brand-700 hover:underline">
                      Öğretmenler
                    </Link>
                  </p>
                )}
                {review ? (
                  review.eligible ? (
                    <div className="mt-4 border-t border-slate-100 pt-4">
                      <p className="mb-3 text-sm font-semibold text-slate-900">{review.existing ? "Değerlendirmeniz" : "Öğretmeninizi değerlendirin"}</p>
                      <ReviewForm teacherId={q.teacherId} initialRating={review.existing?.rating} initialComment={review.existing?.comment} />
                    </div>
                  ) : (
                    <p className="mt-3 text-xs text-slate-500">Öğretmeninizle Pi Koç&apos;ta en az {REVIEW_MIN_MEETING_MINUTES} dakikalık bir görüntülü ders yaptıktan sonra onu burada değerlendirebilirsiniz.</p>
                  )
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Inbox className="size-8" />}
          title="Henüz ders talebiniz yok"
          description="Öğretmenin profilindeki “Ders talebi gönder” ile ücretsiz başvurursunuz; öğretmen kabul edince sizi arar."
          action={
            <LinkButton href="/ogretmenler">
              <GraduationCap className="size-4" aria-hidden /> Öğretmen bul
            </LinkButton>
          }
        />
      )}
    </>
  );
}
