import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RefundSubscriptionForm, SubscriptionAskForm } from "@/components/subscriptions/forms";
import { LinkButton } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, DescriptionList, EmptyState } from "@/components/ui/primitives";
import { formatCompact, formatDate } from "@/lib/dates";
import { poolStatus, SUBSCRIPTION_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { isRunning, questionsToday, refundPreviewFor } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Soru aboneliği" };

export default async function MySubscriptionPage({ params }: PageProps<"/hesabim/abonelikler/[id]">) {
  const user = await requireRole("STUDENT");
  const { id } = await params;
  const sub = await db.questionSubscription.findUnique({
    where: { id },
    include: {
      teacher: { select: { slug: true, user: { select: { firstName: true, lastName: true } } } },
      plan: { select: { id: true, isActive: true, price: true } },
      questions: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  if (!sub || sub.studentId !== user.id) notFound();
  const now = new Date();
  const settings = await loadSettings();
  const running = isRunning(sub, now);
  const queued = sub.status === "ACTIVE" && Boolean(sub.startsAt && sub.startsAt > now);
  const [today, refund, next] = await Promise.all([
    running ? questionsToday(sub.id, now) : Promise.resolve(0),
    refundPreviewFor(sub, settings, now),
    // Bu dönemden sonra başlayacak (yenilenmiş) dönem
    sub.endsAt ? db.questionSubscription.findFirst({ where: { studentId: user.id, teacherId: sub.teacherId, levelId: sub.levelId, subjectId: sub.subjectId, status: "ACTIVE", startsAt: { gte: sub.endsAt } }, select: { id: true, startsAt: true } }) : null,
  ]);
  const left = Math.max(0, sub.dailyLimit - today);
  const canRenew = Boolean(sub.plan?.isActive) && !next && (sub.status === "ACTIVE" || sub.status === "ENDED");
  const status = queued ? { label: `${formatDate(sub.startsAt!)} başlayacak`, tone: "sky" as const } : SUBSCRIPTION_STATUS[sub.status];

  return (
    <div className="space-y-5">
      <Link href="/hesabim/abonelikler" className="text-sm text-brand-700 hover:underline">
        ← Soru aboneliklerim
      </Link>

      <Card>
        <CardHeader
          title={`${sub.levelName} ${sub.subjectName} · ${fullName(sub.teacher.user)}`}
          description={sub.code}
          action={<Badge tone={status?.tone}>{status?.label ?? sub.status}</Badge>}
        />
        <CardBody className="space-y-4">
          <DescriptionList
            items={[
              { label: "Dönem", value: sub.startsAt && sub.endsAt ? `${formatDate(sub.startsAt)} – ${formatDate(sub.endsAt)}` : "—" },
              { label: "Günlük sınır", value: `${sub.dailyLimit} soru${running ? ` · bugün kalan ${left}` : ""}` },
              { label: "Cevap süresi", value: `${sub.answerHours} saat` },
              { label: "Ücret", value: formatMoney(sub.price) },
              ...(sub.refundedAmount ? [{ label: "İade", value: formatMoney(sub.refundedAmount) }] : []),
              ...(sub.cancelReason ? [{ label: "Bitiş nedeni", value: sub.cancelReason }] : []),
            ]}
          />
          {next ? <Alert tone="success">Aboneliğiniz yenilendi; sonraki dönem {formatDate(next.startsAt!)} tarihinde başlıyor.</Alert> : null}
          <div className="flex flex-wrap gap-2">
            {canRenew && sub.plan ? (
              <LinkButton href={`/abonelik/${sub.plan.id}`} variant={sub.status === "ENDED" ? "primary" : "outline"}>
                {sub.status === "ENDED" ? "Yeniden abone ol" : "Şimdiden yenile"} ({formatMoney(sub.plan.price)})
              </LinkButton>
            ) : null}
            {refund.allowed ? <RefundSubscriptionForm id={sub.id} amountText={formatMoney(refund.amount)} /> : null}
          </div>
          {sub.status === "ACTIVE" && !refund.allowed ? <p className="text-xs text-slate-500">İade: {refund.reason}</p> : null}
        </CardBody>
      </Card>

      {running ? (
        <Card>
          <CardHeader title="Soru gönder" description={`Sorunuz doğrudan ${sub.teacher.user.firstName} öğretmene gider ve en geç ${sub.answerHours} saat içinde çözülür.`} />
          <CardBody>
            {left > 0 ? <SubscriptionAskForm subscriptionId={sub.id} left={left} /> : <Alert tone="info">Bugünkü {sub.dailyLimit} soru hakkınızı kullandınız; yarın yeniden gönderebilirsiniz.</Alert>}
          </CardBody>
        </Card>
      ) : queued ? (
        <Alert tone="info">Bu dönem {formatDate(sub.startsAt!)} tarihinde başlıyor; o güne kadar mevcut aboneliğinizden soru gönderebilirsiniz.</Alert>
      ) : null}

      <Card>
        <CardHeader title="Bu dönemdeki sorularım" />
        {sub.questions.length === 0 ? (
          <EmptyState title="Henüz soru göndermediniz" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sub.questions.map((q) => {
              const st = poolStatus(q);
              return (
                <li key={q.id}>
                  <Link href={`/hesabim/sorularim/${q.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                    <span className="text-sm text-slate-800">
                      {q.code} <span className="text-xs text-slate-500">· {formatCompact(q.createdAt)}</span>
                    </span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
