import { createHash } from "node:crypto";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { garantiConfig, garantiProvider, hashedPassword, oosFormFields, saveGarantiCallback, secure3dHash, xmlBlock, xmlHash } from "@/server/payments/garanti";

afterAll(async () => {
  await db.$disconnect();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();
const sha512 = (s: string) => createHash("sha512").update(s).digest("hex").toUpperCase();

function inquiryXml(code: string, authAmount: number, reason = "00") {
  return `<GVPSResponse><Order><OrderID>X</OrderID><OrderInqResult><AuthAmount>${authAmount}</AuthAmount><Status>${authAmount ? "APPROVED" : ""}</Status><Code></Code><RetrefNum>629912345678</RetrefNum><AuthCode>123456</AuthCode></OrderInqResult></Order><Transaction><Response><Source>GVPS</Source><Code>${code}</Code><ReasonCode>${reason}</ReasonCode><Message>${code === "00" ? "Approved" : "Declined"}</Message><ErrorMsg>${code === "00" ? "" : "İşlem bulunamadı"}</ErrorMsg></Response></Transaction></GVPSResponse>`;
}
const responseXml = (code: string, error = "") => `<GVPSResponse><Transaction><Response><Code>${code}</Code><ReasonCode>${code === "00" ? "00" : "0999"}</ReasonCode><Message>x</Message><ErrorMsg>${error}</ErrorMsg></Response></Transaction></GVPSResponse>`;

/** Bankaya giden XML isteklerini sırayla yanıtlayan sahte fetch. */
function stubBank(...replies: string[]) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
      calls.push(init.body.get("data") ?? "");
      return new Response(replies.shift() ?? responseXml("99", "beklenmeyen istek"));
    }),
  );
  return calls;
}

async function garantiPayment(amount = 125000) {
  const payment = await db.payment.create({ data: { provider: "garanti", amount, raw: { garantiMode: "TEST" } } });
  return db.payment.update({ where: { id: payment.id }, data: { providerToken: payment.id } });
}

describe("Garanti imzaları", () => {
  it("şifre özeti 9 haneli terminal numarasıyla, form ve XML imzaları belgedeki sırayla hesaplanır", () => {
    expect(hashedPassword("123qweASD/", "30691297")).toBe(sha1("123qweASD/030691297"));
    const hp = sha1("123qweASD/030691297");
    expect(secure3dHash({ terminalId: "30691297", orderId: "O1", amount: "100", currency: "949", successUrl: "s", errorUrl: "e", type: "sales", installment: "", storeKey: "12345678", password: "123qweASD/" })).toBe(
      sha512("30691297O1100949sesales12345678" + hp),
    );
    expect(xmlHash({ orderId: "O1", terminalId: "30691297", amount: "100", currency: "949", password: "123qweASD/" })).toBe(sha512("O130691297100949" + hp));
  });

  it("form alanları: ortak ödeme sayfası, tutar kuruş, taksitsiz", () => {
    const fields = oosFormFields(garantiConfig("TEST"), { orderId: "O1", amount: 2550, email: "a@b.c", ipAddress: "1.2.3.4", returnUrl: "https://x/donus" });
    expect(fields).toMatchObject({ secure3dsecuritylevel: "3D_OOS_PAY", terminalprovuserid: "PROVOOS", txnamount: "2550", txncurrencycode: "949", txninstallmentcount: "", txntype: "sales", mode: "TEST", successurl: "https://x/donus", errorurl: "https://x/donus" });
    expect(fields.secure3dhash).toMatch(/^[0-9A-F]{128}$/);
    expect(fields).not.toHaveProperty("cardnumber");
  });

  it("XML okuyucu iç içe blokları bulur", () => {
    const xml = inquiryXml("00", 100);
    expect(xmlBlock(xml, "Transaction", "Response", "Code")).toBe("00");
    expect(xmlBlock(xml, "Order", "OrderInqResult", "AuthAmount")).toBe("100");
    expect(xmlBlock(xml, "Yok")).toBe("");
  });
});

describe("Garanti ödeme sonucu", () => {
  it("dönüş alanlarına değil bankaya sorguya güvenilir: onaylı sorgu → başarılı, tutar bankadan", async () => {
    const payment = await garantiPayment();
    await saveGarantiCallback(payment.id, { mdstatus: "1", procreturncode: "00", response: "Approved" });
    const calls = stubBank(inquiryXml("00", 125000));
    const result = await garantiProvider.retrieveResult(payment.id);
    expect(result).toMatchObject({ status: "success", paidAmount: 125000, providerPaymentId: payment.id, providerItemId: "629912345678" });
    expect(calls[0]).toContain("<Type>orderinq</Type>");
    expect(calls[0]).toContain(`<OrderID>${payment.id}</OrderID>`);
  });

  it("dönüş 'başarılı' dese de bankada işlem yoksa ödeme kabul edilmez", async () => {
    const payment = await garantiPayment();
    await saveGarantiCallback(payment.id, { mdstatus: "1", procreturncode: "00" });
    stubBank(inquiryXml("92", 0, "0110"));
    const result = await garantiProvider.retrieveResult(payment.id);
    expect(result.status).toBe("failure");
  });

  it("dönüş yoksa beklemede kalır; banka reddettiyse sebebi gösterilir", async () => {
    const waiting = await garantiPayment();
    stubBank(inquiryXml("92", 0, "0110"));
    expect((await garantiProvider.retrieveResult(waiting.id)).status).toBe("pending");

    const declined = await garantiPayment();
    await saveGarantiCallback(declined.id, { mdstatus: "1", procreturncode: "51", errmsg: "Yetersiz bakiye" });
    stubBank(inquiryXml("92", 0, "0110"));
    expect(await garantiProvider.retrieveResult(declined.id)).toMatchObject({ status: "failure", reason: "Yetersiz bakiye" });
  });

  it("iade: önce iade, kabul edilmezse tam tutar için aynı gün iptal (void)", async () => {
    const payment = await garantiPayment(50000);
    let calls = stubBank(responseXml("00"));
    expect(await garantiProvider.refund({ providerPaymentId: payment.id, providerItemId: "629912345678", amount: 20000, ipAddress: "1.1.1.1", reference: "r1" })).toEqual({ ok: true, reference: "r1" });
    expect(calls[0]).toContain("<Type>refund</Type>");
    expect(calls[0]).toContain("<ProvUserID>PROVRFN</ProvUserID>");
    expect(calls[0]).toContain("<Amount>20000</Amount>");

    calls = stubBank(responseXml("92", "Gün sonu yapılmadan iade yapılamaz"), inquiryXml("00", 50000), responseXml("00"));
    expect((await garantiProvider.refund({ providerPaymentId: payment.id, providerItemId: "629912345678", amount: 50000, ipAddress: "1.1.1.1", reference: "r2" })).ok).toBe(true);
    expect(calls[2]).toContain("<Type>void</Type>");
    expect(calls[2]).toContain("<OriginalRetrefNum>629912345678</OriginalRetrefNum>");

    // Kısmi iade aynı gün iptalle yapılamaz; hata döner (arka plan görevi sonra tekrar dener)
    stubBank(responseXml("92", "Gün sonu yapılmadan iade yapılamaz"), inquiryXml("00", 50000));
    const partial = await garantiProvider.refund({ providerPaymentId: payment.id, providerItemId: "629912345678", amount: 10000, ipAddress: "1.1.1.1", reference: "r3" });
    expect(partial.ok).toBe(false);
  });
});
