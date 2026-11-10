import { describe, expect, it } from "vitest";
import { parseTurkishDate } from "@/components/ui/date-input";

describe("Türkçe tarih alanı", () => {
  it("GG.AA.YYYY ve benzer yazımları YYYY-AA-GG'ye çevirir", () => {
    expect(parseTurkishDate("07.11.2026")).toBe("2026-11-07");
    expect(parseTurkishDate("7.11.2026")).toBe("2026-11-07");
    expect(parseTurkishDate("7/11/26")).toBe("2026-11-07");
    expect(parseTurkishDate("29-02-2028")).toBe("2028-02-29");
  });

  it("geçersiz tarihleri reddeder", () => {
    expect(parseTurkishDate("31.02.2026")).toBeNull();
    expect(parseTurkishDate("2026-11-07")).toBeNull();
    expect(parseTurkishDate("abc")).toBeNull();
    expect(parseTurkishDate("")).toBeNull();
  });
});
