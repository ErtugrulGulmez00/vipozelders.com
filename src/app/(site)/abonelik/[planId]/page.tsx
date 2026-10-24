import { CalendarRange, Clock, MessageCircleQuestion, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SubscribeForm } from "@/components/subscriptions/forms";
import { Alert, Avatar, Card, DescriptionList } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { fullName, initials } from "@/lib/text";
import { requireUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { salesOpen } from "@/server/payments/service";
import { loadSettings } from "@/server/settings";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = { title: "Soru aboneliği" };
export const instant = false;

export default async function SubscribePage({ params }: PageProps<"/abonelik/[planId]">) {
  const user = await requireUser();
  const { planId } = await params;
  const [settings, plan] = await Promise.all([
    loadSettings(),
    db.questionPlan.findUnique({
      where: { id: planId },
      include: { level: true, subject: true, teacher: { include: { user: { select: { firstName: true, lastName: true, status: true } } } } },
    }),
  ]);
  if (!plan || !plan.isActive || plan.teacher.status !== "PUBLISHED" || plan.teacher.user.status !== "ACTIVE" || !settings.subscriptionsEnabled) notFound();
  const now = new Date();
  const current = user.role === "STUDENT"
    ? await db.questionSubscription.findFirst({
        where: { studentId: user.id, teacherId: plan.teacherId, levelId: plan.levelId, subjectId: plan.subjectId, status: "ACTIVE", endsAt: { gt: now } },
        orderBy: { endsAt: "desc" },
      })
    : null;
  const teacherName = fullName(plan.teacher.user);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href={`/ogretmen/${plan.teacher.slug}`} className="text-sm text-brand-700 hover:underline">
        ← {teacherName}
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">
        {plan.level.name} {plan.subject.name} soru aboneliği
      </h1>
      <p className="mt-1 text-slate-600">{settings.subscriptionDays} gün boyunca sorularınızın fotoğrafını doğrudan {plan.teacher.user.firstName} öğretmene gönderin.</p>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex items-center gap-3">
          <Avatar src={uploadUrl(plan.teacher.photoKey)} name={teacherName} initials={initials(plan.teacher.user)} size={48} />
          <div>
            <p className="font-semibold text-slate-900">{teacherName}</p>
            {plan.teacher.headline ? <p className="text-sm text-slate-500">{plan.teacher.headline}</p> : null}
          </div>
        </div>
        <ul className="mb-5 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <li className="flex gap-2"><CalendarRange className="size-4 shrink-0 text-brand-600" aria-hidden /> {settings.subscriptionDays} gün geçerli</li>
          <li className="flex gap-2"><MessageCircleQuestion className="size-4 shrink-0 text-brand-600" aria-hidden /> Günde {plan.dailyLimit} soruya kadar</li>
          <li className="flex gap-2"><Clock className="size-4 shrink-0 text-brand-600" aria-hidden /> Her soru {plan.answerHours} saat içinde çözülür</li>
          <li className="flex gap-2"><ShieldCheck className="size-4 shrink-0 text-brand-600" aria-hidden /> Otomatik çekim yok, kendiliğinden yenilenmez</li>
        </ul>
        {plan.description ? <p className="mb-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{plan.description}</p> : null}
        <DescriptionList
          items={[
            { label: "Ücret", value: `${formatMoney(plan.price)} (KDV dahil, tek çekim)` },
            { label: "Dönem", value: current ? `Mevcut aboneliğiniz bitince başlar (${formatDate(current.endsAt!)})` : `Ödeme anından itibaren ${settings.subscriptionDays} gün` },
            { label: "Yenileme", value: "Otomatik çekim yoktur; dönem bitmeden size hatırlatırız." },
          ]}
        />
        <p className="mt-4 text-xs text-slate-500">
          Abonelik ödemeyle hemen başlar; bedeli iade edilmez. Öğretmen hizmeti veremez hâle gelirse (ör. hesabı kapanırsa) kalan günlerin ücreti kartınıza iade edilir.
        </p>
      </Card>

      <Card className="mt-6 p-5">
        {user.role !== "STUDENT" ? (
          <Alert tone="warning" title="Abonelik yalnızca veli/öğrenci hesabıyla alınabilir">
            Şu an farklı bir hesap türüyle giriş yaptınız. Çıkış yapıp veli/öğrenci hesabıyla giriş yapın.
          </Alert>
        ) : !salesOpen() ? (
          <Alert tone="info" title="Online ödeme çok yakında">
            Ödeme altyapımız açılınca buradan abone olabileceksiniz.
          </Alert>
        ) : (
          <SubscribeForm planId={plan.id} label={`${formatMoney(plan.price)} öde ve ${current ? "yenile" : "abone ol"}`} />
        )}
      </Card>
    </div>
  );
}
