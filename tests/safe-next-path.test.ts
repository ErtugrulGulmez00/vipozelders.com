import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/auth-constants";

const SITE = "https://pikampus.com";

describe("girişten sonra yönlendirme (safeNextPath)", () => {
  it("site içi yolları olduğu gibi geçirir", () => {
    for (const path of ["/", "/hesabim", "/kurum/ogrenciler?sayfa=2", "/ders-baglantisi/abc123", "/ogretmenler?q=lise matematik#yorumlar", "/panel?taraf=kurum"]) {
      expect(safeNextPath(path)).toBe(path);
    }
  });

  it("dış siteye giden ya da tarayıcının farklı çözdüğü adresleri reddeder", () => {
    const attacks = [
      "https://example.com",
      "//example.com",
      "/\\example.com",
      "/\t/example.com",
      "/\n/example.com",
      "/\r\n/example.com",
      "/\t\\example.com",
      "/x\\..\\..\\/example.com",
      "/.//example.com",
      "/..//example.com",
      "/./\t/example.com",
      "/\u0000/example.com",
      "/\u007f/example.com",
      "javascript:alert(1)",
      " /hesabim",
      "",
      null,
      undefined,
    ];
    for (const value of attacks) expect(safeNextPath(value), JSON.stringify(value)).toBeNull();
  });

  it("geçen her adres tarayıcıda aynı sitede kalır", () => {
    const samples = ["/a//b", "/%2F%2Fexample.com", "/%09/example.com", "/a/./b", "/a/../b", "/@example.com", "/ /example.com", "/hesabim?next=//example.com"];
    for (const value of samples) {
      const safe = safeNextPath(value);
      if (safe === null) continue;
      const url = new URL(safe, SITE);
      expect(url.origin, value).toBe(SITE);
      expect(url.pathname.startsWith("//"), value).toBe(false);
    }
  });
});
