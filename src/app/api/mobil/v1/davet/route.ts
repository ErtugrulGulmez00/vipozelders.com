import { db } from "@/server/db";
import { ensureReferralCode } from "@/server/discounts";
import { appUrl } from "@/server/email";
import { requireRole } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { loadSettings } from "@/server/settings";

/** Arkadaşını getir: kişisel davet kodu ve bağlantısı, kampanya koşulları, ödül kazandıran davetler. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "STUDENT");
  const [settings, code, invited, rewarded] = await Promise.all([
    loadSettings(),
    ensureReferralCode(user.id),
    db.user.count({ where: { referredById: user.id } }),
    db.user.count({ where: { referredById: user.id, referralRewardedAt: { not: null } } }),
  ]);
  const url = appUrl(`/kayit?davet=${code}`);
  return json({
    enabled: settings.referralEnabled,
    code,
    url,
    discountPercent: settings.referralDiscountPercent,
    rewardCredits: settings.referralRewardCredits,
    invited,
    rewarded,
    shareText: `${settings.siteName}'te onaylı öğretmenlerle ders ve soru çözüm. Bu bağlantıyla kayıt olursan ilk siparişinde %${settings.referralDiscountPercent} indirim kazanırsın: ${url}`,
  });
});
