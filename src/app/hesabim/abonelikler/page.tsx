import { Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { SUBSCRIPTION_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { fullName } from "@/lib/text";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Soru aboneliklerim" };

export default async function MySubscriptionsPage() {
  const user = await requireRole("STUDENT");
  const now = new Date();
  const subs = await db.questionSubscription.findMany({
    where: { studentId: user.id, status: { notIn: ["PENDING_PAYMENT", "FAILED", "EXPIRED"] } },
    include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: [{ status: "asc" }, { endsAt: "desc" }],
    take: 50,
  });

  return (
    <>
      <PageHeader
        title="Soru aboneliklerim"
        description="Abone olduğunuz öğretmenlere sorularınızı doğrudan gönderin. Otomatik çekim yoktur; dönem bitmeden yenileyebilirsiniz."
        actions={<LinkButton href="/ogretmenler?service=soru-cozum" variant="outline">Öğretmen bul</LinkButton>}
      />
      {subs.length === 0 ? (
        <EmptyState
          icon={<Repeat className="size-8" />}
          title="Henüz aboneliğiniz yok"
          description="Öğretmen profillerinde “Aylık soru aboneliği” bulunan öğretmenlere abone olabilirsiniz."
          action={<LinkButton href="/ogretmenler">Öğretmenleri incele</LinkButton>}
        />
      ) : (
        <Card className="divide-y divide-slate-100">
          {subs.map((s) => {
            const queued = s.status === "ACTIVE" && s.startsAt && s.startsAt > now;
            const status = queued ? { label: `${formatDate(s.startsAt!)} başlayacak`, tone: "sky" as const } : SUBSCRIPTION_STATUS[s.status];
            return (
              <Link key={s.id} href={`/hesabim/abonelikler/${s.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50">
                <div>
                  <p className="font-medium text-slate-900">
                    {s.levelName} {s.subjectName} · {fullName(s.teacher.user)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.code} · {formatMoney(s.price)}
                    {s.endsAt ? ` · ${s.status === "ACTIVE" ? "bitiş" : "bitti"}: ${formatDate(s.endsAt)}` : ""}
                  </p>
                </div>
                <Badge tone={status?.tone}>{status?.label ?? s.status}</Badge>
              </Link>
            );
          })}
        </Card>
      )}
    </>
  );
}
