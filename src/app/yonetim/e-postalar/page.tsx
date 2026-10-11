import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "E-posta kutusu" };

const STATUS = { PENDING: { label: "Kuyrukta", tone: "amber" }, SENT: { label: "Gönderildi", tone: "green" }, FAILED: { label: "Başarısız", tone: "rose" } } as const;

export default async function EmailsPage() {
  await requireRole("ADMIN");
  const emails = await db.emailMessage.findMany({ orderBy: { createdAt: "desc" }, take: 150, select: { id: true, to: true, subject: true, status: true, createdAt: true, error: true } });
  return (
    <>
      <PageHeader title="E-posta kutusu" description="Sistemin gönderdiği tüm e-postalar. SMTP ayarlanmadıysa e-postalar yalnızca burada görünür." />
      {!process.env.SMTP_HOST ? (
        <Alert tone="info" className="mb-4">
          SMTP sunucusu tanımlı değil: e-postalar gerçek alıcılara gitmiyor, burada okunabilir. Canlıda .env dosyasına SMTP bilgilerini girin.
        </Alert>
      ) : null}
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Alıcı</Th>
              <Th>Konu</Th>
              <Th>Durum</Th>
            </tr>
          </thead>
          <tbody>
            {emails.map((e) => (
              <tr key={e.id}>
                <Td className="whitespace-nowrap text-xs">{formatCompact(e.createdAt)}</Td>
                <Td className="text-xs">{e.to}</Td>
                <Td>
                  <Link href={`/yonetim/e-postalar/${e.id}`} className="font-medium text-brand-700 hover:underline">
                    {e.subject}
                  </Link>
                </Td>
                <Td>
                  <Badge tone={STATUS[e.status].tone}>{STATUS[e.status].label}</Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
