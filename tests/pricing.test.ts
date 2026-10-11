import { describe, expect, it } from "vitest";
import {
  approvalDeadline,
  lessonPrice,
  splitCommission,
  splitRetained,
  studentCancellationRefund,
  weightedRating,
} from "@/server/pricing";

const HOUR = 3_600_000;
const policy = { fullRefundHours: 24, partialRefundHours: 2, partialRefundPercent: 50 };

describe("ders ücreti", () => {
  it("saatlik ücretten süreye göre tam liraya yuvarlar", () => {
    expect(lessonPrice(80000, 60)).toBe(80000);
    expect(lessonPrice(80000, 90)).toBe(120000);
    expect(lessonPrice(75000, 45)).toBe(56300);
    expect(lessonPrice(99900, 30)).toBe(50000);
  });

  it("komisyonu ve öğretmen payını ayırır", () => {
    expect(splitCommission(100000, 1500)).toEqual({ commissionAmount: 15000, teacherAmount: 85000 });
    expect(splitCommission(56300, 1750)).toEqual({ commissionAmount: 9853, teacherAmount: 46447 });
    expect(splitCommission(50000, 0)).toEqual({ commissionAmount: 0, teacherAmount: 50000 });
  });
});

describe("öğrenci iptali", () => {
  const now = new Date("2026-10-12T10:00:00Z");

  it("24 saatten önce tam iade", () => {
    const start = new Date(now.getTime() + 30 * HOUR);
    expect(studentCancellationRefund(100000, start, now, policy)).toEqual({ refundAmount: 100000, refundPercent: 100 });
  });

  it("24 saat ile 2 saat arası %50 iade", () => {
    const start = new Date(now.getTime() + 10 * HOUR);
    expect(studentCancellationRefund(100000, start, now, policy)).toEqual({ refundAmount: 50000, refundPercent: 50 });
  });

  it("son 2 saatte iade yok", () => {
    const start = new Date(now.getTime() + 1 * HOUR);
    expect(studentCancellationRefund(100000, start, now, policy)).toEqual({ refundAmount: 0, refundPercent: 0 });
  });

  it("kalan tutar komisyon oranında paylaştırılır", () => {
    expect(splitRetained(100000, 15000, 50000)).toEqual({ retained: 50000, commission: 7500, teacher: 42500 });
    expect(splitRetained(100000, 15000, 100000)).toEqual({ retained: 0, commission: 0, teacher: 0 });
    expect(splitRetained(100000, 15000, 0)).toEqual({ retained: 100000, commission: 15000, teacher: 85000 });
  });
});

describe("onay süresi", () => {
  const settings = { approvalWindowHours: 12, approvalMinHoursBeforeStart: 2 };
  const paidAt = new Date("2026-10-12T10:00:00Z");

  it("uzak derste ödeme + 12 saat", () => {
    const start = new Date(paidAt.getTime() + 72 * HOUR);
    expect(approvalDeadline(paidAt, start, settings)).toEqual(new Date(paidAt.getTime() + 12 * HOUR));
  });

  it("yakın derste dersten 2 saat önce", () => {
    const start = new Date(paidAt.getTime() + 5 * HOUR);
    expect(approvalDeadline(paidAt, start, settings)).toEqual(new Date(paidAt.getTime() + 3 * HOUR));
  });

  it("çok yakın derste ders başlangıcı", () => {
    const start = new Date(paidAt.getTime() + 1 * HOUR);
    expect(approvalDeadline(paidAt, start, settings)).toEqual(start);
  });
});

describe("ağırlıklı puan", () => {
  it("tek yorumlu 5 yıldız, çok yorumlu 4,9'u geçemez", () => {
    expect(weightedRating(5, 1)).toBeLessThan(weightedRating(4.9, 200));
  });
});
