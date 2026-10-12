import type { NextRequest } from "next/server";
import { completeCheckout } from "@/server/bookings";
import { handlePaytrNotification } from "@/server/payments/paytr";

/**
 * PayTR "Bildirim URL"si: ödeme sonucu sunucudan sunucuya buraya POST edilir.
 * PayTR mağaza panelinde https://ALAN-ADINIZ/api/odeme/paytr/bildirim olarak girilmelidir.
 * Yanıt yalnızca düz metin "OK" olmalıdır; aksi hâlde PayTR bildirimi tekrar gönderir.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const field = (name: string) => String(form.get(name) ?? "");
  try {
    const result = await handlePaytrNotification(
      {
        merchantOid: field("merchant_oid"),
        status: field("status"),
        totalAmount: field("total_amount"),
        paymentAmount: field("payment_amount") || field("total_amount"),
        hash: field("hash"),
        failedReasonMessage: field("failed_reason_msg") || undefined,
        paymentType: field("payment_type") || undefined,
        testMode: field("test_mode") || undefined,
      },
      completeCheckout,
    );
    if (result === "bad-hash") {
      console.warn("[paytr bildirim] imza doğrulanamadı", field("merchant_oid"));
      return new Response("PAYTR notification failed: bad hash", { status: 400 });
    }
    if (result === "unknown-order") console.warn("[paytr bildirim] bilinmeyen sipariş", field("merchant_oid"));
  } catch (error) {
    // OK dönülmezse PayTR bildirimi yeniden dener.
    console.error("[paytr bildirim]", error);
    return new Response("ERROR", { status: 500 });
  }
  return new Response("OK", { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
