import { formatMoney } from "@/lib/money";
import { toLocalDateString, toLocalMinutes, zonedDateTime } from "@/lib/dates";
import { db } from "./db";
import { notifyRole } from "./notifications";
import { parsePayoutDays } from "./pricing";
import { loadSettings } from "./settings";

/** Ödeme günü sabahı (09:00 sonrası, günde bir kez) yöneticiye ödenecek bakiyeleri hatırlatır. */
export async function sendPayoutDayReminder(now = new Date()): Promise<number> {
  const settings = await loadSettings();
  const today = toLocalDateString(now);
  if (!parsePayoutDays(settings.payoutDays).includes(Number(today.slice(8)))) return 0;
  if (toLocalMinutes(now) < 9 * 60) return 0;
  const dayStart = zonedDateTime(today, 0);
  if (await db.notification.count({ where: { type: "admin.payout_day", createdAt: { gte: dayStart } } })) return 0;
  const groups = await db.ledgerEntry.groupBy({ by: ["teacherId"], where: { bucket: "AVAILABLE" }, _sum: { amount: true } });
  const payable = groups.filter((g) => (g._sum.amount ?? 0) > 0);
  if (!payable.length) return 0;
  const total = payable.reduce((sum, g) => sum + (g._sum.amount ?? 0), 0);
  await notifyRole("ADMIN", {
    type: "admin.payout_day",
    title: "Bugün öğretmen ödeme günü",
    body: `${payable.length} öğretmene toplam ${formatMoney(total)} havale edilecek. Havaleleri yapıp Finans sayfasından kaydedin.`,
    link: "/yonetim/finans",
  });
  return payable.length;
}
