import { createHmac, timingSafeEqual } from "node:crypto";
import Iyzipay from "iyzipay";
import { fromProviderAmount, toProviderAmount, type CheckoutResult, type PaymentProvider } from "./types";

/**
 * iyzico ödeme formu (3D Secure, kart bilgisi iyzico'da kalır).
 * IYZICO_MARKETPLACE=true ise pazaryeri modeli: her öğretmen alt üye işyeri olur,
 * ders tamamlanınca "onay" verilir ve hakediş iyzico tarafından öğretmene ödenir.
 *
 * Not: Bu bağlantı iyzico sandbox anahtarları girildikten sonra test edilmelidir.
 */

type IyzicoResult = Record<string, unknown> & { status?: string; errorMessage?: string; errorCode?: string };

function client() {
  const apiKey = process.env.IYZICO_API_KEY;
  const secretKey = process.env.IYZICO_SECRET_KEY;
  if (!apiKey || !secretKey) throw new Error("IYZICO_API_KEY / IYZICO_SECRET_KEY tanımlı değil.");
  return {
    secretKey,
    api: new Iyzipay({ apiKey, secretKey, uri: process.env.IYZICO_BASE_URL ?? "https://sandbox-api.iyzipay.com" }),
  };
}

function call<T extends IyzicoResult>(fn: (cb: (err: unknown, result: T) => void) => void): Promise<T> {
  return new Promise((resolve, reject) => fn((err, result) => (err ? reject(err) : resolve(result))));
}

/** iyzico yanıt imzası: HMAC-SHA256(secretKey, değerler.join(":")) */
function signatureMatches(values: unknown[], secretKey: string, signature: unknown): boolean {
  if (typeof signature !== "string" || !signature) return false;
  const expected = createHmac("sha256", secretKey).update(values.map(String).join(":")).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

function errorText(result: IyzicoResult): string {
  return result.errorMessage ? `${result.errorMessage} (${result.errorCode ?? "?"})` : "iyzico işlemi başarısız.";
}

const marketplace = () => process.env.IYZICO_MARKETPLACE === "true";

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

export const iyzicoProvider: PaymentProvider = {
  id: "iyzico",
  get automaticPayouts() {
    return marketplace();
  },
  get requiresSubMerchant() {
    return marketplace();
  },

  async createCheckout(request) {
    const { api, secretKey } = client();
    const price = toProviderAmount(request.amount);
    const city = request.buyer.city ?? "Istanbul";
    const fullName = `${request.buyer.firstName} ${request.buyer.lastName}`;

    const basketItem: Record<string, string> = {
      id: request.bookingId,
      name: request.description.slice(0, 120),
      category1: "Eğitim",
      itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
      price,
    };
    if (marketplace()) {
      if (!request.teacher.subMerchantKey) throw new Error("Öğretmenin iyzico alt üye işyeri kaydı yok.");
      basketItem.subMerchantKey = request.teacher.subMerchantKey;
      basketItem.subMerchantPrice = toProviderAmount(request.teacher.amount);
    }

    const result = await call<IyzicoResult>((cb) =>
      api.checkoutFormInitialize.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: request.paymentId,
          price,
          paidPrice: price,
          currency: Iyzipay.CURRENCY.TRY,
          basketId: request.bookingCode,
          paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
          callbackUrl: request.callbackUrl,
          enabledInstallments: [1],
          buyer: {
            id: request.buyer.id,
            name: request.buyer.firstName,
            surname: request.buyer.lastName,
            gsmNumber: request.buyer.phone ? `+9${request.buyer.phone}` : undefined,
            email: request.buyer.email,
            // Fatura için T.C. kimlik no toplanmadığında iyzico'nun kabul ettiği varsayılan değer.
            identityNumber: "11111111111",
            registrationDate: formatDate(request.buyer.registeredAt),
            registrationAddress: city,
            ip: request.buyer.ipAddress,
            city,
            country: "Turkey",
          },
          billingAddress: { contactName: fullName, city, country: "Turkey", address: city },
          basketItems: [basketItem],
        } as never,
        cb as never,
      ),
    );

    if (result.status !== "success" || typeof result.token !== "string" || typeof result.paymentPageUrl !== "string") {
      throw new Error(errorText(result));
    }
    if (!signatureMatches([result.conversationId, result.token], secretKey, result.signature)) {
      throw new Error("iyzico yanıt imzası doğrulanamadı.");
    }
    return { token: result.token, redirectUrl: result.paymentPageUrl };
  },

  async retrieveResult(token): Promise<CheckoutResult> {
    const { api, secretKey } = client();
    const result = await call<IyzicoResult>((cb) =>
      api.checkoutForm.retrieve({ locale: Iyzipay.LOCALE.TR, token } as never, cb as never),
    );
    if (result.status !== "success") {
      return { status: "failure", reason: errorText(result), raw: result };
    }
    const signed = signatureMatches(
      [result.paymentStatus, result.paymentId, result.currency, result.basketId, result.conversationId, result.paidPrice, result.price, result.token],
      secretKey,
      result.signature,
    );
    if (!signed) {
      return { status: "failure", reason: "iyzico yanıt imzası doğrulanamadı.", raw: result };
    }
    if (result.paymentStatus !== "SUCCESS") {
      return { status: "failure", reason: errorText(result), raw: result };
    }
    const items = (result.itemTransactions as { paymentTransactionId?: string }[] | undefined) ?? [];
    return {
      status: "success",
      paidAmount: fromProviderAmount(result.paidPrice as string),
      providerPaymentId: String(result.paymentId),
      providerItemId: items[0]?.paymentTransactionId ? String(items[0].paymentTransactionId) : null,
      raw: result,
    };
  },

  async refund(input) {
    if (!input.providerItemId) return { ok: false, error: "Ödeme kalemi numarası yok." };
    const { api } = client();
    const result = await call<IyzicoResult>((cb) =>
      api.refund.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: input.reference,
          paymentTransactionId: input.providerItemId,
          price: toProviderAmount(input.amount),
          currency: Iyzipay.CURRENCY.TRY,
          ip: input.ipAddress,
          reason: Iyzipay.REFUND_REASON.BUYER_REQUEST,
        } as never,
        cb as never,
      ),
    );
    return result.status === "success" ? { ok: true, reference: String(result.paymentTransactionId ?? "") } : { ok: false, error: errorText(result) };
  },

  async releaseToTeacher(input) {
    if (!marketplace()) return { ok: true };
    if (!input.providerItemId) return { ok: false, error: "Ödeme kalemi numarası yok." };
    const { api } = client();
    const result = await call<IyzicoResult>((cb) =>
      api.approval.create(
        { locale: Iyzipay.LOCALE.TR, conversationId: input.reference, paymentTransactionId: input.providerItemId } as never,
        cb as never,
      ),
    );
    return result.status === "success" ? { ok: true } : { ok: false, error: errorText(result) };
  },

  async registerSubMerchant(input) {
    const { api } = client();
    const result = await call<IyzicoResult>((cb) =>
      api.subMerchant.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: input.externalId,
          subMerchantExternalId: input.externalId,
          subMerchantType: Iyzipay.SUB_MERCHANT_TYPE.PERSONAL,
          address: input.address,
          contactName: input.firstName,
          contactSurname: input.lastName,
          email: input.email,
          gsmNumber: input.phone ? `+9${input.phone}` : undefined,
          name: input.legalName,
          iban: input.iban,
          identityNumber: input.identityNumber,
          currency: Iyzipay.CURRENCY.TRY,
        } as never,
        cb as never,
      ),
    );
    return result.status === "success" && typeof result.subMerchantKey === "string"
      ? { ok: true, subMerchantKey: result.subMerchantKey }
      : { ok: false, error: errorText(result) };
  },
};
