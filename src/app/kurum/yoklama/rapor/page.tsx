import { Download } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { percent, RateBar, rateTone } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { addDaysToDateString, isDateString, toLocalDateString } from "@/lib/dates";
import { attendanceReport } from "@/server/center/attendance";
import { requireCenter } from "@/server/center/context";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Devamsızlık raporu" };

export default async function AttendanceReportPage({ searchParams }: PageProps<"/kurum/yoklama/rapor">) {
  const ctx = await requireCenter("attendance.take");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const from = isDateString(String(sp.baslangic ?? "")) ? String(sp.baslangic) : addDaysToDateString(today, -30);
  const to = isDateString(String(sp.bitis ?? "")) ? String(sp.bitis) : today;
  const groupId = String(sp.grup ?? "") || undefined;
  const [rows, groups] = await Promise.all([
    attendanceReport(ctx.center.id, from, to, groupId),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const totals = rows.reduce((t, r) => ({ total: t.total + r.total, absent: t.absent + r.absent, late: t.late + r.late }), { total: 0, absent: 0, late: 0 });
  const query = `baslangic=${from}&bitis=${to}${groupId ? `&grup=${groupId}` : ""}`;
  return (
    <>
      <PageHeader
        title="Devamsızlık raporu"
        actions={
          <>
            <a href={`/api/kurum/disa-aktar/yoklama?${query}`} download className={buttonClasses("outline", "sm")}>
              <Download className="size-4" aria-hidden /> Özet (CSV)
            </a>
            <a href={`/api/kurum/disa-aktar/yoklama?${query}&detay=1`} download className={buttonClasses("ghost", "sm")}>
              <Download className="size-4" aria-hidden /> Tüm kayıtlar
            </a>
          </>
        }
      />
      <Form action="/kurum/yoklama/rapor" className="mb-4 flex flex-wrap items-end gap-2">
        <Field label="Başlangıç">
          <Input name="baslangic" type="date" defaultValue={from} className="w-40" />
        </Field>
        <Field label="Bitiş">
          <Input name="bitis" type="date" defaultValue={to} className="w-40" />
        </Field>
        <Field label="Sınıf">
          <Select name="grup" defaultValue={groupId ?? ""} className="w-44">
            <option value="">Tümü</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        </Field>
        <button type="submit" className={buttonClasses("secondary")}>
          Göster
        </button>
      </Form>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Yoklama kaydı" value={totals.total} />
        <StatCard label="Devamsızlık" value={totals.absent} hint={totals.total ? `${percent(totals.absent / totals.total)} oranında` : undefined} />
        <StatCard label="Geç kalma" value={totals.late} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Bu aralıkta yoklama kaydı yok" />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Öğrenci</Th>
                <Th className="text-right">Ders</Th>
                <Th className="text-right">Gelmedi</Th>
                <Th className="text-right">Geç</Th>
                <Th className="text-right">İzinli</Th>
                <Th className="w-48">Devam</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.studentId}>
                  <Td>
                    <Link href={`/kurum/ogrenciler/${r.studentId}?sekme=devam`} className="font-semibold text-brand-700 hover:underline">
                      {r.name}
                    </Link>
                    {r.studentNumber ? <span className="ml-2 font-mono text-xs text-slate-400">{r.studentNumber}</span> : null}
                  </Td>
                  <Td className="text-right">{r.total}</Td>
                  <Td className={`text-right ${r.absent ? "font-semibold text-rose-600" : ""}`}>{r.absent}</Td>
                  <Td className="text-right">{r.late}</Td>
                  <Td className="text-right">{r.excused}</Td>
                  <Td>
                    <div className="flex items-center gap-2">
                      <RateBar value={r.rate} tone={rateTone(r.rate)} />
                      <span className="w-10 text-right text-xs font-semibold">{percent(r.rate)}</span>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
