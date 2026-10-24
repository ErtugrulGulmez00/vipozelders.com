import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { RefundPackageForm } from "@/components/packages/forms";
import { SectionTabs, STUDENT_LESSON_TABS } from "@/components/panel/section-tabs";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate, formatLessonRange } from "@/lib/dates";
import { BOOKING_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { packageLessonsLeft } from "@/server/bookings";
import { db } from "@/server/db";
import { packageRefundPreview } from "@/server/packages";

export const metadata: Metadata = { title: "Paketlerim" };

export default async function MyPackagesPage() {
  const user = await requireRole("STUDENT");
  const now = new Date();
  const packages = await db.lessonPackage.findMany({
    where: { studentId: user.id, status: { in: ["PAID", "CLOSED"] } },
    orderBy: { paidAt: "desc" },
    include: {
      teacher: { select: { slug: true, user: { select: { firstName: true, lastName: true } } } },
      bookings: { orderBy: { startAt: "asc" }, select: { id: true, startAt: true, endAt: true, status: true, refundedAmount: true, price: true } },
    },
    take: 30,
  });
  const extra = new Map(await Promise.all(packages.map(async (p) => [p.id, { left: await packageLessonsLeft(db, p), refund: await packageRefundPreview(p) }] as const)));

  return (
    <>
      <SectionTabs tabs={STUDENT_LESSON_TABS} active="/hesabim/paketlerim" />
      <PageHeader title="Paketlerim" description="Peşin aldığınız ders paketleri ve düzenli dersleriniz. Öğretmeninizin takviminden saat seçip “Paketimden kullan” ile ders alabilirsiniz." />
      {packages.length === 0 ? (
        <EmptyState icon={<Package className="size-8" />} title="Henüz paketiniz yok" description="Öğretmen profillerinde paket fiyatlarını görebilir, “Her hafta tekrarla” ile düzenli ders planlayabilirsiniz." action={<LinkButton href="/ogretmenler">Öğretmenleri incele</LinkButton>} />
      ) : (
        <div className="space-y-4">
          {packages.map((p) => {
            const info = extra.get(p.id)!;
            const active = p.status === "PAID" && (!p.expiresAt || p.expiresAt > now);
            return (
              <Card key={p.id}>
                <CardHeader
                  title={`${p.levelName} ${p.subjectName} · ${fullName(p.teacher.user)}`}
                  description={`${p.code} · ${p.lessonCount} ders × ${p.durationMinutes} dk · ${formatMoney(p.unitPrice)}/ders${p.recurringStartAt ? " · düzenli ders" : ""}`}
                  action={<Badge tone={active ? "green" : "slate"}>{!active ? "Kapandı" : info.left > 0 ? `${info.left} ders kaldı` : "Tüm dersler planlandı"}</Badge>}
                />
                <CardBody className="space-y-3 text-sm">
                  {p.expiresAt && active ? <p className="text-slate-600">Son kullanma: {formatDate(p.expiresAt)}. Süre dolunca kullanılmayan derslerin ücreti iade edilir.</p> : null}
                  {p.refundedAmount ? <p className="text-slate-600">İade edilen: {formatMoney(p.refundedAmount)}</p> : null}
                  {p.bookings.length ? (
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                      {p.bookings.map((b) => (
                        <li key={b.id}>
                          <Link href={`/hesabim/derslerim/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 hover:bg-slate-50">
                            <span>{formatLessonRange(b.startAt, b.endAt)}</span>
                            <Badge tone={BOOKING_STATUS[b.status]?.tone}>{b.refundedAmount >= b.price ? "Pakete döndü" : BOOKING_STATUS[b.status]?.label ?? b.status}</Badge>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {active ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {info.left > 0 ? <LinkButton href={`/ogretmen/${p.teacher.slug}#randevu`} size="sm">Saat seç</LinkButton> : null}
                      {info.refund.allowed ? <RefundPackageForm id={p.id} amountText={formatMoney(info.refund.amount)} /> : null}
                    </div>
                  ) : null}
                  {active && info.refund.allowed ? <p className="text-xs text-slate-500">Erken iadede kullanılan dersler paket indirimi olmadan (tek ders ücretinden) düşülür.</p> : null}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
