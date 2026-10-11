import { randomUUID } from "node:crypto";
import { db } from "../db";
import type { CheckoutResult, PaymentProvider } from "./types";

/**
 * Geliştirme için sahte ödeme sağlayıcısı. Site içindeki test ödeme sayfası
 * "başarılı" ya da "başarısız" seçimini Payment.raw alanına yazar.
 */
export const mockProvider: PaymentProvider = {
  id: "mock",
  automaticPayouts: false,
  requiresSubMerchant: false,

  async createCheckout(request) {
    const token = `mock_${randomUUID()}`;
    return { token, redirectUrl: `/odeme/test/${request.paymentId}` };
  },

  async retrieveResult(token): Promise<CheckoutResult> {
    const payment = await db.payment.findUnique({ where: { providerToken: token } });
    const outcome = (payment?.raw as { mockOutcome?: string } | null)?.mockOutcome;
    if (!payment || !outcome) {
      return { status: "failure", reason: "Ödeme sonucu bulunamadı.", raw: null };
    }
    if (outcome === "success") {
      return {
        status: "success",
        paidAmount: payment.amount,
        providerPaymentId: `mockpay_${payment.id}`,
        providerItemId: `mockitem_${payment.id}`,
        raw: { mockOutcome: outcome },
      };
    }
    return { status: "failure", reason: "Kart bankası ödemeyi onaylamadı (test).", raw: { mockOutcome: outcome } };
  },

  async refund(input) {
    return { ok: true, reference: `mockrefund_${input.reference}` };
  },

  async releaseToTeacher() {
    return { ok: true };
  },

  async registerSubMerchant(input) {
    return { ok: true, subMerchantKey: `mocksub_${input.externalId}` };
  },
};
