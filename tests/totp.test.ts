import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpCode, totpUri, verifyTotp } from "@/server/auth/totp";

// RFC 6238 Ek B, SHA-1 anahtarı "12345678901234567890" (8 hanelik kodların son 6 hanesi)
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
  [20000000000, "353130"],
];

describe("TOTP (iki adımlı doğrulama)", () => {
  it("RFC 6238 test vektörleriyle aynı kodları üretir", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    for (const [seconds, code] of VECTORS) expect(totpCode(RFC_SECRET, Math.floor(seconds / 30))).toBe(code);
  });

  it("base32 gidiş-dönüş ve rastgele anahtar", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
    expect(base32Decode("gezd gnbv").toString()).toBe("12345");
  });

  it("±30 sn kaymayı kabul eder, eski ve tekrar kullanılan kodu reddeder", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), null, now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), null, now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), null, now)).toBeNull();
    // Aynı adım ikinci kez kullanılamaz
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), step, now)).toBeNull();
    // Boşluklu yazım kabul edilir, harf/eksik hane reddedilir
    const code = totpCode(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, `${code.slice(0, 3)} ${code.slice(3)}`, null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, "12a456", null, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", null, now)).toBeNull();
  });

  it("doğrulayıcı uygulama adresi", () => {
    const uri = new URL(totpUri(RFC_SECRET, "admin", "Pi Kampüs"));
    expect(uri.protocol).toBe("otpauth:");
    expect(uri.host).toBe("totp");
    expect(decodeURIComponent(uri.pathname)).toBe("/Pi Kampüs:admin");
    expect(uri.searchParams.get("secret")).toBe(RFC_SECRET);
    expect(uri.searchParams.get("issuer")).toBe("Pi Kampüs");
  });
});
