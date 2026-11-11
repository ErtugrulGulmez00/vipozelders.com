import { describe, expect, it } from "vitest";
import { maskContacts } from "@/lib/text";

describe("maskContacts", () => {
  it.each([
    "0532 111 22 33",
    "0532/111/22/33",
    "0532_111_22_33",
    "0532​111​2233",
    "０５３２１１１２２３３",
    "٠٥٣٢١١١٢٢٣٣",
    "+90 (532) 111 22 33",
  ])("telefonu gizler: %s", (text) => {
    expect(maskContacts(`Beni ara ${text} lütfen`)).toContain("[telefon gizlendi]");
  });

  it.each(["ali@gmail.com", "ali [at] gmail [dot] com", "ali(at)gmail(dot)com"])("e-postayı gizler: %s", (text) => {
    expect(maskContacts(`yaz: ${text}`)).toContain("[iletişim bilgisi gizlendi]");
  });

  it.each(["site(.)com", "benimsite.xyz", "www.ornek.org", "https://t.me/ali"])("bağlantıyı gizler: %s", (text) => {
    expect(maskContacts(`bak ${text}`)).toContain("[bağlantı gizlendi]");
  });

  it("sosyal medya hesabını gizler", () => {
    expect(maskContacts("instagram: ali_hoca")).toBe("instagram: [kullanıcı adı gizlendi]");
    expect(maskContacts("bana @ali_hoca yaz")).toContain("[kullanıcı adı gizlendi]");
  });

  it("olağan metne dokunmaz", () => {
    const text = "8 yıllık deneyim, 2024 LGS'de 15 öğrencim 480+ puan aldı. Ders 40 dk sürer.";
    expect(maskContacts(text)).toBe(text);
  });
});
