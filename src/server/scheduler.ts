import { randomUUID } from "node:crypto";
import { hostname } from "node:os";
import {
  completeFinishedLessons,
  expireOverdueApprovals,
  expireStaleHolds,
  releaseDueEarnings,
  sendLessonReminders,
} from "./bookings";
import { sendCenterExpiryNotices } from "./center/expiry";
import { sendCenterPaymentReminders } from "./center/finance";
import { processCenterMessages } from "./center/messages";
import { expireCredits, expireStalePurchases } from "./credits";
import { db } from "./db";
import { sendPendingEmails } from "./email";
import { recordError } from "./errors";
import { processPendingRefunds } from "./payments/service";
import { sendPayoutDayReminder } from "./payout-reminder";
import { pruneStats } from "./stats";
import { sendPendingPushes } from "./push";
import { expireUnansweredQuestions, releaseExpiredClaims, releasePoolEarnings } from "./question-pool";
import { processSubscriptions } from "./subscriptions";
import { processGroups } from "./groups";
import { expirePackages } from "./packages";
import { expireRescheduleRequests } from "./reschedule";

const HOLDER = `${hostname()}-${process.pid}-${randomUUID().slice(0, 8)}`;

/** Görevin aynı anda tek bir süreçte çalışması için veritabanında kısa süreli kira alır. */
async function acquireLease(name: string, ttlMs: number, now: Date): Promise<boolean> {
  const lockedUntil = new Date(now.getTime() + ttlMs);
  try {
    await db.jobLock.create({ data: { name, holder: HOLDER, lockedUntil } });
    return true;
  } catch {
    const updated = await db.jobLock.updateMany({
      where: { name, OR: [{ lockedUntil: { lt: now } }, { holder: HOLDER }] },
      data: { holder: HOLDER, lockedUntil },
    });
    return updated.count === 1;
  }
}

const TASKS = {
  expiredHolds: expireStaleHolds,
  expiredApprovals: expireOverdueApprovals,
  completedLessons: completeFinishedLessons,
  releasedEarnings: releaseDueEarnings,
  reminders: sendLessonReminders,
  // Soru havuzu ve soru kredileri
  poolClaims: releaseExpiredClaims,
  poolExpired: expireUnansweredQuestions,
  poolEarnings: releasePoolEarnings,
  creditPurchases: expireStalePurchases,
  creditExpiry: expireCredits,
  // Soru aboneliği: dönem sonu, hakediş, yenileme hatırlatması
  subscriptions: processSubscriptions,
  // Grup dersi: kayıt bitişi, oturum sonu, oturum payları, hatırlatmalar
  groups: processGroups,
  // Paket ders: süresi dolan paketin kalan dersleri iade
  packages: expirePackages,
  reschedules: expireRescheduleRequests,
  refunds: () => processPendingRefunds(),
  payoutDay: sendPayoutDayReminder,
  statsPrune: pruneStats,
  // Kurum paneli: taksit hatırlatmaları önce kuyruğa girer, aynı turda SMS ve e-postayla gönderilir.
  centerReminders: sendCenterPaymentReminders,
  centerExpiry: sendCenterExpiryNotices,
  centerMessages: () => processCenterMessages(),
  emails: () => sendPendingEmails(),
  pushes: sendPendingPushes,
} satisfies Record<string, (now: Date) => Promise<number>>;

export type SchedulerSummary = Partial<Record<keyof typeof TASKS, number | string>>;

/** Süresi dolan ödemeler/onaylar, biten dersler, hakedişler, hatırlatmalar, iadeler, kurum SMS/hatırlatmaları, e-postalar, push bildirimleri. */
export async function runScheduledTasks(now = new Date()): Promise<SchedulerSummary | null> {
  if (!(await acquireLease("scheduler", 55_000, now))) return null;
  const summary: SchedulerSummary = {};
  for (const [name, task] of Object.entries(TASKS) as [keyof typeof TASKS, (now: Date) => Promise<number>][]) {
    try {
      summary[name] = await task(now);
    } catch (error) {
      summary[name] = `hata: ${String(error).slice(0, 200)}`;
      console.error(`[zamanlayıcı] ${name}:`, error);
      await recordError({ error, source: "scheduler", routePath: `zamanlayıcı: ${name}` }, now);
    }
  }
  await db.jobLock.updateMany({ where: { name: "scheduler", holder: HOLDER }, data: { lockedUntil: new Date(0) } });
  return summary;
}

const globalScheduler = globalThis as unknown as { __vdScheduler?: ReturnType<typeof setInterval> };

/** Dakikada bir görevleri çalıştırır (Next sunucusu içinde veya `npm run worker` ile). */
export function startScheduler(intervalMs = 60_000) {
  if (globalScheduler.__vdScheduler) return;
  const tick = () => {
    runScheduledTasks().catch((error) => console.error("[zamanlayıcı]", error));
  };
  globalScheduler.__vdScheduler = setInterval(tick, intervalMs);
  setTimeout(tick, 5_000);
}
