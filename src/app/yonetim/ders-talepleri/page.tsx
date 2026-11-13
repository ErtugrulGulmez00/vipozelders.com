import { CheckCircle2, Inbox, PhoneCall, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Badge, Card, EmptyState, PageHeader, StatCard, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { INQUIRY_MODE_LABEL } from "@/server/teacher-inquiries";

export const metadata: Metadata = { title: "Ders talepleri" };

const STATUS = {
  PENDING: { label: "Yanıt bekliyor", tone: "amber" },
  ACCEPTED: { label: "Kabul edildi", tone: "green" },
  DECLINED: { label: "Geri çevrildi", tone: "slate" },
} as const;

/** Vitrinden öğretmenlere gönderilen ders talepleri: kim kime yazdı, öğretmen yanıtladı mı. */
export default async function AdminInquiriesPage({ searchParams }: PageProps<"/yonetim/ders-talepleri">) {
  await requireRole("ADMIN");
  await connection();
  const { durum } = await searchParams;
  const filter = typeof durum === "string" && durum in STATUS ? (durum as keyof typeof STATUS) : null;
  const [items, counts] = await Promise.all([
    db.teacherInquiry.findMany({
      where: filter ? { status: filter } : {},
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { teacher: { select: { id: true, firstName: true, lastName: true } }, requester: { select: { id: true } } },
    }),
    db.teacherInquiry.groupBy({ by: ["status"], _count: true }),
  ]);
  const count = (s: keyof typeof STATUS) => counts.find((c) => c.status === s)?._count ?? 0;
  const total = count("PENDING") + count("ACCEPTED") + count("DECLINED");
  const answered = count("ACCEPTED") + count("DECLINED");
  const tabs: { key: keyof typeof STATUS | null; label: string }[] = [
    { key: null, label: `Tümü (${total})` },
    { key: "PENDING", label: `Bekleyen (${count("PENDING")})` },
    { key: "ACCEPTED", label: `Kabul (${count("ACCEPTED")})` },
    { key: "DECLINED", label: `Geri çevrilen (${count("DECLINED")})` },
  ];
  return (
    <>
      <PageHeader title="Ders talepleri" description="Velilerin öğretmen profillerinden gönderdiği ders talepleri. Öğretmen kabul edince velinin telefonunu görür, öğrenci öğretmenin Pi Koç'una eklenir." />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Toplam talep" value={total} icon={<PhoneCall className="size-5" />} />
        <StatCard label="Yanıt bekleyen" value={count("PENDING")} icon={<Inbox className="size-5" />} />
        <StatCard label="Kabul edilen" value={count("ACCEPTED")} hint={answered ? `Kabul oranı %${Math.round((count("ACCEPTED") / answered) * 100)}` : undefined} icon={<CheckCircle2 className="size-5" />} />
        <StatCard label="Geri çevrilen" value={count("DECLINED")} icon={<XCircle className="size-5" />} />
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/yonetim/ders-talepleri?durum=${t.key}` : "/yonetim/ders-talepleri"}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${filter === t.key ? "bg-brand-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>
      {items.length ? (
        <Card className="overflow-x-auto">
          <Table>
            <thead>
              <tr>
                <Th>Tarih</Th>
                <Th>Veli</Th>
                <Th>Öğretmen</Th>
                <Th>Ders</Th>
                <Th>Durum</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((q) => (
                <tr key={q.id}>
                  <Td className="whitespace-nowrap text-xs">{formatCompact(q.createdAt)}</Td>
                  <Td>
                    {q.requester ? (
                      <Link href={`/yonetim/ogrenciler/${q.requester.id}`} className="font-medium text-slate-900 hover:underline">
                        {q.name}
                      </Link>
                    ) : (
                      q.name
                    )}
                    <div className="text-xs text-slate-500">{q.phone}</div>
                  </Td>
                  <Td>
                    <Link href={`/yonetim/ogretmenler/${q.teacher.id}`} className="font-medium text-slate-900 hover:underline">
                      {q.teacher.firstName} {q.teacher.lastName}
                    </Link>
                  </Td>
                  <Td className="text-sm">
                    {q.lessonName ?? "—"}
                    <div className="text-xs text-slate-500">
                      {[q.studentName, q.gradeName, INQUIRY_MODE_LABEL[q.mode] ?? q.mode].filter(Boolean).join(" · ")}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={STATUS[q.status].tone}>{STATUS[q.status].label}</Badge>
                    {q.respondedAt ? <div className="mt-1 text-xs text-slate-500">{formatCompact(q.respondedAt)}</div> : null}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : (
        <EmptyState icon={<Inbox className="size-8" />} title="Ders talebi yok" description="Veliler öğretmen profillerinden ders talebi gönderdikçe burada görünür." />
      )}
    </>
  );
}
