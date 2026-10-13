import { centerAccess } from "@/lib/center/subscription";
import { toLocalMinutes } from "@/lib/dates";
import { db } from "../db";
import { notify, notifyRole } from "../notifications";

// Abonelik / deneme bitiş hatırlatmaları: 7, 3 ve 1 gün kala ve süre dolunca kurum sahiplerine;
// 3 gün kala ve süre dolunca Pi Kampüs yöneticilerine. Her eşik bir kez gönderilir.

const THRESHOLDS = [0, 1, 3, 7];

/** Kalan güne göre şu anki eşik (ör. 2 gün kaldıysa 3). Eşik dışındaysa null. */
export function expiryThreshold(daysLeft: number): number | null {
  return THRESHOLDS.find((t) => daysLeft <= t) ?? null;
}

export async function sendCenterExpiryNotices(now = new Date()): Promise<number> {
  const minutes = toLocalMinutes(now);
  if (minutes < 10 * 60 || minutes > 20 * 60) return 0;
  const centers = await db.center.findMany({
    where: {
      status: { in: ["TRIAL", "ACTIVE"] },
      OR: [
        { status: "TRIAL", trialEndsAt: { lte: new Date(now.getTime() + 8 * 86_400_000) } },
        { status: "ACTIVE", paidUntil: { lte: new Date(now.getTime() + 8 * 86_400_000) } },
      ],
    },
    select: { id: true, name: true, status: true, trialEndsAt: true, paidUntil: true, expiryNoticeDays: true, members: { where: { role: "OWNER", isActive: true }, select: { userId: true } } },
  });
  let sent = 0;
  for (const center of centers) {
    const access = centerAccess(center, now);
    if (access.daysLeft === null || access.daysLeft < -30) continue;
    const threshold = expiryThreshold(access.daysLeft);
    if (threshold === null) continue;
    if (center.expiryNoticeDays !== null && center.expiryNoticeDays <= threshold) continue;
    const trial = center.status === "TRIAL";
    const what = trial ? "Ücretsiz deneme süreniz" : "Aboneliğiniz";
    const title = threshold === 0 ? `${what} doldu` : `${what} ${access.daysLeft} gün sonra bitiyor`;
    const body =
      threshold === 0
        ? trial
          ? "Kayıtlarınız duruyor; panel salt okunur. Aboneliği başlatınca kaldığınız yerden devam edersiniz."
          : "Ödeme yapılmazsa 7 gün sonra panel salt okunur olacak. Kayıtlarınız silinmez."
        : "Kesintisiz kullanım için Abonelik sayfasındaki havale/EFT bilgileriyle ödemenizi yapın.";
    for (const owner of center.members) {
      await notify({ userId: owner.userId, type: "center.subscription", title, body, link: "/kurum/abonelik" });
    }
    if (threshold <= 3) {
      await notifyRole("ADMIN", {
        type: "center.subscription",
        title: threshold === 0 ? `${center.name}: süre doldu` : `${center.name}: ${access.daysLeft} gün kaldı`,
        body: `${trial ? "Deneme" : "Abonelik"} bitişi yaklaşıyor; kurumu arayıp ödeme hatırlatın.`,
        link: `/yonetim/kurumlar/${center.id}`,
        email: false,
      });
    }
    await db.center.update({ where: { id: center.id }, data: { expiryNoticeDays: threshold } });
    sent++;
  }
  return sent;
}
