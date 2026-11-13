import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { GeneratePromoForm, RevokePromoForm } from "@/components/koc/promo-forms";
import { Badge, Card, CardBody, CardHeader, EmptyState, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact, formatDate } from "@/lib/dates";
import { coachTierName } from "@/lib/pi-koc";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Deneme kodları" };

/** Pi Koç deneme kodları: üret, kim kullandı, iptal et. */
export default async function PromoCodesPage() {
  await requireRole("ADMIN");
  await connection();
  const now = new Date();
  const codes = await db.coachPromoCode.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { redeemedBy: { select: { id: true, firstName: true, lastName: true } }, center: { select: { id: true, name: true, promoUntil: true } } },
  });
  const status = (c: (typeof codes)[number]) => {
    if (c.revokedAt) return { label: "İptal", tone: "slate" as const };
    if (c.redeemedAt) return c.center?.promoUntil && c.center.promoUntil > now ? { label: "Kullanımda", tone: "green" as const } : { label: "Süresi bitti", tone: "slate" as const };
    if (c.expiresAt && c.expiresAt < now) return { label: "Kullanılmadan doldu", tone: "slate" as const };
    return { label: "Kullanılmadı", tone: "amber" as const };
  };
  return (
    <>
      <Link href="/yonetim/pi-koc" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
        <ArrowLeft className="size-4" aria-hidden /> Pi Koç hesapları
      </Link>
      <PageHeader
        title="Deneme kodları"
        description={`Öğretmen ya da koç kodu Pi Koç → Paketler sayfasında girer; süresince ${coachTierName(5)} paketi (5 öğrenci, bütün ücretli özellikler) açılır. Her kod tek kullanımlık; bir hesap yalnızca bir kod kullanabilir, ücretli paketi olan kullanamaz. Süre bitince öğrenci sayısını 3'e indirmeyen hesabın en son eklenen öğrencileri 7 gün sonra arşive alınır.`}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr] lg:items-start">
        <Card>
          <CardHeader title="Kod üret" />
          <CardBody>
            <GeneratePromoForm />
          </CardBody>
        </Card>
        {codes.length ? (
          <Card className="overflow-x-auto">
            <Table>
              <thead>
                <tr>
                  <Th>Kod</Th>
                  <Th>Not</Th>
                  <Th>Kullanan</Th>
                  <Th>Durum</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => {
                  const s = status(c);
                  return (
                    <tr key={c.id}>
                      <Td className="whitespace-nowrap font-mono text-sm font-semibold">
                        {c.code}
                        <div className="font-sans text-xs font-normal text-slate-500">
                          {c.days} gün · {formatCompact(c.createdAt)}
                          {c.expiresAt ? ` · son ${formatDate(c.expiresAt)}` : ""}
                        </div>
                      </Td>
                      <Td className="text-sm">{c.note ?? "—"}</Td>
                      <Td className="text-sm">
                        {c.redeemedBy && c.center ? (
                          <Link href={`/yonetim/kurumlar/${c.center.id}`} className="font-semibold text-brand-700 hover:underline">
                            {c.redeemedBy.firstName} {c.redeemedBy.lastName}
                          </Link>
                        ) : (
                          "—"
                        )}
                        {c.redeemedAt ? <div className="text-xs text-slate-500">{formatCompact(c.redeemedAt)}{c.center?.promoUntil ? ` → ${formatDate(c.center.promoUntil)}` : ""}</div> : null}
                      </Td>
                      <Td>
                        <Badge tone={s.tone}>{s.label}</Badge>
                      </Td>
                      <Td>{!c.revokedAt && s.label !== "Süresi bitti" ? <RevokePromoForm codeId={c.id} redeemed={Boolean(c.redeemedAt)} /> : null}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        ) : (
          <EmptyState title="Henüz kod yok" description="Soldaki formdan ilk kodu üretin." />
        )}
      </div>
    </>
  );
}
