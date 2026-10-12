import { Download, FileSpreadsheet, PlusCircle, Users } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CenterFlash } from "@/components/center/center-ui";
import { buttonClasses, LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, Card, EmptyState, PageHeader, Pagination, Table, Td, Th } from "@/components/ui/primitives";
import type { Prisma } from "@/generated/prisma/client";
import { STUDENT_STATUS } from "@/lib/center/labels";
import { dbDateToString, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Öğrenciler" };

const PAGE_SIZE = 50;

export default async function CenterStudentsPage({ searchParams }: PageProps<"/kurum/ogrenciler">) {
  const ctx = await requireCenter("students.view");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const groupId = String(params.grup ?? "");
  const rawStatus = String(params.statu ?? "ACTIVE");
  const status = ["ACTIVE", "PASSIVE", "LEFT", "ALL"].includes(rawStatus) ? rawStatus : "ACTIVE";
  const page = Math.max(1, Number(params.sayfa) || 1);
  const centerId = ctx.center.id;

  const where: Prisma.CenterStudentWhereInput = {
    centerId,
    ...(status !== "ALL" ? { status: status as "ACTIVE" | "PASSIVE" | "LEFT" } : {}),
    ...(groupId ? { groups: { some: { groupId } } } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { studentNumber: { contains: q } },
            { phone: { contains: q.replace(/\s/g, "") } },
            { schoolName: { contains: q, mode: "insensitive" } },
            { guardians: { some: { OR: [{ fullName: { contains: q, mode: "insensitive" } }, { phone: { contains: q.replace(/\s/g, "") } }] } } },
          ],
        }
      : {}),
  };
  const [total, students, groups] = await Promise.all([
    db.centerStudent.count({ where }),
    db.centerStudent.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        guardians: { orderBy: { isPrimary: "desc" }, take: 1, select: { fullName: true, phone: true, userId: true } },
        groups: { include: { group: { select: { name: true } } } },
        installments: ctx.can("finance.view") ? { where: { plan: { isCancelled: false } }, select: { amount: true, paidAmount: true, dueDate: true } } : false,
      },
    }),
    db.centerGroup.findMany({ where: { centerId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const today = toLocalDateString(new Date());
  const query = (extra: Record<string, string | number>) => {
    const sp = new URLSearchParams({ ...(q ? { q } : {}), ...(groupId ? { grup: groupId } : {}), ...(status !== "ACTIVE" ? { statu: status } : {}) });
    for (const [k, v] of Object.entries(extra)) sp.set(k, String(v));
    return `/kurum/ogrenciler?${sp.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Öğrenciler"
        description={`${total} öğrenci${status === "ACTIVE" ? " (aktif)" : ""}`}
        actions={
          <>
            {ctx.can("students.edit") ? (
              <>
                <LinkButton href="/kurum/ogrenciler/yeni" size="sm">
                  <PlusCircle className="size-4" aria-hidden /> Yeni öğrenci
                </LinkButton>
                <LinkButton href="/kurum/ogrenciler/ice-aktar" size="sm" variant="outline">
                  <FileSpreadsheet className="size-4" aria-hidden /> Excel’den aktar
                </LinkButton>
              </>
            ) : null}
            <a href={`/api/kurum/disa-aktar/ogrenciler?statu=${status}${groupId ? `&grup=${groupId}` : ""}`} download className={buttonClasses("ghost", "sm")}>
              <Download className="size-4" aria-hidden /> Excel (CSV)
            </a>
          </>
        }
      />
      <CenterFlash code={params.durum} />
      <Form action="/kurum/ogrenciler" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Ad, numara, okul, veli ya da telefon" className="w-full sm:w-72" />
        <Select name="grup" defaultValue={groupId} className="w-full sm:w-48" aria-label="Sınıf">
          <option value="">Tüm sınıflar</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select name="statu" defaultValue={status} className="w-full sm:w-40" aria-label="Durum">
          <option value="ACTIVE">Aktif</option>
          <option value="PASSIVE">Pasif</option>
          <option value="LEFT">Ayrılanlar</option>
          <option value="ALL">Tümü</option>
        </Select>
        <button type="submit" className={buttonClasses("secondary")}>
          Filtrele
        </button>
      </Form>

      {students.length === 0 ? (
        <EmptyState
          icon={<Users className="size-8" />}
          title={q || groupId ? "Aramanıza uyan öğrenci yok" : "Henüz öğrenci yok"}
          description={q || groupId ? "Filtreleri değiştirip tekrar deneyin." : "Öğrencileri tek tek ekleyebilir ya da Excel listenizi bir seferde aktarabilirsiniz."}
          action={
            ctx.can("students.edit") && !q ? (
              <div className="flex flex-wrap justify-center gap-2">
                <LinkButton href="/kurum/ogrenciler/yeni">Öğrenci ekle</LinkButton>
                <LinkButton href="/kurum/ogrenciler/ice-aktar" variant="outline">
                  Excel’den aktar
                </LinkButton>
              </div>
            ) : null
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>No</Th>
                <Th>Öğrenci</Th>
                <Th>Sınıf</Th>
                <Th>Veli</Th>
                {ctx.can("finance.view") ? <Th className="text-right">Kalan borç</Th> : null}
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const installments = Array.isArray(s.installments) ? s.installments : [];
                const remaining = installments.reduce((t, i) => t + Math.max(0, i.amount - i.paidAmount), 0);
                const overdue = installments.some((i) => i.paidAmount < i.amount && dbDateToString(i.dueDate) < today);
                const guardian = s.guardians[0];
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <Td className="whitespace-nowrap font-mono text-xs text-slate-500">{s.studentNumber ?? "—"}</Td>
                    <Td>
                      <Link href={`/kurum/ogrenciler/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                        {s.firstName} {s.lastName}
                      </Link>
                      {s.schoolName ? <p className="text-xs text-slate-500">{s.schoolName}</p> : null}
                    </Td>
                    <Td className="text-xs">
                      {s.gradeName ?? ""}
                      {s.groups.length ? <p className="text-slate-500">{s.groups.map((g) => g.group.name).join(", ")}</p> : null}
                    </Td>
                    <Td className="text-xs">
                      {guardian ? (
                        <>
                          {guardian.fullName}
                          {guardian.userId ? <Badge tone="brand" className="ml-1">Portalda</Badge> : null}
                          {guardian.phone ? (
                            <p>
                              <a href={`tel:${guardian.phone}`} className="text-slate-500 hover:underline">
                                {guardian.phone}
                              </a>
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </Td>
                    {ctx.can("finance.view") ? (
                      <Td className="whitespace-nowrap text-right">
                        {remaining ? <span className={overdue ? "font-semibold text-rose-600" : "text-slate-700"}>{formatMoney(remaining)}</span> : <span className="text-slate-400">—</span>}
                      </Td>
                    ) : null}
                    <Td>
                      <Badge tone={STUDENT_STATUS[s.status].tone}>{STUDENT_STATUS[s.status].label}</Badge>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}
      <Pagination page={page} pageCount={Math.ceil(total / PAGE_SIZE)} hrefFor={(p) => query({ sayfa: p })} />
    </>
  );
}
