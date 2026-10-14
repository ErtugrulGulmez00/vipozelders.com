import { AlertTriangle, Banknote, CalendarCheck, CircleDollarSign, FileCheck2, GraduationCap, RotateCcw, UserPlus, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookingStatusBadge } from "@/components/panel/booking-ui";
import { Alert, Card, CardBody, CardHeader, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact, toLocalDateString, zonedDateTime } from "@/lib/dates";
import { DEMO_EMAIL_DOMAIN } from "@/lib/demo";
import { formatMoney } from "@/lib/money";
import { fullName, shortName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getPaymentProvider } from "@/server/payments/service";
import { videoConfigured } from "@/server/video-config";
import { SchedulerButton } from "./scheduler-button";

export const metadata: Metadata = { title: "Yönetim" };

export default async function AdminDashboard() {
  const admin = await requireRole("ADMIN");
  const now = new Date();
  const today = toLocalDateString(now);
  const monthStart = zonedDateTime(`${today.slice(0, 7)}-01`, 0);

  const [collected, refunds, commission, available, teachers, drafts, students, newStudents, disputes, failedRefunds, pendingApprovals, recent, demoUsers] = await Promise.all([
    db.payment.aggregate({ where: { status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"] }, createdAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.refund.aggregate({ where: { status: "SUCCEEDED", processedAt: { gte: monthStart } }, _sum: { amount: true } }),
    db.booking.aggregate({ where: { status: "COMPLETED", completedAt: { gte: monthStart } }, _sum: { commissionAmount: true }, _count: { _all: true } }),
    db.ledgerEntry.aggregate({ where: { bucket: "AVAILABLE" }, _sum: { amount: true } }),
    db.teacherProfile.count({ where: { status: "PUBLISHED" } }),
    db.teacherProfile.findMany({ where: { status: "DRAFT" }, include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 5 }),
    db.user.count({ where: { role: "STUDENT" } }),
    db.user.count({ where: { role: "STUDENT", createdAt: { gte: monthStart } } }),
    db.booking.findMany({ where: { status: "DISPUTED" }, orderBy: { disputedAt: "asc" }, take: 10 }),
    db.refund.findMany({ where: { status: "FAILED" }, include: { payment: { select: { bookingId: true } } }, take: 10 }),
    db.booking.count({ where: { status: "PENDING_APPROVAL" } }),
    db.booking.findMany({
      where: { status: { not: "PENDING_PAYMENT" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } }, student: { select: { firstName: true, lastName: true } } },
    }),
    db.user.count({ where: { email: { endsWith: `@${DEMO_EMAIL_DOMAIN}` } } }),
  ]);
  const [applications, pendingDocuments] = await Promise.all([
    db.teacherApplication.count({ where: { status: "NEW" } }),
    db.teacherDocument.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 5, include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } } } }),
  ]);
  const provider = getPaymentProvider();
  const twoFactorOn = Boolean((await db.user.findUnique({ where: { id: admin.id }, select: { totpEnabledAt: true } }))?.totpEnabledAt);

  return (
    <>
      <PageHeader title="Özet" description="Bu ayın rakamları ve dikkat isteyen işler." actions={<SchedulerButton />} />

      {!twoFactorOn ? (
        <Alert tone="warning" title="İki adımlı doğrulama kapalı" className="mb-4">
          Yönetici hesabınızı telefonunuzdaki tek kullanımlık kodla koruyun.{" "}
          <Link href="/yonetim/guvenlik" className="font-semibold underline">
            Şimdi aç
          </Link>
        </Alert>
      ) : null}
      {demoUsers > 0 ? (
        <Alert tone="warning" title="Demo veriler yüklü" className="mb-4">
          Sistemde {demoUsers} demo hesap ve bunlara ait örnek ders/yorumlar var. Canlıya çıkmadan önce veritabanını demo veriler olmadan sıfırlayın (README → “Canlıya çıkış”).
        </Alert>
      ) : null}
      {provider.id === "mock" || !videoConfigured() ? (
        <Alert tone="info" title="Geliştirme modundasınız" className="mb-6">
          {provider.id === "mock" ? "Ödemeler sahte test sağlayıcısıyla alınıyor (gerçek para çekilmez). " : ""}
          {!videoConfigured() ? "Sanal sınıf (LiveKit) anahtarları girilmedi. " : ""}
          Ayrıntılar README dosyasında.
        </Alert>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard label="Bu ay tahsilat" value={formatMoney(collected._sum.amount ?? 0)} hint={`İade: ${formatMoney(refunds._sum.amount ?? 0)}`} icon={<CircleDollarSign className="size-5" />} />
        <StatCard label="Bu ay komisyon" value={formatMoney(commission._sum.commissionAmount ?? 0)} hint={`${commission._count._all} tamamlanan ders`} icon={<Banknote className="size-5" />} />
        <StatCard label="Öğretmenlere ödenecek" value={formatMoney(available._sum.amount ?? 0)} hint={provider.automaticPayouts ? "Ödeme kuruluşu aktarır" : "Havale bekleyen serbest bakiye"} icon={<RotateCcw className="size-5" />} />
        <StatCard label="Öğretmen / öğrenci" value={`${teachers} / ${students}`} hint={`Bu ay ${newStudents} yeni üye · ${pendingApprovals} onay bekleyen talep`} icon={<Users className="size-5" />} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Açık itirazlar" />
          <CardBody className="space-y-2 text-sm">
            {disputes.length === 0 ? <p className="text-slate-500">Açık itiraz yok.</p> : null}
            {disputes.map((b) => (
              <Link key={b.id} href={`/yonetim/randevular/${b.id}`} className="flex items-start gap-2 rounded-lg p-2 hover:bg-slate-50">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-violet-600" aria-hidden />
                <span>
                  <strong>{b.code}</strong> — {b.disputeReason}
                </span>
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Başarısız iadeler" />
          <CardBody className="space-y-2 text-sm">
            {failedRefunds.length === 0 ? <p className="text-slate-500">Başarısız iade yok.</p> : null}
            {failedRefunds.map((r) => (
              <Link key={r.id} href={`/yonetim/randevular/${r.payment.bookingId}`} className="block rounded-lg p-2 text-rose-700 hover:bg-rose-50">
                {formatMoney(r.amount)} — {r.error?.slice(0, 80)}
              </Link>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Öğretmen tarafında bekleyenler" />
          <CardBody className="space-y-2 text-sm">
            {applications > 0 ? (
              <Link href="/yonetim/basvurular" className="flex items-center gap-2 rounded-lg bg-amber-50 p-2 font-medium text-amber-900 hover:bg-amber-100">
                <UserPlus className="size-4" aria-hidden /> {applications} yeni öğretmen başvurusu
              </Link>
            ) : null}
            {pendingDocuments.map((d) => (
              <Link key={d.id} href={`/yonetim/ogretmenler/${d.teacherId}?bolum=belgeler`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                <FileCheck2 className="size-4 text-amber-600" aria-hidden /> {d.teacher.user.firstName} {d.teacher.user.lastName}: belge incelemesi
              </Link>
            ))}
            {drafts.map((t) => (
              <Link key={t.userId} href={`/yonetim/ogretmenler/${t.userId}`} className="flex items-center gap-2 rounded-lg p-2 hover:bg-slate-50">
                <GraduationCap className="size-4 text-brand-600" aria-hidden /> {t.user.firstName} {t.user.lastName}: yayın bekliyor
              </Link>
            ))}
            {drafts.length === 0 && applications === 0 && pendingDocuments.length === 0 ? <p className="text-slate-500">Bekleyen başvuru, belge veya taslak profil yok.</p> : null}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Son randevular" action={<Link href="/yonetim/randevular" className="text-sm font-semibold text-brand-700 hover:underline">Tümü</Link>} />
        <Table>
          <thead>
            <tr>
              <Th>Kod</Th>
              <Th>Ders</Th>
              <Th>Öğretmen</Th>
              <Th>Öğrenci</Th>
              <Th>Tarih</Th>
              <Th>Tutar</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {recent.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link href={`/yonetim/randevular/${b.id}`} className="font-semibold text-brand-700 hover:underline">
                    {b.code}
                  </Link>
                </Td>
                <Td>
                  {b.levelName} {b.subjectName}
                </Td>
                <Td>{fullName(b.teacher.user)}</Td>
                <Td>{shortName(b.student)}</Td>
                <Td className="whitespace-nowrap">{formatCompact(b.startAt)}</Td>
                <Td>{formatMoney(b.price)}</Td>
                <Td>
                  <BookingStatusBadge status={b.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
        <CalendarCheck className="size-3.5" aria-hidden /> Dönem: {formatCompact(monthStart)} – şimdi
      </p>
    </>
  );
}
