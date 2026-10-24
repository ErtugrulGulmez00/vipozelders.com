import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import { PlanForm } from "@/components/subscriptions/forms";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { shortName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { splitCommission } from "@/server/pricing";
import { loadSettings } from "@/server/settings";
import { questionsToday, teacherPlanPairs } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Soru aboneliği" };

export default async function TeacherSubscriptionsPage() {
  const user = await requireRole("TEACHER");
  const now = new Date();
  const [settings, teacher, pairs, plans, active, totals] = await Promise.all([
    loadSettings(),
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { status: true } }),
    teacherPlanPairs(user.id),
    db.questionPlan.findMany({ where: { teacherId: user.id }, include: { level: { select: { name: true } }, subject: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
    db.questionSubscription.findMany({
      where: { teacherId: user.id, status: "ACTIVE" },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { endsAt: "asc" },
    }),
    db.questionSubscription.aggregate({ where: { teacherId: user.id, status: { in: ["ACTIVE", "ENDED", "CANCELLED"] } }, _sum: { teacherAmount: true }, _count: true }),
  ]);
  const commission = (settings.subscriptionCommissionBps / 100).toLocaleString("tr-TR");
  const used = new Set(plans.map((p) => `${p.levelId}:${p.subjectId}`));
  const freePairs = pairs.filter((p) => !used.has(`${p.levelId}:${p.subjectId}`)).map((p) => ({ value: `${p.levelId}:${p.subjectId}`, label: p.label }));
  const today = new Map(await Promise.all(active.map(async (s) => [s.id, await questionsToday(s.id, now)] as const)));
  const example = splitCommission(100_000, settings.subscriptionCommissionBps).teacherAmount;
  const limits = { minTl: settings.subscriptionMinPriceTl, maxTl: settings.subscriptionMaxPriceTl };

  return (
    <>
      <PageHeader
        title="Soru aboneliği"
        description={`Öğrencilere ${settings.subscriptionDays} günlük soru çözüm aboneliği satın. Abonenizin soruları doğrudan size gelir. Hizmet bedeli %${commission}: ${formatMoney(100_000)} abonelikten size ${formatMoney(example)} kalır; dönem bitince ödenebilir bakiyenize geçer.`}
      />

      {!settings.subscriptionsEnabled ? <Alert tone="warning" className="mb-6">Soru aboneliği şu an kapalı.</Alert> : null}
      {teacher.status !== "PUBLISHED" ? <Alert tone="info" className="mb-6">Planlarınız profiliniz yayına alındığında görünür.</Alert> : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Aktif abone" value={active.filter((s) => s.startsAt && s.startsAt <= now).length} icon={<Repeat className="size-5" />} />
        <StatCard label="Toplam dönem" value={totals._count} />
        <StatCard label="Toplam hakediş" value={formatMoney(totals._sum.teacherAmount ?? 0)} hint="Erken biten dönemlerde kalan günler veliye iade edilir" />
      </div>

      <Alert tone="info" className="mb-6" title="Nasıl işler?">
        Abone günde en fazla belirlediğiniz sayıda soru gönderir; sorular Soru havuzu sayfanızda “Abone” etiketiyle en üstte görünür. Her soruyu belirlediğiniz sürede cevaplayın:{" "}
        {settings.subscriptionMissLimit} soru süresinde cevaplanmazsa abonelik biter ve kalan günlerin ücreti veliye iade edilir.
      </Alert>

      {plans.map((plan) => (
        <Card key={plan.id} className="mb-6">
          <CardHeader
            title={`${plan.level.name} · ${plan.subject.name}`}
            action={plan.isActive ? <Badge tone="green">Satışta</Badge> : <Badge>Kapalı</Badge>}
          />
          <CardBody>
            <PlanForm
              limits={limits}
              values={{ pair: `${plan.levelId}:${plan.subjectId}`, label: "", priceTl: plan.price / 100, dailyLimit: plan.dailyLimit, answerHours: plan.answerHours, description: plan.description ?? "", isActive: plan.isActive }}
            />
            <p className="mt-3 text-xs text-slate-500">Değişiklikler yeni aboneliklerde geçerli olur; süren dönemler satın alındığı koşullarla devam eder.</p>
          </CardBody>
        </Card>
      ))}

      {freePairs.length ? (
        <Card className="mb-6">
          <CardHeader title={plans.length ? "Yeni plan ekle" : "İlk planınızı oluşturun"} description="Her kademe ve ders için ayrı plan açabilirsiniz." />
          <CardBody>
            <PlanForm pairs={freePairs} limits={limits} />
          </CardBody>
        </Card>
      ) : pairs.length === 0 ? (
        <Alert tone="warning" className="mb-6">Plan açmak için önce Dersler ve fiyatlar sayfasından ders ekleyin.</Alert>
      ) : null}

      <Card>
        <CardHeader title="Aboneleriniz" />
        {active.length === 0 ? (
          <EmptyState icon={<Repeat className="size-8" />} title="Henüz aboneniz yok" description="Planınız profilinizde “Aylık soru aboneliği” olarak görünür." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {active.map((s) => {
              const started = Boolean(s.startsAt && s.startsAt <= now);
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <span>
                    <span className="font-medium text-slate-900">{shortName(s.student)}</span> · {s.levelName} {s.subjectName}
                    <span className="block text-xs text-slate-500">
                      {started ? `Bitiş: ${formatDate(s.endsAt!)}` : `Başlangıç: ${formatDate(s.startsAt!)}`} · bugün {today.get(s.id) ?? 0}/{s.dailyLimit} soru
                      {s.missedCount ? ` · cevaplanmayan ${s.missedCount}/${settings.subscriptionMissLimit}` : ""}
                    </span>
                  </span>
                  <span className="font-semibold text-emerald-700">{formatMoney(s.teacherAmount)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
