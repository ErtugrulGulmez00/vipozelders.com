import { afterAll, describe, expect, it } from "vitest";
import { completeCheckout, createBookingHold, startCheckout } from "@/server/bookings";
import { db } from "@/server/db";
import { ensureReferralCode, referrerForCode } from "@/server/discounts";
import { at, createFixture, LESSON_DAY, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});


async function payBooking(studentId: string, offeringId: string, startAt: Date) {
  const booking = await createBookingHold({ studentId, offeringId, startAt, durationMinutes: 60, mode: "ONLINE", learnerName: "Ali" }, NOW);
  await startCheckout(booking.id, studentId, "127.0.0.1", NOW);
  const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id }, orderBy: { createdAt: "desc" } });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { mockOutcome: "success" } } });
  await completeCheckout(payment.providerToken!, NOW);
  return db.booking.findUniqueOrThrow({ where: { id: booking.id } });
}

describe("arkadaşını getir", () => {
  it("davetle gelen üyeye yalnızca ilk siparişte indirim", async () => {
    const f = await createFixture({ hourlyPrice: 100000 });
    const referrer = await f.createStudent();
    const inviteCode = await ensureReferralCode(referrer.id);
    expect(await ensureReferralCode(referrer.id)).toBe(inviteCode);
    expect(await referrerForCode(inviteCode.toLowerCase())).toBe(referrer.id);

    const friend = await f.createStudent();
    await db.user.update({ where: { id: friend.id }, data: { referredById: referrer.id } });
    const booking = await payBooking(friend.id, f.offering.id, at(LESSON_DAY, "16:00"));
    // Varsayılan %10, hizmet bedelinden
    expect(booking).toMatchObject({ price: 90000, discountAmount: 10000, couponCode: null });

    // İkinci siparişte indirim yok
    const second = await payBooking(friend.id, f.offering.id, at(LESSON_DAY, "18:00"));
    expect(second.discountAmount).toBe(0);
  });
});
