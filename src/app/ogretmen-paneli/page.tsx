import { CalendarDays, CheckCircle2, Circle, Clock, Inbox, Star, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { requestPublishAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { BookingRow } from "@/components/panel/booking-ui";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatDuration } from "@/lib/dates";
import { TEACHER_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { profileChecklist } from "@/server/teachers";
import { PlatformRules } from "@/components/teacher/platform-rules";

export const metadata: Metadata = { title: "Öğretmen paneli" };

export default async function TeacherDashboard() {
  const user = await requireRole("TEACHER");
  await connection();
  const now = new Date();
  const [profile, checklist, balances, pending, upcoming] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id } }),
    profileChecklist(user.id),
    teacherBalances(user.id),
    db.booking.findMany({ where: { teacherId: user.id, status: "PENDING_APPROVAL" }, orderBy: { approvalDeadline: "asc" }, take: 5 }),
    db.booking.findMany({
      where: { teacherId: user.id, status: "CONFIRMED", endAt: { gt: now } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
  ]);
  const status = TEACHER_STATUS[profile.status];

  return (
    <>
      <PageHeader
        title={`Hoş geldiniz, ${user.firstName}`}
        description={
          <span className="inline-flex items-center gap-2">
            Profil durumu: <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        actions={<LinkButton href={`/ogretmen/${profile.slug}`} variant="outline" target="_blank">Profilimi görüntüle</LinkButton>}
      />
      <PlatformRules className="mb-6" />

      {profile.status !== "PUBLISHED" ? (
        <Card className="mb-6">
          <CardHeader
            title={checklist.complete ? "Profiliniz hazır" : "Profilinizi tamamlayın"}
            description={checklist.complete ? "Yönetici onayından sonra profiliniz öğretmen listesinde görünecek." : "Aşağıdaki adımları tamamlayınca profiliniz yayına alınmak üzere incelemeye gönderilebilir."}
          />
          <CardBody className="space-y-4">
            <ul className="grid gap-2 sm:grid-cols-2">
              {checklist.items.map((item) => (
                <li key={item.key} className="flex items-center gap-2 text-sm">
                  {item.done ? <CheckCircle2 className="size-4 text-emerald-600" aria-hidden /> : <Circle className="size-4 text-slate-300" aria-hidden />}
                  <span className={item.done ? "text-slate-500 line-through" : "text-slate-800"}>{item.label}</span>
                </li>
              ))}
            </ul>
            {checklist.complete ? (
              <ActionForm action={requestPublishAction}>
                <SubmitButton>Yayına alınmasını iste</SubmitButton>
              </ActionForm>
            ) : (
              <LinkButton href="/ogretmen-paneli/profil">Profili düzenle</LinkButton>
            )}
          </CardBody>
        </Card>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Bekleyen talepler" value={pending.length} icon={<Inbox className="size-5" />} />
        <StatCard label="Yaklaşan dersler" value={upcoming.length} icon={<CalendarDays className="size-5" />} />
        <StatCard label="Ortalama puan" value={profile.ratingCount ? profile.ratingAvg.toLocaleString("tr-TR", { maximumFractionDigits: 1 }) : "—"} hint={`${profile.ratingCount} değerlendirme`} icon={<Star className="size-5" />} />
        <StatCard label="Ödenebilir bakiye" value={formatMoney(balances.available)} hint={`Bekleyen: ${formatMoney(balances.pending)}`} icon={<Wallet className="size-5" />} />
      </div>

      {pending.length ? (
        <Alert tone="warning" title="Yanıt bekleyen ders talepleriniz var" className="mb-6">
          {pending.map((b) => (
            <p key={b.id} className="flex flex-wrap items-center gap-1">
              <Clock className="size-3.5" aria-hidden /> {b.learnerName} — {b.levelName} {b.subjectName}: yanıt için {b.approvalDeadline ? formatDuration(b.approvalDeadline.getTime() - now.getTime()) : "—"} kaldı.
            </p>
          ))}
          <Link href="/ogretmen-paneli/talepler" className="mt-2 inline-block font-semibold underline">
            Taleplere git
          </Link>
        </Alert>
      ) : null}

      <Card>
        <CardHeader title="Yaklaşan dersler" action={<Link href="/ogretmen-paneli/dersler" className="text-sm font-semibold text-brand-700 hover:underline">Tümü</Link>} />
        <CardBody className="space-y-3">
          {upcoming.length ? (
            upcoming.map((b) => <BookingRow key={b.id} booking={{ ...b, counterpart: b.learnerName }} href={`/ogretmen-paneli/dersler/${b.id}`} />)
          ) : (
            <EmptyState title="Yaklaşan dersiniz yok" description="Takviminizi güncel tutmak daha fazla talep almanızı sağlar." action={<LinkButton href="/ogretmen-paneli/takvim" variant="outline">Takvimi düzenle</LinkButton>} />
          )}
        </CardBody>
      </Card>
    </>
  );
}
