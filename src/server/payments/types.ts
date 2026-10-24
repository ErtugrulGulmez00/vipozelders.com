// Ödeme sağlayıcısı soyutlaması. Geliştirmede "mock", canlıda "garanti" (Garanti BBVA sanal POS), ya da "paytr".

export type CheckoutRequest = {
  paymentId: string;
  bookingId: string;
  bookingCode: string;
  amount: number;
  description: string;
  buyer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    ipAddress: string;
    city: string | null;
    registeredAt: Date;
  };
  teacher: { subMerchantKey: string | null; amount: number };
  callbackUrl: string;
};

export type CheckoutSession = { token: string; redirectUrl: string };

export type CheckoutResult =
  | { status: "success"; paidAmount: number; providerPaymentId: string; providerItemId: string | null; raw: unknown }
  | { status: "failure"; reason: string; raw: unknown }
  /** Sonuç henüz belli değil (ör. PayTR bildirimi gelmedi); ödeme kaydı değiştirilmez. */
  | { status: "pending" };

export type ProviderCallResult = { ok: true; reference?: string } | { ok: false; error: string };

export type PaymentProviderId = "mock" | "paytr" | "garanti";

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  /** Hakediş ödeme kuruluşu tarafından otomatik ödeniyorsa true (pazaryeri). */
  readonly automaticPayouts: boolean;
  /** Öğretmenin alt üye işyeri kaydı zorunlu mu? */
  readonly requiresSubMerchant: boolean;
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  retrieveResult(token: string): Promise<CheckoutResult>;
  refund(input: { providerPaymentId: string; providerItemId: string | null; amount: number; ipAddress: string; reference: string }): Promise<ProviderCallResult>;
  releaseToTeacher(input: { providerItemId: string | null; reference: string }): Promise<ProviderCallResult>;
  registerSubMerchant(input: SubMerchantInput): Promise<{ ok: true; subMerchantKey: string } | { ok: false; error: string }>;
}

export type SubMerchantInput = {
  externalId: string;
  firstName: string;
  lastName: string;
  legalName: string;
  email: string;
  phone: string | null;
  iban: string;
  identityNumber: string;
  address: string;
};

/** Kuruş → "1250.00" */
export function toProviderAmount(kurus: number): string {
  return (kurus / 100).toFixed(2);
}

/** "1250.5" / 1250.5 → 125050 */
export function fromProviderAmount(value: string | number): number {
  return Math.round(Number(value) * 100);
}
