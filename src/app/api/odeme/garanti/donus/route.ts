import { NextResponse, type NextRequest } from "next/server";
import { completeCheckout } from "@/server/bookings";
import { appUrl } from "@/server/email";
import { garantiProvider, saveGarantiCallback } from "@/server/payments/garanti";
import { db } from "@/server/db";

/**
 * Garanti ortak ödeme sayfasından dönüş (successurl / errorurl, POST). Dönen alanlar yalnızca kaydedilir;
 * ödemenin sonucu bankaya sipariş sorgusuyla doğrulanarak belirlenir (completeCheckout → retrieveResult).
 */
export async function POST(request: NextRequest) {
  const form = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k.toLowerCase(), String(v)]));
  const orderId = form.orderid || form.oid || "";
  if (!/^[a-z0-9]{10,40}$/i.test(orderId)) return NextResponse.redirect(appUrl("/hesabim"), 303);
  const payment = await saveGarantiCallback(orderId, form);
  if (!payment) return NextResponse.redirect(appUrl("/hesabim"), 303);

  if (payment.raw.diagnostic) {
    // Yönetim → Ödeme testi: sonuç sorgulanıp test kaydına yazılır.
    const result = await garantiProvider.retrieveResult(orderId).catch((error: unknown) => ({ status: "error", error: String(error) }));
    await db.payment.update({ where: { id: payment.id }, data: { raw: { ...payment.raw, diagnosticResult: JSON.parse(JSON.stringify(result)) } } });
    return NextResponse.redirect(appUrl(`/yonetim/odeme-testi?p=${payment.id}`), 303);
  }

  await completeCheckout(orderId).catch((error: unknown) => console.error("[garanti dönüş]", error));
  const target = payment.bookingId ?? payment.creditPurchaseId ?? payment.subscriptionId;
  return NextResponse.redirect(appUrl(target ? `/odeme/sonuc/${target}` : "/hesabim"), 303);
}
