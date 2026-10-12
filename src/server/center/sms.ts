// SMS gönderimi (Netgsm REST v2). Ortam değişkenleri tanımlı değilse SMS'ler yalnızca kayıt altına alınır.
//   NETGSM_USERCODE  : Netgsm abone numarası / kullanıcı kodu
//   NETGSM_PASSWORD  : API şifresi (Netgsm panelinde API alt kullanıcısı önerilir)
//   NETGSM_HEADER    : Onaylı SMS başlığı (ör. PIKAMPUS)

const NETGSM_URL = "https://api.netgsm.com.tr/sms/rest/v2/send";

export function smsConfigured(): boolean {
  return Boolean(process.env.NETGSM_USERCODE && process.env.NETGSM_PASSWORD && process.env.NETGSM_HEADER);
}

const ERRORS: Record<string, string> = {
  "20": "Mesaj metni hatalı ya da çok uzun",
  "30": "Netgsm kullanıcı adı/şifresi hatalı veya API erişimi kapalı",
  "40": "SMS başlığı Netgsm'de tanımlı değil",
  "50": "İYS kontrolü nedeniyle gönderilemedi",
  "51": "İYS marka bilgisi bulunamadı",
  "70": "Hatalı parametre",
  "80": "Gönderim limiti aşıldı",
  "85": "Aynı numaraya kısa sürede aynı mesaj gönderilemez",
};

/** 05XXXXXXXXX → 5XXXXXXXXX */
function nationalNumber(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  const national = digits.startsWith("90") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  return /^5\d{9}$/.test(national) ? national : null;
}

export type SmsResult = { ok: true; providerId: string } | { ok: false; error: string };

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const no = nationalNumber(phone);
  if (!no) return { ok: false, error: "Geçersiz cep telefonu numarası" };
  const auth = Buffer.from(`${process.env.NETGSM_USERCODE}:${process.env.NETGSM_PASSWORD}`).toString("base64");
  try {
    const response = await fetch(NETGSM_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      // Devamsızlık, ödeme hatırlatma gibi bilgilendirme mesajları ticari ileti sayılmaz (iysfilter boş).
      body: JSON.stringify({ msgheader: process.env.NETGSM_HEADER, encoding: "TR", iysfilter: "", messages: [{ msg: message, no }] }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => null)) as { code?: string; jobid?: string; description?: string } | null;
    if (data?.code === "00" && data.jobid) return { ok: true, providerId: data.jobid };
    const code = data?.code ?? String(response.status);
    return { ok: false, error: `${ERRORS[code] ?? data?.description ?? "Bilinmeyen hata"} (kod ${code})` };
  } catch (error) {
    return { ok: false, error: `Netgsm'e ulaşılamadı: ${String(error).slice(0, 150)}` };
  }
}
