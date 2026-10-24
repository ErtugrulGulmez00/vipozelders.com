import { Inbox } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AnswersPoolToggle, ClaimForm } from "@/components/panel/pool-forms";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Stars } from "@/components/ui/primitives";
import { formatCompact, formatDateTime } from "@/lib/dates";
import { poolStatus } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { teacherPoolFeed } from "@/server/question-pool";
import { loadSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Soru havuzu" };

export default async function TeacherPoolPage() {
  const user = await requireRole("TEACHER");
  const [teacher, settings, feed] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { answersPool: true, status: true, verificationStatus: true } }),
    loadSettings(),
    teacherPoolFeed(user.id),
  ]);
  // Abone soruları en üstte, en yakın son süreye göre
  const active = feed.mine.filter((q) => q.status === "CLAIMED").sort((a, b) => Number(Boolean(b.subscriptionId)) - Number(Boolean(a.subscriptionId)) || (a.claimExpiresAt?.getTime() ?? 0) - (b.claimExpiresAt?.getTime() ?? 0));
  const history = feed.mine.filter((q) => q.status !== "CLAIMED");
  const solved = history.filter((q) => ["ANSWERED", "CLOSED"].includes(q.status));

  return (
    <>
      <PageHeader
        title="Soru havuzu"
        description={`Öğrencilerin fotoğrafla gönderdiği sorular, ders verdiğiniz kademe ve derslere göre burada listelenir. İlk üstlenen çözer; çözülen her soru için ${formatMoney(settings.poolTeacherFeeTl * 100)} hakediş oluşur. Üstlendiğiniz soruyu ${settings.poolClaimMinutes} dakika içinde çözmezseniz havuza geri döner.`}
      />

      <Card className="mb-6">
        <CardBody className="space-y-3">
          <AnswersPoolToggle on={teacher.answersPool} />
          <p className="text-sm text-slate-500">
            Ortalama puanınız: {feed.standing.avg ? <><Stars value={feed.standing.avg} /> {feed.standing.avg.toFixed(1)} ({feed.standing.ratings} puan)</> : "henüz yok"} · Çözdüğünüz soru: {solved.length}
          </p>
        </CardBody>
      </Card>

      {!feed.eligible ? (
        <Alert tone="warning" className="mb-6" title="Havuzdaki soruları şu an göremiyorsunuz">
          {!teacher.answersPool
            ? "Soru havuzuna katılımınız kapalı."
            : teacher.status !== "PUBLISHED"
              ? "Profiliniz yayında olduğunda havuz açılır."
              : settings.poolVerifiedOnly && teacher.verificationStatus !== "VERIFIED"
                ? "Havuz yalnızca belgeleri onaylı öğretmenlere açık. Belgelerim sayfasından belgelerinizi yükleyin."
                : "Hesabınız havuza uygun değil."}
        </Alert>
      ) : null}
      {feed.standing.blocked ? (
        <Alert tone="error" className="mb-6" title="Havuz erişiminiz geçici olarak kapalı">
          Düşük puan ya da haklı bulunan itirazlar nedeniyle yeni soru üstlenemiyorsunuz. Destek ekibiyle görüşün.
        </Alert>
      ) : null}

      {active.length ? (
        <Card className="mb-6">
          <CardHeader title="Üzerinizdeki sorular" />
          <ul className="divide-y divide-slate-100">
            {active.map((q) => (
              <li key={q.id}>
                <Link href={`/ogretmen-paneli/soru-havuzu/${q.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50">
                  <span className="font-medium text-slate-900">
                    {q.subscriptionId ? <Badge tone="violet" className="mr-2">Abone</Badge> : null}
                    {q.levelName} · {q.subjectName}
                  </span>
                  <span className="text-sm text-amber-700">Son: {q.claimExpiresAt ? formatDateTime(q.claimExpiresAt) : "—"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="mb-6">
        <CardHeader title="Havuzdaki sorular" description="En eski soru en üstte." />
        {feed.open.length === 0 ? (
          <EmptyState icon={<Inbox className="size-8" />} title="Şu an bekleyen soru yok" description="Yeni soru geldiğinde bildirim alırsınız." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {feed.open.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <Link href={`/ogretmen-paneli/soru-havuzu/${q.id}`} className="min-w-0 hover:underline">
                  <p className="font-medium text-slate-900">
                    {q.levelName} · {q.subjectName}
                  </p>
                  <p className="text-xs text-slate-500">
                    {formatCompact(q.createdAt)} · {formatMoney(q.teacherFee)}
                    {q.note ? ` · “${q.note.slice(0, 60)}${q.note.length > 60 ? "…" : ""}”` : ""}
                  </p>
                </Link>
                <ClaimForm id={q.id} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {history.length ? (
        <Card>
          <CardHeader title="Geçmiş" />
          <ul className="divide-y divide-slate-100">
            {history.map((q) => {
              const status = poolStatus(q);
              return (
                <li key={q.id}>
                  <Link href={`/ogretmen-paneli/soru-havuzu/${q.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 hover:bg-slate-50">
                    <span className="text-sm text-slate-800">
                      {q.subscriptionId ? <Badge tone="violet" className="mr-2">Abone</Badge> : null}
                      {q.levelName} · {q.subjectName} <span className="text-xs text-slate-400">{q.code}</span>
                      {q.followUpText && !q.followUpAnswer ? <span className="ml-2 text-xs font-semibold text-amber-700">ek soru bekliyor</span> : null}
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
