import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { notFound } from "next/navigation";
import { percent, rateTone } from "@/components/center/center-ui";
import { buttonClasses } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { Badge, Card, CardHeader, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import type { ReportMetrics } from "@/lib/center/reports";
import { addDaysToDateString, isDateString, toLocalDateString } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { requireCenter } from "@/server/center/context";
import { centerReport, groupReport } from "@/server/center/reports";

export const metadata: Metadata = { title: "Raporlar" };

function Rate({ value }: { value: number | null }) {
  return value === null ? <span className="text-slate-400">—</span> : <Badge tone={rateTone(value)}>{percent(value)}</Badge>;
}

function Summary({ m }: { m: ReportMetrics }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <StatCard label="Aktif öğrenci" value={m.students} />
      <StatCard label="Devam oranı" value={m.attendanceRate === null ? "—" : percent(m.attendanceRate)} hint={`${m.absences} devamsızlık`} />
      <StatCard label="Ödev yapma" value={m.homeworkRate === null ? "—" : percent(m.homeworkRate)} />
      <StatCard label="Son deneme ort. net" value={m.exam ? m.exam.avgNet.toLocaleString("tr-TR") : "—"} hint={m.exam ? `${m.exam.name} · ${m.exam.participants} öğrenci` : undefined} />
      <StatCard label="Geciken ödeme" value={formatMoney(m.overdue)} />
    </div>
  );
}

export default async function ReportsPage({ searchParams }: PageProps<"/kurum/raporlar">) {
  const ctx = await requireCenter("reports.view");
  const sp = await searchParams;
  const today = toLocalDateString(new Date());
  const from = isDateString(String(sp.baslangic ?? "")) ? String(sp.baslangic) : addDaysToDateString(today, -30);
  const to = isDateString(String(sp.bitis ?? "")) ? String(sp.bitis) : today;
  const groupId = String(sp.sinif ?? "") || null;
  const range = `baslangic=${from}&bitis=${to}`;

  const filter = (
    <Form action="/kurum/raporlar" className="mb-6 flex flex-wrap items-end gap-2">
      {groupId ? <input type="hidden" name="sinif" value={groupId} /> : null}
      <Field label="Başlangıç">
        <Input name="baslangic" type="date" defaultValue={from} className="w-40" />
      </Field>
      <Field label="Bitiş">
        <Input name="bitis" type="date" defaultValue={to} className="w-40" />
      </Field>
      <button type="submit" className={buttonClasses("secondary")}>
        Göster
      </button>
    </Form>
  );

  if (groupId) {
    const report = await groupReport(ctx.center.id, groupId, from, to);
    if (!report.group) notFound();
    return (
      <>
        <PageHeader
          title={`Rapor · ${report.group.name}`}
          description={
            <Link href={`/kurum/raporlar?${range}`} className="font-semibold text-brand-700 hover:underline">
              ← Kurum geneli
            </Link>
          }
        />
        {filter}
        <Summary m={report.total} />
        {report.students.length === 0 ? (
          <EmptyState title="Bu sınıfta aktif öğrenci yok" />
        ) : (
          <Card>
            <CardHeader title="Öğrenciler" description="Geciken ödeme bugünkü duruma göredir; diğer ölçüler seçilen dönemi kapsar." />
            <Table>
              <thead>
                <tr>
                  <Th>Öğrenci</Th>
                  <Th>Devam</Th>
                  <Th>Devamsızlık</Th>
                  <Th>Ödev</Th>
                  <Th>Son net</Th>
                  <Th className="text-right">Geciken</Th>
                </tr>
              </thead>
              <tbody>
                {report.students.map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link href={`/kurum/ogrenciler/${s.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                        {s.name}
                      </Link>
                      {s.studentNumber ? <p className="text-xs text-slate-500">No {s.studentNumber}</p> : null}
                    </Td>
                    <Td>
                      <Rate value={s.attendanceRate} />
                    </Td>
                    <Td>{s.absences}</Td>
                    <Td>
                      <Rate value={s.homeworkRate} />
                    </Td>
                    <Td>{s.lastNet === null ? "—" : s.lastNet.toLocaleString("tr-TR")}</Td>
                    <Td className={s.overdue ? "text-right font-semibold text-rose-600" : "text-right text-slate-400"}>{s.overdue ? formatMoney(s.overdue) : "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card>
        )}
      </>
    );
  }

  const report = await centerReport(ctx.center.id, from, to);
  return (
    <>
      <PageHeader title="Raporlar" description="Kurum geneli ve sınıf bazında devam, ödev, deneme ve ödeme durumu. Sınıfa tıklayınca öğrenci bazında rapor açılır." />
      {filter}
      <Summary m={report.total} />
      {report.groups.length === 0 ? (
        <EmptyState title="Henüz sınıf yok" description="Sınıf açıp öğrencileri ekleyince sınıf bazında rapor burada görünür." />
      ) : (
        <Card>
          <CardHeader title="Sınıflar" />
          <Table>
            <thead>
              <tr>
                <Th>Sınıf</Th>
                <Th>Öğrenci</Th>
                <Th>Devam</Th>
                <Th>Ödev</Th>
                <Th>Son deneme</Th>
                <Th className="text-right">Geciken</Th>
              </tr>
            </thead>
            <tbody>
              {report.groups.map((g) => (
                <tr key={g.id}>
                  <Td>
                    <Link href={`/kurum/raporlar?sinif=${g.id}&${range}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {g.name}
                    </Link>
                    {g.gradeName ? <p className="text-xs text-slate-500">{g.gradeName}</p> : null}
                  </Td>
                  <Td>{g.students}</Td>
                  <Td>
                    <Rate value={g.attendanceRate} />
                  </Td>
                  <Td>
                    <Rate value={g.homeworkRate} />
                  </Td>
                  <Td className="text-xs">{g.exam ? `${g.exam.avgNet.toLocaleString("tr-TR")} net · ${g.exam.name}` : "—"}</Td>
                  <Td className={g.overdue ? "text-right font-semibold text-rose-600" : "text-right text-slate-400"}>{g.overdue ? formatMoney(g.overdue) : "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
