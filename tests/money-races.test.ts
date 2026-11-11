import { afterAll, describe, expect, it } from "vitest";
import { completeCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { addLedgerEntry, recordManualPayout, teacherBalances } from "@/server/ledger";
import { createLessonPackage, saveTeacherPackageDiscounts, startPackageCheckout } from "@/server/packages";
import { processRefund } from "@/server/payments/service";
import { createFixture, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("eşzamanlı para işlemleri", () => {
  it("aynı anda gelen hakediş ödemeleri serbest bakiyeyi aşmaz", async () => {
    const f = await createFixture();
    await addLedgerEntry(db, { teacherId: f.teacher.id, bucket: "AVAILABLE", amount: 100000, description: "test" });
    const results = await Promise.allSettled(
      [1, 2, 3].map((i) => recordManualPayout({ teacherId: f.teacher.id, amount: 100000, reference: `test-${i}`, adminId: f.teacher.id })),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await teacherBalances(f.teacher.id)).toMatchObject({ available: 0, paid: 100000 });
  });

  it("aynı iade aynı anda üç kez işlenirse ödeme yalnızca bir kez iade edilir", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    const student = await f.createStudent();
    await saveTeacherPackageDiscounts(f.teacher.id, [{ lessons: 2, percent: 0 }]);
    const pkg = await createLessonPackage(student.id, { offeringId: f.offering.id, durationMinutes: 60, lessons: 2 }, NOW);
    await startPackageCheckout(pkg.id, student.id, "127.0.0.1");
    const payment = await db.payment.findFirstOrThrow({ where: { packageId: pkg.id } });
    await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
    await completeCheckout(payment.providerToken!, NOW);
    const refund = await db.refund.create({ data: { paymentId: payment.id, amount: payment.amount, reason: "test" } });

    await Promise.all([processRefund(refund.id), processRefund(refund.id), processRefund(refund.id)]);

    const after = await db.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(after.refundedAmount).toBe(payment.amount);
    expect(await db.refund.findUniqueOrThrow({ where: { id: refund.id } })).toMatchObject({ status: "SUCCEEDED", attempts: 1, claimedAt: null });
  });
});
