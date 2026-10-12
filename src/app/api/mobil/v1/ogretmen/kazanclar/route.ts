import { db } from "@/server/db";
import { teacherBalances } from "@/server/ledger";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

const BUCKET_LABEL: Record<string, string> = { PENDING: "Bekleyen", AVAILABLE: "Ödenebilir", PAID: "Ödendi" };

/** Kazançlar: bekleyen / ödenebilir / ödenen bakiye, son hareketler ve havaleler. IBAN maskeli döner. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "TEACHER");
  const [balances, entries, payouts, profile] = await Promise.all([
    teacherBalances(user.id),
    db.ledgerEntry.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { booking: { select: { id: true, code: true } } } }),
    db.payout.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { payoutLegalName: true, payoutIban: true } }),
  ]);
  const iban = profile.payoutIban;
  return json({
    balances,
    payoutAccount: iban ? { legalName: profile.payoutLegalName, ibanMasked: `${iban.slice(0, 4)} •••• •••• ${iban.slice(-4)}` } : null,
    entries: entries.map((e) => ({ id: e.id, bucket: e.bucket, bucketLabel: BUCKET_LABEL[e.bucket] ?? e.bucket, amount: e.amount, description: e.description, bookingId: e.booking?.id ?? null, bookingCode: e.booking?.code ?? null, createdAt: e.createdAt })),
    payouts: payouts.map((p) => ({ id: p.id, amount: p.amount, method: p.method, reference: p.reference, createdAt: p.createdAt })),
  });
});
