import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import type { Prisma } from "@/generated/prisma/client";
import { LinkButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, Card, PageHeader, RatingSummary, Table, Td, Th } from "@/components/ui/primitives";
import { formatDate } from "@/lib/dates";
import { TEACHER_STATUS, VERIFICATION_STATUS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Öğretmenler" };

export default async function AdminTeachersPage({ searchParams }: PageProps<"/yonetim/ogretmenler">) {
  await requireRole("ADMIN");
  const params = await searchParams;
  const q = String(params.q ?? "").trim();
  const status = String(params.durum ?? "");
  const where: Prisma.TeacherProfileWhereInput = {
    ...(["DRAFT", "PUBLISHED", "SUSPENDED"].includes(status) ? { status: status as "DRAFT" } : {}),
    ...(q
      ? {
          OR: [
            { user: { firstName: { contains: q, mode: "insensitive" } } },
            { user: { lastName: { contains: q, mode: "insensitive" } } },
            { user: { username: { contains: q.toLowerCase() } } },
            { user: { email: { contains: q.toLowerCase() } } },
          ],
        }
      : {}),
  };
  const teachers = await db.teacherProfile.findMany({
    where,
    include: { user: true, _count: { select: { offerings: { where: { isActive: true } } } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader
        title="Öğretmenler"
        description={`${teachers.length} öğretmen`}
        actions={
          <LinkButton href="/yonetim/ogretmenler/yeni">
            <Plus className="size-4" aria-hidden /> Hızlı öğretmen ekle
          </LinkButton>
        }
      />
      <Form action="/yonetim/ogretmenler" className="mb-4 flex flex-wrap gap-2">
        <Input name="q" defaultValue={q} placeholder="Ad, kullanıcı adı veya e-posta" className="w-72" />
        <Select name="durum" defaultValue={status} className="w-44">
          <option value="">Tüm durumlar</option>
          <option value="DRAFT">Taslak</option>
          <option value="PUBLISHED">Yayında</option>
          <option value="SUSPENDED">Askıda</option>
        </Select>
        <button type="submit" className="h-10 rounded-lg bg-slate-800 px-4 text-sm font-semibold text-white">
          Filtrele
        </button>
      </Form>
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Öğretmen</Th>
              <Th>Kullanıcı adı</Th>
              <Th>Durum</Th>
              <Th>Doğrulama</Th>
              <Th>Puan</Th>
              <Th>Ders</Th>
              <Th>Kayıt</Th>
            </tr>
          </thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.userId}>
                <Td>
                  <Link href={`/yonetim/ogretmenler/${t.userId}`} className="font-semibold text-brand-700 hover:underline">
                    {t.user.firstName} {t.user.lastName}
                  </Link>
                  <p className="text-xs text-slate-400">{t.headline ?? "—"}</p>
                </Td>
                <Td className="text-xs">{t.user.username}</Td>
                <Td>
                  <Badge tone={TEACHER_STATUS[t.status].tone}>{TEACHER_STATUS[t.status].label}</Badge>
                  {t.user.status === "SUSPENDED" ? <Badge tone="rose" className="ml-1">Hesap kapalı</Badge> : null}
                  {t.isFeatured ? <Badge tone="amber" className="ml-1">Vitrin</Badge> : null}
                </Td>
                <Td>
                  <Badge tone={VERIFICATION_STATUS[t.verificationStatus].tone}>{VERIFICATION_STATUS[t.verificationStatus].label}</Badge>
                </Td>
                <Td>
                  <RatingSummary average={t.ratingAvg} count={t.ratingCount} />
                </Td>
                <Td className="text-xs">
                  {t._count.offerings} ders · {t.completedLessons} tamamlanan
                </Td>
                <Td className="whitespace-nowrap text-xs">{formatDate(t.createdAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
