import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CreateCourseForm } from "@/components/groups/forms";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatDateTime, toLocalDateString } from "@/lib/dates";
import { GROUP_COURSE_STATUS } from "@/lib/labels";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { loadSettings } from "@/server/settings";
import { teacherPlanPairs } from "@/server/subscriptions";

export const metadata: Metadata = { title: "Grup dersleri" };

export default async function TeacherGroupsPage() {
  const user = await requireRole("TEACHER");
  const now = new Date();
  const [settings, pairs, courses] = await Promise.all([
    loadSettings(),
    teacherPlanPairs(user.id),
    db.groupCourse.findMany({
      where: { teacherId: user.id },
      orderBy: { createdAt: "desc" },
      include: { sessions: { orderBy: { index: "asc" }, select: { startAt: true, status: true } }, _count: { select: { enrollments: { where: { status: "PAID" } } } } },
      take: 50,
    }),
  ]);
  const commission = (settings.groupCommissionBps / 100).toLocaleString("tr-TR");

  return (
    <>
      <PageHeader
        title="Grup dersleri"
        description={`Sanal sınıfta ${settings.groupMinParticipants}–${settings.groupMaxCapacity} kişilik grup dersi verin. Öğrenciler kişi başı ücreti öder; hizmet bedeli %${commission}. Kayıt bitişinde en az kişi sayısı dolmazsa ders iptal olur ve herkese tam iade yapılır.`}
      />
      {!settings.groupsEnabled ? <Alert tone="warning" className="mb-6">Grup dersi şu an kapalı.</Alert> : null}

      <Card className="mb-6">
        <CardHeader title="Derslerim" />
        {courses.length === 0 ? (
          <EmptyState icon={<Users className="size-8" />} title="Henüz grup dersiniz yok" description="Aşağıdaki formla ilk programınızı oluşturun." />
        ) : (
          <ul className="divide-y divide-slate-100">
            {courses.map((c) => {
              const next = c.sessions.find((s) => s.status === "SCHEDULED" && s.startAt > now);
              const status = GROUP_COURSE_STATUS[c.status];
              return (
                <li key={c.id}>
                  <Link href={`/ogretmen-paneli/grup-dersleri/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="block font-medium text-slate-900">{c.title}</span>
                      <span className="block text-xs text-slate-500">
                        {c.levelName} {c.subjectName} · {c.sessions.length} oturum · {formatMoney(c.price)} · {c._count.enrollments}/{c.capacity} kayıt (en az {c.minParticipants})
                        {next ? ` · sıradaki: ${formatDateTime(next.startAt)}` : ""}
                      </span>
                    </span>
                    <Badge tone={status?.tone}>{status?.label ?? c.status}</Badge>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {settings.groupsEnabled ? (
        <Card>
          <CardHeader title="Yeni grup dersi" description="Program birebir derslerinizle çakışamaz; oluşturduğunuz oturum saatleri takviminizde dolu görünür." />
          <CardBody>
            {pairs.length ? (
              <CreateCourseForm
                pairs={pairs.map((p) => ({ value: `${p.levelId}:${p.subjectId}`, label: p.label }))}
                today={toLocalDateString(now)}
                limits={{ minParticipants: settings.groupMinParticipants, maxCapacity: settings.groupMaxCapacity, minPriceTl: settings.groupMinPriceTl, maxPriceTl: settings.groupMaxPriceTl, commissionBps: settings.groupCommissionBps }}
              />
            ) : (
              <Alert tone="warning">Grup dersi açmak için önce Dersler ve fiyatlar sayfasından ders ekleyin.</Alert>
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
