import { describe, expect, it } from "vitest";
import { churnAllowance, seatProblem } from "@/lib/koc-seats";

const now = new Date("2026-11-15T12:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

describe("Pi Koç koltuk kuralı", () => {
  it("değişim payı paket sınırının yaklaşık %40'ı (en az 1)", () => {
    expect(churnAllowance(3)).toBe(2);
    expect(churnAllowance(5)).toBe(2);
    expect(churnAllowance(10)).toBe(4);
    expect(churnAllowance(1)).toBe(1);
  });

  it("sınır doluysa yeni öğrenci eklenemez", () => {
    expect(seatProblem({ limit: 5, active: 5, recentlyArchived: 0 }, now)).toMatch(/öğrenci sınırı 5/);
    expect(seatProblem({ limit: 5, active: 4, recentlyArchived: 0 }, now)).toBeNull();
  });

  it("arşivle-yenisini ekle döngüsü ayda değişim payıyla sınırlı", () => {
    // 5'lik paket: 4 aktif + 1 yakında arşivlenen → eklenebilir; 4 aktif + 3 arşivlenen → 7'ye ulaşır, eklenemez
    expect(seatProblem({ limit: 5, active: 4, recentlyArchived: 2 }, now)).toBeNull();
    expect(seatProblem({ limit: 5, active: 4, recentlyArchived: 3 }, now)).toMatch(/en fazla 7 farklı öğrenci/);
  });

  it("arşivden dönüş 30 gün bekler; ilk 24 saat geri alınabilir", () => {
    const state = { limit: 5, active: 3, recentlyArchived: 1 };
    expect(seatProblem(state, now, { archivedAt: daysAgo(7), countedInRecent: true })).toMatch(/30 gün dolmadan/);
    expect(seatProblem(state, now, { archivedAt: hoursAgo(3), countedInRecent: false })).toBeNull();
    expect(seatProblem(state, now, { archivedAt: daysAgo(31), countedInRecent: false })).toBeNull();
    // Sistemin arşivlediği (zamanı tutulmayan) öğrenci beklemeden döner
    expect(seatProblem(state, now, { archivedAt: null, countedInRecent: false })).toBeNull();
  });

  it("geri alınan öğrenci kendini yakın arşiv sayısında iki kez saymaz", () => {
    expect(seatProblem({ limit: 5, active: 4, recentlyArchived: 3 }, now, { archivedAt: hoursAgo(2), countedInRecent: true })).toBeNull();
  });
});
