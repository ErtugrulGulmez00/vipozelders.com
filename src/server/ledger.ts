import type { LedgerBucket } from "@/generated/prisma/client";
import { db, type DbTransaction } from "./db";

type Tx = DbTransaction | typeof db;

export async function addLedgerEntry(
  tx: Tx,
  entry: { teacherId: string; bookingId?: string | null; poolQuestionId?: string | null; subscriptionId?: string | null; payoutId?: string | null; bucket: LedgerBucket; amount: number; description: string },
) {
  if (entry.amount === 0) return;
  await tx.ledgerEntry.create({ data: entry });
}

/** Bir randevu için bekleyen (henüz serbest bırakılmamış) öğretmen hakedişi. */
export async function pendingForBooking(tx: Tx, bookingId: string): Promise<number> {
  const result = await tx.ledgerEntry.aggregate({
    where: { bookingId, bucket: "PENDING" },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

export async function teacherBalances(teacherId: string, tx: Tx = db) {
  const groups = await tx.ledgerEntry.groupBy({
    by: ["bucket"],
    where: { teacherId },
    _sum: { amount: true },
  });
  const sum = (bucket: LedgerBucket) => groups.find((g) => g.bucket === bucket)?._sum.amount ?? 0;
  return { pending: sum("PENDING"), available: sum("AVAILABLE"), paid: sum("PAID") };
}

/** Bekleyen hakedişi tamamen geri alır ve (varsa) kalan payı yeniden bekleyene yazar. */
export async function resetPendingForBooking(
  tx: Tx,
  booking: { id: string; teacherId: string },
  newPendingAmount: number,
  description: string,
) {
  const current = await pendingForBooking(tx, booking.id);
  if (current !== newPendingAmount) {
    await addLedgerEntry(tx, {
      teacherId: booking.teacherId,
      bookingId: booking.id,
      bucket: "PENDING",
      amount: newPendingAmount - current,
      description,
    });
  }
}

/** Admin'in banka havalesiyle yaptığı ödemeyi kaydeder: serbest bakiye → ödendi. */
export async function recordManualPayout(input: { teacherId: string; amount: number; reference: string; adminId: string }) {
  return db.$transaction(async (tx) => {
    const balances = await teacherBalances(input.teacherId, tx);
    if (input.amount <= 0 || input.amount > balances.available) {
      throw new Error("Ödeme tutarı serbest bakiyeden büyük olamaz.");
    }
    const payout = await tx.payout.create({
      data: {
        teacherId: input.teacherId,
        amount: input.amount,
        method: "MANUAL_TRANSFER",
        reference: input.reference,
        createdById: input.adminId,
      },
    });
    await addLedgerEntry(tx, {
      teacherId: input.teacherId,
      payoutId: payout.id,
      bucket: "AVAILABLE",
      amount: -input.amount,
      description: `Havale ile ödeme (${input.reference})`,
    });
    await addLedgerEntry(tx, {
      teacherId: input.teacherId,
      payoutId: payout.id,
      bucket: "PAID",
      amount: input.amount,
      description: `Havale ile ödeme (${input.reference})`,
    });
    return payout;
  });
}
