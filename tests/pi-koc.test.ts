import { describe, expect, it } from "vitest";
import { coachPriceFor, parseCoachTiers } from "@/lib/pi-koc";
import { settingsSchema } from "@/server/settings";

describe("Pi Koç kademeleri", () => {
  it("varsayılan kademeler sıralı okunur; 3 öğrenciye kadar ücretsiz", () => {
    const settings = settingsSchema.parse({});
    expect(parseCoachTiers(settings.piKocTiers)).toEqual([
      { students: 5, priceTl: 349, name: "Net Avcısı" },
      { students: 10, priceTl: 599, name: "Soru Canavarı" },
      { students: 20, priceTl: 999, name: "Deneme Ustası" },
      { students: 50, priceTl: 2000, name: "Derece Fabrikası" },
    ]);
    expect(settings.piKocFreeStudents).toBe(3);
  });

  it("hatalı parçalar atlanır, aynı öğrenci sayısının sonuncusu geçerlidir", () => {
    expect(parseCoachTiers("10:700, abc, 5:0, 3:100\n10:749")).toEqual([
      { students: 3, priceTl: 100, name: "3 öğrenci paketi" },
      { students: 10, priceTl: 749, name: "Soru Canavarı" },
    ]);
    expect(parseCoachTiers("")).toEqual([]);
  });

  it("öğrenci sınırının fiyatı bulunur; özel sınırda fiyat yoktur", () => {
    const tiers = parseCoachTiers("3:299,5:449");
    expect(coachPriceFor(tiers, 5)).toBe(449);
    expect(coachPriceFor(tiers, 7)).toBeNull();
  });
});
