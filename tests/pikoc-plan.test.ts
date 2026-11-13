import { describe, expect, it } from "vitest";
import { centerAccess } from "@/lib/center/subscription";
import { coachPlan, coachPlanLabel, parseCoachTiers } from "@/lib/pi-koc";

const NOW = new Date("2026-11-12T12:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe("Pi Koç paketi", () => {
  it("yeni kademeler okunur", () => {
    expect(parseCoachTiers("5:349,10:599,20:999,50:2000").map((t) => t.students)).toEqual([5, 10, 20, 50]);
  });

  it("ödemesi olmayan hesap ücretsiz pakettedir; seçtiği paket ödeme gelince açılır", () => {
    const plan = coachPlan({ status: "ACTIVE", trialEndsAt: null, paidUntil: null, studentLimit: 10 }, 3, NOW);
    expect(plan).toMatchObject({ state: "free", paid: false, studentLimit: 3, paidLimit: 10 });
    expect(coachPlanLabel(plan)).toBe("Karalama Defteri · ücretsiz, 3 öğrenciye kadar");
  });

  it("ödemesi süren hesap ücretli pakettedir; süre bitince 7 gün daha açık kalır, sonra ücretsize döner", () => {
    const center = { status: "ACTIVE" as const, trialEndsAt: null, studentLimit: 10 };
    expect(coachPlan({ ...center, paidUntil: days(20) }, 3, NOW)).toMatchObject({ state: "paid", paid: true, studentLimit: 10, daysLeft: 20 });
    expect(coachPlan({ ...center, paidUntil: days(-3) }, 3, NOW)).toMatchObject({ state: "paid", paid: true });
    expect(coachPlan({ ...center, paidUntil: days(-8) }, 3, NOW)).toMatchObject({ state: "free", paid: false, studentLimit: 3 });
  });

  it("eski hesabın denemesi bitene kadar ücretli gibi sayılır, bitince ücretsize düşer", () => {
    const center = { status: "TRIAL" as const, paidUntil: null, studentLimit: 10 };
    expect(coachPlan({ ...center, trialEndsAt: days(5) }, 3, NOW)).toMatchObject({ state: "trial", paid: true, studentLimit: 10 });
    expect(coachPlan({ ...center, trialEndsAt: days(-1) }, 3, NOW)).toMatchObject({ state: "free", paid: false, studentLimit: 3 });
  });

  it("Pi Koç paneli süre bitince salt okunur olmaz (ücretsiz pakete döner); kurum paneli olur", () => {
    const expired = { status: "TRIAL" as const, trialEndsAt: days(-30), paidUntil: null };
    expect(centerAccess({ ...expired, kind: "COACH" }, NOW).writable).toBe(true);
    expect(centerAccess({ ...expired, kind: "ETUT" }, NOW).writable).toBe(false);
    expect(centerAccess({ status: "SUSPENDED", trialEndsAt: null, paidUntil: null, kind: "COACH" }, NOW).canLogin).toBe(false);
  });
});
