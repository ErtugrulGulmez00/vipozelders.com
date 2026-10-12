import { describe, expect, it } from "vitest";
import { addMonthsToDateString, allocatePayment, amountInWords, buildInstallments, installmentState, numberToTurkishWords } from "@/lib/center/finance";
import { centerCan } from "@/lib/center/permissions";
import { centerAccess, extendSubscription } from "@/lib/center/subscription";

describe("taksit planı", () => {
  it("tam liraya böler, artan kuruşu ilk taksite ekler", () => {
    const rows = buildInstallments({ netAmount: 2_500_000, count: 12, firstDueDate: "2026-10-15" });
    expect(rows).toHaveLength(12);
    expect(rows.reduce((t, r) => t + r.amount, 0)).toBe(2_500_000);
    expect(rows[1].amount).toBe(208_300);
    expect(rows[0].amount).toBe(2_500_000 - 208_300 * 11);
    expect(rows[11].dueDate).toBe("2027-09-15");
  });
  it("peşinatı ayrı satır yapar", () => {
    const rows = buildInstallments({ netAmount: 1_000_000, count: 4, firstDueDate: "2026-11-01", downPayment: 200_000, downPaymentDate: "2026-10-12" });
    expect(rows[0]).toEqual({ order: 1, dueDate: "2026-10-12", amount: 200_000 });
    expect(rows.slice(1).map((r) => r.amount)).toEqual([200_000, 200_000, 200_000, 200_000]);
    expect(rows.map((r) => r.order)).toEqual([1, 2, 3, 4, 5]);
  });
  it("ay sonunu taşırmaz", () => {
    expect(addMonthsToDateString("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToDateString("2026-12-15", 2)).toBe("2027-02-15");
  });
});

describe("tahsilat dağıtımı", () => {
  const installments = [
    { id: "b", order: 2, dueDate: "2026-11-15", amount: 100_000, paidAmount: 0 },
    { id: "a", order: 1, dueDate: "2026-10-15", amount: 100_000, paidAmount: 40_000 },
    { id: "c", order: 3, dueDate: "2026-12-15", amount: 100_000, paidAmount: 0 },
  ];
  it("en eski vadeden başlar", () => {
    expect(allocatePayment(installments, 130_000)).toEqual({
      allocations: [
        { installmentId: "a", amount: 60_000 },
        { installmentId: "b", amount: 70_000 },
      ],
      unallocated: 0,
    });
  });
  it("borçtan fazlası açıkta kalır", () => {
    expect(allocatePayment(installments, 300_000).unallocated).toBe(40_000);
  });
  it("taksit durumu", () => {
    expect(installmentState({ dueDate: "2026-10-01", amount: 100, paidAmount: 100 }, "2026-10-12")).toBe("paid");
    expect(installmentState({ dueDate: "2026-10-01", amount: 100, paidAmount: 50 }, "2026-10-12")).toBe("overdue");
    expect(installmentState({ dueDate: "2026-10-12", amount: 100, paidAmount: 0 }, "2026-10-12")).toBe("due");
    expect(installmentState({ dueDate: "2026-11-01", amount: 100, paidAmount: 30 }, "2026-10-12")).toBe("partial");
  });
});

describe("yazıyla tutar", () => {
  it("Türkçe sayı okunuşu", () => {
    expect(numberToTurkishWords(0)).toBe("sıfır");
    expect(numberToTurkishWords(1000)).toBe("bin");
    expect(numberToTurkishWords(1250)).toBe("bin iki yüz elli");
    expect(numberToTurkishWords(101)).toBe("yüz bir");
    expect(numberToTurkishWords(2_000_015)).toBe("iki milyon on beş");
    expect(numberToTurkishWords(311_000)).toBe("üç yüz on bir bin");
  });
  it("makbuz metni", () => {
    expect(amountInWords(250_050)).toBe("Yalnız iki bin beş yüz Türk lirası elli kuruş");
    expect(amountInWords(100_000)).toBe("Yalnız bin Türk lirası");
  });
});

describe("kurum yetkileri", () => {
  it("öğretmen muhasebeyi göremez, muhasebeci deneme giremez", () => {
    expect(centerCan("TEACHER", "attendance.take")).toBe(true);
    expect(centerCan("TEACHER", "finance.view")).toBe(false);
    expect(centerCan("ACCOUNTANT", "finance.edit")).toBe(true);
    expect(centerCan("ACCOUNTANT", "exams.manage")).toBe(false);
    expect(centerCan("MANAGER", "staff.manage")).toBe(true);
    expect(centerCan("MANAGER", "subscription.view")).toBe(false);
    expect(centerCan("OWNER", "subscription.view")).toBe(true);
  });
});

describe("abonelik durumu", () => {
  const now = new Date("2026-10-12T10:00:00Z");
  const day = 86_400_000;
  it("deneme süresi biterse salt okunur", () => {
    expect(centerAccess({ status: "TRIAL", trialEndsAt: new Date(now.getTime() + 3 * day), paidUntil: null }, now)).toMatchObject({ state: "trial", writable: true, daysLeft: 3 });
    expect(centerAccess({ status: "TRIAL", trialEndsAt: new Date(now.getTime() - day), paidUntil: null }, now)).toMatchObject({ state: "expired", writable: false, canLogin: true });
  });
  it("ödeme gecikince 7 gün ek süre", () => {
    expect(centerAccess({ status: "ACTIVE", trialEndsAt: null, paidUntil: new Date(now.getTime() - 2 * day) }, now)).toMatchObject({ state: "grace", writable: true });
    expect(centerAccess({ status: "ACTIVE", trialEndsAt: null, paidUntil: new Date(now.getTime() - 8 * day) }, now)).toMatchObject({ state: "expired", writable: false });
  });
  it("askıdaki kurum giriş yapamaz", () => {
    expect(centerAccess({ status: "SUSPENDED", trialEndsAt: null, paidUntil: null }, now)).toMatchObject({ canLogin: false, writable: false });
  });
  it("süre uzatma bitişin üzerine eklenir", () => {
    const paidUntil = new Date("2026-11-01T00:00:00Z");
    expect(extendSubscription(paidUntil, 1, now).periodEnd.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(extendSubscription(new Date("2026-01-01T00:00:00Z"), 1, now).periodStart).toEqual(now);
  });
});
