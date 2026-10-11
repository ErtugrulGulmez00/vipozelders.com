import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { Input } from "@/components/ui/form";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Öğrenciler ve veliler" };

export default async function AdminStudentsPage({ searchParams }: PageProps<"/yonetim/ogrenciler">) {
  await requireRole("ADMIN");
  const q = String((await searchParams).q ?? "").trim();
  const students = await db.user.findMany({
    where: {
      role: "STUDENT",
      ...(q
        ? { OR: [{ firstName: { contains: q, mode: "insensitive" } }, { lastName: { contains: q, mode: "insensitive" } }, { email: { contains: q.toLowerCase() } }, { phone: { contains: q } }] }
        : {}),
    },
    include: { studentProfile: true, _count: { select: { bookingsAsStudent: { where: { status: { in: ["COMPLETED", "CONFIRMED", "PENDING_APPROVAL"] } } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader title="Öğrenciler ve veliler" description={`${students.length} kayıt gösteriliyor`} />
      <Form action="/yonetim/ogrenciler" className="mb-4 flex gap-2">
        <Input name="q" defaultValue={q} placeholder="Ad, e-posta veya telefon" className="w-80" />
        <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white">
          Ara
        </button>
      </Form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Ad soyad</Th>
              <Th>E-posta</Th>
              <Th>Telefon</Th>
              <Th>Tip</Th>
              <Th>Ders</Th>
              <Th>Kayıt</Th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <Td>
                  <Link href={`/yonetim/ogrenciler/${s.id}`} className="font-semibold text-brand-700 hover:underline">
                    {s.firstName} {s.lastName}
                  </Link>
                  {s.status === "SUSPENDED" ? <Badge tone="rose" className="ml-2">Kapalı</Badge> : null}
                </Td>
                <Td className="text-xs">
                  {s.email} {s.emailVerifiedAt ? null : <Badge tone="amber">Doğrulanmadı</Badge>}
                </Td>
                <Td className="text-xs">{s.phone ?? "—"}</Td>
                <Td className="text-xs">{s.studentProfile ? ACCOUNT_TYPE_LABEL[s.studentProfile.accountType] : "—"}</Td>
                <Td>{s._count.bookingsAsStudent}</Td>
                <Td className="whitespace-nowrap text-xs">{formatDate(s.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
