import type { Metadata } from "next";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { CENTER_ROLE_LABEL, type CenterRoleName } from "@/lib/center/permissions";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";
import { AddStaffForm, StaffRow } from "./staff-forms";

export const metadata: Metadata = { title: "Personel" };

export default async function StaffPage() {
  const ctx = await requireCenter("staff.manage");
  const members = await db.centerMember.findMany({
    where: { centerId: ctx.center.id },
    include: { user: { select: { firstName: true, lastName: true, email: true, phone: true, username: true, role: true, lastLoginAt: true, mustChangePassword: true } } },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "asc" }],
  });
  const isOwner = ctx.member.role === "OWNER";
  return (
    <>
      <PageHeader title="Personel" description="Panele giriş yapan öğretmen ve çalışanlar; her rol yalnızca yetkili olduğu bölümleri görür." />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <Card>
          <CardHeader title={`Personel (${members.filter((m) => m.isActive).length} aktif)`} />
          <ul className="divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className={`px-5 py-4 ${m.isActive ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {m.user.firstName} {m.user.lastName}
                      {m.id === ctx.member.id ? <span className="ml-1 text-xs font-normal text-slate-500">(siz)</span> : null}
                    </p>
                    <p className="text-sm text-slate-600">{[m.title, m.branch].filter(Boolean).join(" · ") || "—"}</p>
                    <p className="text-xs text-slate-500">
                      {[m.user.username ? `Kullanıcı adı: ${m.user.username}` : null, m.user.email, m.user.phone].filter(Boolean).join(" · ")}
                    </p>
                    <p className="text-xs text-slate-400">
                      {m.user.lastLoginAt ? `Son giriş ${formatCompact(m.user.lastLoginAt)}` : "Henüz giriş yapmadı"}
                      {m.user.mustChangePassword ? " · geçici şifre" : ""}
                      {m.user.role === "TEACHER" ? " · sitede öğretmen hesabı" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={m.role === "OWNER" ? "brand" : m.role === "MANAGER" ? "violet" : m.role === "ACCOUNTANT" ? "amber" : "sky"}>{CENTER_ROLE_LABEL[m.role as CenterRoleName]}</Badge>
                    {!m.isActive ? <Badge tone="slate">Pasif</Badge> : null}
                  </div>
                </div>
                <div className="mt-2">
                  <StaffRow member={{ id: m.id, role: m.role as CenterRoleName, title: m.title, branch: m.branch, isActive: m.isActive }} allowOwner={isOwner} canReset={m.user.role === "CENTER" && m.id !== ctx.member.id} isSelf={m.id === ctx.member.id} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Personel ekle" description="Kullanıcı adı ve geçici şifre otomatik oluşur; ilk girişte kişi kendi şifresini belirler." />
          <CardBody>
            <AddStaffForm allowOwner={isOwner} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
