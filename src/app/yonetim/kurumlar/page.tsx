import { Building2 } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { CENTER_ACCESS_LABEL, CENTER_KIND_LABEL, CENTER_PLAN_LABEL } from "@/lib/center/labels";
import { centerAccess } from "@/lib/center/subscription";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getCities, getSiteSettings } from "@/server/site";
import { CreateCenterForm, type CenterPrefill } from "./center-admin-forms";

export const metadata: Metadata = { title: "Kurumlar" };

export default async function AdminCentersPage({ searchParams }: PageProps<"/yonetim/kurumlar">) {
  await requireRole("ADMIN");
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const applicationId = String(sp.basvuru ?? "") || null;
  const [centers, cities, settings, application, newApplications, revenue] = await Promise.all([
    db.center.findMany({
      where: q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { slug: { contains: q.toLowerCase() } }] } : {},
      include: {
        city: { select: { name: true } },
        _count: { select: { students: { where: { status: "ACTIVE" } }, members: { where: { isActive: true } } } },
        members: { where: { role: "OWNER" }, take: 1, include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
    getCities(),
    getSiteSettings(),
    applicationId ? db.centerApplication.findUnique({ where: { id: applicationId } }) : null,
    db.centerApplication.count({ where: { status: "NEW" } }),
    db.centerSubscriptionPayment.aggregate({ _sum: { amount: true } }),
  ]);
  const prefill: CenterPrefill | undefined = application
    ? {
        applicationId: application.id,
        name: application.centerName,
        kind: application.kind,
        edition: application.edition ?? undefined,
        cityId: application.cityId,
        phone: application.phone,
        email: application.email,
        ownerFirstName: application.contactName.split(" ").slice(0, -1).join(" ") || application.contactName,
        ownerLastName: application.contactName.split(" ").length > 1 ? application.contactName.split(" ").at(-1) : "",
      }
    : undefined;
  const states = centers.map((c) => centerAccess(c));
  return (
    <>
      <PageHeader
        title="Kurumlar"
        description="Kurum paneli aboneleri: etüt merkezleri, dershaneler, kurslar"
        actions={
          <Link href="/yonetim/kurum-basvurulari" className={buttonClasses("outline", "sm")}>
            Başvurular {newApplications ? <Badge tone="amber">{newApplications}</Badge> : null}
          </Link>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Kurum" value={centers.length} />
        <StatCard label="Aktif abonelik" value={states.filter((s) => s.state === "active" || s.state === "grace").length} />
        <StatCard label="Denemede" value={states.filter((s) => s.state === "trial").length} />
        <StatCard label="Toplam abonelik geliri" value={formatMoney(revenue._sum.amount ?? 0)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-3">
          <Form action="/yonetim/kurumlar" className="flex gap-2">
            <Input name="q" defaultValue={q} placeholder="Kurum ara" className="w-72" />
            <button type="submit" className={buttonClasses("secondary")}>
              Ara
            </button>
          </Form>
          {centers.length === 0 ? (
            <EmptyState icon={<Building2 className="size-8" />} title="Henüz kurum yok" description="Sağdaki formdan ilk kurumu açın ya da “Kurumlar için” sayfasından gelen başvuruları değerlendirin." />
          ) : (
            <Card>
              <Table>
                <thead>
                  <tr>
                    <Th>Kurum</Th>
                    <Th>Plan</Th>
                    <Th className="text-right">Öğrenci</Th>
                    <Th>Bitiş</Th>
                    <Th>Durum</Th>
                  </tr>
                </thead>
                <tbody>
                  {centers.map((c, i) => {
                    const access = CENTER_ACCESS_LABEL[states[i].state];
                    const owner = c.members[0]?.user;
                    return (
                      <tr key={c.id}>
                        <Td>
                          <Link href={`/yonetim/kurumlar/${c.id}`} className="font-semibold text-brand-700 hover:underline">
                            {c.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {CENTER_KIND_LABEL[c.kind]}
                            {c.city ? ` · ${c.city.name}` : ""}
                            {owner ? ` · ${owner.firstName} ${owner.lastName}${owner.phone ? ` (${owner.phone})` : ""}` : ""}
                          </p>
                        </Td>
                        <Td className="text-xs">{CENTER_PLAN_LABEL[c.plan]}</Td>
                        <Td className="text-right text-sm">
                          {c._count.students}/{c.studentLimit}
                        </Td>
                        <Td className="whitespace-nowrap text-xs">{states[i].endsAt ? formatDate(states[i].endsAt!) : "—"}</Td>
                        <Td>
                          <Badge tone={access.tone}>{access.label}</Badge>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          )}
        </div>
        <Card id="yeni-kurum">
          <CardHeader title="Yeni kurum" description="Kurum açılınca sahibine kullanıcı adı ve geçici şifre verilir; deneme süresi başlar." />
          <CardBody>
            {application ? (
              <Alert tone="info" className="mb-4">
                “{application.centerName}” başvurusundan dolduruldu. Kurum açılınca başvuru “onaylandı” olur.
              </Alert>
            ) : null}
            <CreateCenterForm cities={cities.map((c) => ({ id: c.id, name: c.name }))} trialDays={settings.centerTrialDays} prefill={prefill} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
