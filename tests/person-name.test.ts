import { describe, expect, it } from "vitest";
import { normalizePersonName } from "@/lib/text";

describe("ad biçimi", () => {
  it("tamamı büyük ya da küçük yazılmış adı düzeltir, karışık yazılana dokunmaz", () => {
    expect(normalizePersonName("ALİ İHSAN")).toBe("Ali İhsan");
    expect(normalizePersonName("  ışıl   ılgın ")).toBe("Işıl Ilgın");
    expect(normalizePersonName("SAVAŞ")).toBe("Savaş");
    expect(normalizePersonName("ayşe-nur")).toBe("Ayşe-Nur");
    expect(normalizePersonName("McAdam")).toBe("McAdam");
    expect(normalizePersonName("Zeynep")).toBe("Zeynep");
  });
});
