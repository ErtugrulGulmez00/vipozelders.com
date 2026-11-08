import { describe, expect, it } from "vitest";
import { coachPriceFor, parseCoachTiers } from "@/lib/pi-koc";
import { settingsSchema } from "@/server/settings";

describe("Pi Koç kademeleri", () => {
  it("varsayılan kademeler sıralı okunur", () => {
    const tiers = parseCoachTiers(settingsSchema.parse({}).piKocTiers);
    expect(tiers).toEqual([
      { students: 3, priceTl: 299 },
      { students: 5, priceTl: 449 },
      { students: 10, priceTl: 749 },
      { students: 15, priceTl: 999 },
      { students: 25, priceTl: 1499 },
      { students: 50, priceTl: 2499 },
    ]);
  });

  it("hatalı parçalar atlanır, aynı öğrenci sayısının sonuncusu geçerlidir", () => {
    expect(parseCoachTiers("10:700, abc, 5:0, 3:100\n10:749")).toEqual([
      { students: 3, priceTl: 100 },
      { students: 10, priceTl: 749 },
    ]);
    expect(parseCoachTiers("")).toEqual([]);
  });

  it("öğrenci sınırının fiyatı bulunur; özel sınırda fiyat yoktur", () => {
    const tiers = parseCoachTiers("3:299,5:449");
    expect(coachPriceFor(tiers, 5)).toBe(449);
    expect(coachPriceFor(tiers, 7)).toBeNull();
  });
});
