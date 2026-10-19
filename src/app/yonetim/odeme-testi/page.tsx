import type { Metadata } from "next";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader, Table, Td, Th } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { db } from "@/server/db";
import { defaultGarantiMode, garantiConfigured } from "@/server/payments/garanti";
import { getPaymentProvider } from "@/server/payments/service";
import { RefundTestForm, StartTestForm } from "./forms";

export const metadata: Metadata = { title: "Ödeme testi" };

type DiagnosticRaw = {
  garantiMode?: string;
  garantiCallback?: { mdstatus?: string; procreturncode?: string; errmsg?: string; mderrormessage?: string };
  diagnosticResult?: { status?: string; reason?: string; error?: string; paidAmount?: number };
  diagnosticRefund?: { ok?: boolean; error?: string };
};

export default async function PaymentTestPage({ searchParams }: PageProps<"/yonetim/odeme-testi">) {
  const { p } = await searchParams;
  const tests = await db.payment.findMany({ where: { provider: "garanti", bookingId: null, creditPurchaseId: null }, orderBy: { createdAt: "desc" }, take: 20 });
  const configured = garantiConfigured();
  const active = getPaymentProvider().id;

  return (
    <>
      <PageHeader
        title="Ödeme testi (Garanti BBVA)"
        description="Randevuya bağlı olmayan 1,00 TL’lik deneme ödemesi. Önce bankanın test ortamında, canlıya geçmeden önce de gerçek kartla bir kez deneyin; başarılı ödemeyi buradan iade edin."
      />
      <Card className="mb-6">
        <CardBody className="space-y-4">
          <p className="text-sm text-slate-600">
            Sitede şu an kullanılan ödeme sağlayıcısı: <strong>{active}</strong>
            {active === "garanti" ? ` (${defaultGarantiMode() === "PROD" ? "canlı" : "test"} terminali)` : ""}. Canlı terminal bilgileri:{" "}
            {configured ? <Badge tone="green">tanımlı</Badge> : <Badge tone="amber">tanımlı değil</Badge>}
          </p>
          <div className="flex flex-wrap gap-3">
            <StartTestForm mode="TEST" label="Test ortamında dene (para çekilmez)" />
            <StartTestForm mode="PROD" label="Gerçek kartla 1,00 TL dene" disabled={!configured} />
          </div>
          <Alert tone="info">
            Test ortamı kartı: <span className="font-mono">5406 6975 4321 1173</span> · 04/27 · CVV 423. Banka sayfasındaki doğrulama adımlarını tamamlayın; sonuç bu sayfaya döner.
          </Alert>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Son denemeler" />
        <Table>
          <thead>
            <tr>
              <Th>Tarih</Th>
              <Th>Ortam</Th>
              <Th>Tutar</Th>
              <Th>Bankadan dönüş</Th>
              <Th>Sonuç (bankaya sorgu)</Th>
              <Th>İade</Th>
            </tr>
          </thead>
          <tbody>
            {tests.map((t) => {
              const raw = (t.raw ?? {}) as DiagnosticRaw;
              const result = raw.diagnosticResult;
              const callback = raw.garantiCallback;
              return (
                <tr key={t.id} className={t.id === p ? "bg-brand-50/50" : undefined}>
                  <Td className="whitespace-nowrap text-xs">{formatCompact(t.createdAt)}</Td>
                  <Td>{raw.garantiMode === "PROD" ? "Canlı" : "Test"}</Td>
                  <Td>{formatMoney(t.amount)}</Td>
                  <Td className="text-xs">{callback ? `md ${callback.mdstatus || "-"} · kod ${callback.procreturncode || "-"} ${callback.errmsg || callback.mderrormessage || ""}` : "—"}</Td>
                  <Td>
                    {result?.status === "success" ? (
                      <Badge tone="green">Onaylandı · {formatMoney(result.paidAmount ?? 0)}</Badge>
                    ) : result ? (
                      <span className="text-xs text-rose-700">{result.reason ?? result.error ?? result.status}</span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    {raw.diagnosticRefund?.ok ? <Badge tone="sky">İade edildi</Badge> : null}
                    {raw.diagnosticRefund && !raw.diagnosticRefund.ok ? <p className="text-xs text-rose-700">{raw.diagnosticRefund.error}</p> : null}
                    {result?.status === "success" && !raw.diagnosticRefund?.ok ? <RefundTestForm id={t.id} /> : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
