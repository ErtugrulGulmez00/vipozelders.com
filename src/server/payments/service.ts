import { db, type DbTransaction } from "../db";
import { iyzicoProvider } from "./iyzico";
import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  return process.env.PAYMENT_PROVIDER === "iyzico" ? iyzicoProvider : mockProvider;
}

type Tx = DbTransaction | typeof db;

/**
 * İade talebi oluşturur (PENDING). Para hareketi transaction dışında processRefund ile
 * yapılır; sağlayıcı o an yanıt vermezse arka plan görevi yeniden dener.
 */
export async function requestRefund(tx: Tx, bookingId: string, amount: number, reason: string): Promise<string | null> {
  if (amount <= 0) return null;
  const payment = await tx.payment.findFirst({
    where: { bookingId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    include: { refunds: { where: { status: { in: ["PENDING", "SUCCEEDED"] } } } },
  });
  if (!payment) return null;

  const alreadyRequested = payment.refunds.reduce((sum, r) => sum + r.amount, 0);
  const refundable = Math.min(amount, payment.amount - alreadyRequested);
  if (refundable <= 0) return null;

  const refund = await tx.refund.create({ data: { paymentId: payment.id, amount: refundable, reason } });
  await tx.booking.update({ where: { id: bookingId }, data: { refundedAmount: { increment: refundable } } });
  return refund.id;
}

/** Bekleyen bir iadeyi sağlayıcıya iletir. Başarı/başarısızlık kaydedilir; başarısızsa tekrar denenir. */
export async function processRefund(refundId: string): Promise<boolean> {
  const refund = await db.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!refund || refund.status !== "PENDING") return refund?.status === "SUCCEEDED";

  const provider = getPaymentProvider();
  let result: Awaited<ReturnType<PaymentProvider["refund"]>>;
  try {
    result = await provider.refund({
      providerPaymentId: refund.payment.providerPaymentId ?? "",
      providerItemId: refund.payment.providerItemId,
      amount: refund.amount,
      // iyzico iade isteğinde işlemi başlatan IP'yi ister; sunucunun genel IP'si yeterlidir.
      ipAddress: process.env.SERVER_PUBLIC_IP ?? "127.0.0.1",
      reference: refund.id,
    });
  } catch (error) {
    result = { ok: false, error: String(error) };
  }

  if (result.ok) {
    await db.$transaction(async (tx) => {
      await tx.refund.update({
        where: { id: refund.id },
        data: { status: "SUCCEEDED", processedAt: new Date(), providerRefundId: result.ok ? result.reference : null, attempts: { increment: 1 }, error: null },
      });
      const payment = await tx.payment.update({
        where: { id: refund.paymentId },
        data: { refundedAmount: { increment: refund.amount } },
      });
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: payment.refundedAmount >= payment.amount ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
    });
    return true;
  }

  const attempts = refund.attempts + 1;
  await db.refund.update({
    where: { id: refund.id },
    data: { attempts, error: result.error.slice(0, 500), status: attempts >= 5 ? "FAILED" : "PENDING" },
  });
  return false;
}

export async function processPendingRefunds(limit = 20): Promise<number> {
  const pending = await db.refund.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let done = 0;
  for (const { id } of pending) {
    if (await processRefund(id)) done++;
  }
  return done;
}

/** Admin "tekrar dene" dediğinde başarısız iadeyi yeniden kuyruğa alır. */
export async function retryFailedRefund(refundId: string): Promise<boolean> {
  await db.refund.updateMany({ where: { id: refundId, status: "FAILED" }, data: { status: "PENDING", attempts: 0 } });
  return processRefund(refundId);
}
