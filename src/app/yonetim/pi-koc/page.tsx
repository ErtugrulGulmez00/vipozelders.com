import { HeartHandshake } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { connection } from "next/server";
import { TierIcon } from "@/components/koc/premium";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { COACH_FREE_NAME, coachPlan, coachTierName, formatHours, meetingMinutes } from "@/lib/pi-koc";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { monthStartOf } from "@/server/koc-meeting-usage";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = { title: "Pi Koç hesapları" };

const FILTERS = [
  { key: "", label: "Tümü" },
  { key: "ucretli", label: "Ücretli" },
  { key: "ucretsiz", label: "Ücretsiz" },
  { key: "sinirda", label: "Sınıra dayananlar" },
] as const;

/** Bireysel koçların ve öğretmenlerin Pi Koç hesapları: paket, öğrenci, bu ayki görüntülü görüşme, bitiş. */
export default async function AdminCoachAccountsPage({ searchParams }: PageProps<"/yonetim/pi-koc">) {
  await requireRole("ADMIN");
  await connection();
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const filter = String(sp.durum ?? "");
  const now = new Date();
  const monthStart = monthStartOf(now);
  const [centers, settings, revenue, meetings] = await Promise.all([
    db.center.findMany({
      where: { kind: "COACH", ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { members: { some: { user: { OR: [{ firstName: { contains: q, mode: "insensitive" as const } }, { lastName: { contains: q, mode: "insensitive" as const } }] } } } }] } : {}) },
      include: {
        _count: { select: { students: { where: { status: "ACTIVE" } } } },
        members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { id: true, firstName: true, lastName: true, phone: true, role: true, lastLoginAt: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getSiteSettings(),
    db.centerSubscriptionPayment.aggregate({ where: { center: { kind: "COACH" } }, _sum: { amount: true } }),
    db.coachMeeting.findMany({ where: { center: { kind: "COACH" }, OR: [{ endedAt: null }, { endedAt: { gt: monthStart } }] }, select: { centerId: true, startedAt: true, endedAt: true } }),
  ]);
  const rows = centers.map((c) => {
    const plan = coachPlan(c, settings.piKocFreeStudents, now);
    const used = meetingMinutes(meetings.filter((m) => m.centerId === c.id), monthStart, now);
    const full = c._count.students >= plan.studentLimit;
    return { c, plan, used, full, owner: c.members[0]?.user ?? null };
  });
  rows.sort((a, b) => Number(b.plan.paid) - Number(a.plan.paid) || b.c._count.students - a.c._count.students);
  const shown = rows.filter((r) => (filter === "ucretli" ? r.plan.paid : filter === "ucretsiz" ? !r.plan.paid : filter === "sinirda" ? !r.plan.paid && r.full : true));
  return (
    <>
      <PageHeader
        title="Pi Koç hesapları"
        description="Koçların ve öğretmenlerin öğrenci takip paneli. Öğretmen hesabı açılınca ücretsiz paket kendiliğinden açılır; ücretli paketi ödemeyi kaydederek açarsınız."
        actions={
          <Link href="/yonetim/kurumlar" className={buttonClasses("ghost", "sm")}>
            Kurumlar
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Pi Koç hesabı" value={rows.length} hint={`${rows.filter((r) => r.c._count.students > 0).length} hesapta öğrenci var`} />
        <StatCard label="Ücretli paket" value={rows.filter((r) => r.plan.paid && r.plan.state !== "trial").length} hint={`${rows.filter((r) => r.plan.state === "trial").length} eski deneme`} />
        <StatCard label="Ücretsiz sınıra dayanan" value={rows.filter((r) => !r.plan.paid && r.full).length} hint="Satış fırsatı" />
        <StatCard label="Toplam paket geliri" value={formatMoney(revenue._sum.amount ?? 0)} />
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/yonetim/pi-koc${f.key ? `?durum=${f.key}` : ""}`}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === f.key ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {f.label}
          </Link>
        ))}
        <Form action="/yonetim/pi-koc" className="ml-auto flex gap-2">
          <Input name="q" defaultValue={q} placeholder="Hesap ya da koç ara" className="w-56" />
          <button type="submit" className={buttonClasses("secondary")}>
            Ara
          </button>
        </Form>
      </div>
      {shown.length ? (
        <Card className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Hesap</Th>
                <Th>Paket</Th>
                <Th className="text-right">Öğrenci</Th>
                <Th className="text-right">Görüşme (bu ay)</Th>
                <Th>Bitiş</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ c, plan, used, full, owner }) => (
                <tr key={c.id}>
                  <Td>
                    <Link href={`/yonetim/kurumlar/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                      {c.name}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {owner ? `${owner.firstName} ${owner.lastName}${owner.role === "TEACHER" ? " · öğretmen" : " · koç"}${owner.phone ? ` · ${owner.phone}` : ""}` : "Sahibi yok"}
                    </p>
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      <TierIcon students={plan.paid ? c.studentLimit : 0} className="size-7 rounded-xl [&>svg]:size-3.5" />
                      <span className="text-sm">
                        <span className="font-semibold text-slate-900">{plan.paid ? coachTierName(c.studentLimit) : COACH_FREE_NAME}</span>
                        <span className="block text-xs text-slate-500">{plan.state === "trial" ? "Eski deneme" : plan.paid ? "Ücretli" : "Ücretsiz"}</span>
                      </span>
                    </span>
                  </Td>
                  <Td className="text-right text-sm">
                    {c._count.students}/{plan.studentLimit}
                    {!plan.paid && full ? (
                      <span className="mt-1 block">
                        <Badge tone="amber">Sınırda</Badge>
                      </span>
                    ) : null}
                  </Td>
                  <Td className="text-right text-sm">{used ? formatHours(used) : "—"}</Td>
                  <Td className="whitespace-nowrap text-xs">{plan.paid && plan.endsAt ? formatDate(plan.endsAt) : "Süresiz"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState icon={<HeartHandshake className="size-8" />} title="Hesap yok" description="Bu süzgece uyan Pi Koç hesabı yok." />
      )}
    </>
  );
}
