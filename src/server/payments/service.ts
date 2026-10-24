import { db, type DbTransaction } from "../db";
import { garantiProvider } from "./garanti";
import { mockProvider } from "./mock";
import { paytrProvider } from "./paytr";
import type { PaymentProvider } from "./types";

export const PAYMENT_PROVIDERS: Record<string, PaymentProvider> = { mock: mockProvider, paytr: paytrProvider, garanti: garantiProvider };

/** Yeni ödemeler için kullanılan sağlayıcı (.env → PAYMENT_PROVIDER=garanti | paytr | mock). */
export function getPaymentProvider(): PaymentProvider {
  return PAYMENT_PROVIDERS[process.env.PAYMENT_PROVIDER ?? ""] ?? mockProvider;
}

/**
 * Canlı ortamda gerçek ödeme sağlayıcısı yokken (test ödemesi) ders ve soru satışı kapalıdır; aksi hâlde herkes
 * "başarılı test ödemesi" ile ücretsiz ders alabilir. Denemeler için .env'de ALLOW_TEST_PAYMENTS="true".
 */
export function salesOpen(): boolean {
  if (getPaymentProvider().id !== "mock") return true;
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_PAYMENTS === "true";
}

/** Var olan bir ödemenin sağlayıcısı: sağlayıcı sonradan değişse de eski ödemeler kendi sağlayıcısıyla sonuçlanır/iade edilir. */
export function getProviderById(id: string): PaymentProvider {
  const provider = PAYMENT_PROVIDERS[id];
  if (!provider) throw new Error(`Bilinmeyen ödeme sağlayıcısı: ${id}`);
  return provider;
}

type Tx = DbTransaction | typeof db;

/**
 * İade talebi oluşturur (PENDING). Para hareketi transaction dışında processRefund ile
 * yapılır; sağlayıcı o an yanıt vermezse arka plan görevi yeniden dener.
 * paymentId verilmezse iade edilebilir bakiyesi kalan en son ödeme seçilir.
 * Mükerrer (fazladan alınmış) bir ödemenin iadesi randevunun iade tutarına sayılmaz (countTowardBooking: false).
 */
export async function requestRefund(
  tx: Tx,
  bookingId: string,
  amount: number,
  reason: string,
  options: { paymentId?: string; countTowardBooking?: boolean } = {},
): Promise<string | null> {
  if (amount <= 0) return null;
  const payments = await tx.payment.findMany({
    where: { bookingId, ...(options.paymentId ? { id: options.paymentId } : {}), status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED"] } },
    orderBy: { createdAt: "desc" },
    include: { refunds: { where: { status: { in: ["PENDING", "SUCCEEDED"] } } } },
  });
  const remaining = (p: (typeof payments)[number]) => p.amount - p.refunds.reduce((sum, r) => sum + r.amount, 0);
  const payment = payments.find((p) => remaining(p) > 0);
  if (!payment) return null;

  const refundable = Math.min(amount, remaining(payment));
  const refund = await tx.refund.create({ data: { paymentId: payment.id, amount: refundable, reason } });
  if (options.countTowardBooking !== false) {
    await tx.booking.update({ where: { id: bookingId }, data: { refundedAmount: { increment: refundable } } });
  }
  return refund.id;
}

/** Bekleyen bir iadeyi sağlayıcıya iletir. Başarı/başarısızlık kaydedilir; başarısızsa tekrar denenir. */
export async function processRefund(refundId: string): Promise<boolean> {
  const refund = await db.refund.findUnique({ where: { id: refundId }, include: { payment: true } });
  if (!refund || refund.status !== "PENDING") return refund?.status === "SUCCEEDED";

  let result: Awaited<ReturnType<PaymentProvider["refund"]>>;
  try {
    result = await getProviderById(refund.payment.provider).refund({
      providerPaymentId: refund.payment.providerPaymentId ?? "",
      providerItemId: refund.payment.providerItemId,
      amount: refund.amount,
      // Bazı sağlayıcılar iade isteğinde sunucunun genel IP'sini ister.
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
