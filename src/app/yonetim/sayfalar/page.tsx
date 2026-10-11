import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Badge, Card, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Sayfalar" };

export default async function PagesAdmin() {
  await requireRole("ADMIN");
  const pages = await db.page.findMany({ orderBy: [{ sortOrder: "asc" }, { title: "asc" }] });
  return (
    <>
      <PageHeader
        title="Sayfalar"
        description="Yasal metinler, SSS ve kurumsal sayfalar. Yasal şablonlar taslaktır; avukatınıza kontrol ettirip “TASLAK” uyarısını silin."
        actions={<LinkButton href="/yonetim/sayfalar/yeni"><Plus className="size-4" aria-hidden /> Yeni sayfa</LinkButton>}
      />
      <Card>
        <Table>
          <thead>
            <tr>
              <Th>Başlık</Th>
              <Th>Adres</Th>
              <Th>Durum</Th>
              <Th>Güncelleme</Th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.id}>
                <Td>
                  <Link href={`/yonetim/sayfalar/${p.id}`} className="font-semibold text-brand-700 hover:underline">
                    {p.title}
                  </Link>
                </Td>
                <Td className="text-xs">/sayfa/{p.slug}</Td>
                <Td className="space-x-1">
                  <Badge tone={p.isPublished ? "green" : "slate"}>{p.isPublished ? "Yayında" : "Gizli"}</Badge>
                  {p.content.includes("TASLAK METİN") ? <Badge tone="amber">Taslak metin</Badge> : null}
                </Td>
                <Td className="text-xs">{formatCompact(p.updatedAt)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
