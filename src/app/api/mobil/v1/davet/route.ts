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
  const [settings, code, invited] = await Promise.all([
    loadSettings(),
    ensureReferralCode(user.id),
    db.user.count({ where: { referredById: user.id } }),
  ]);
  const url = appUrl(`/kayit?davet=${code}`);
  return json({
    enabled: settings.referralEnabled,
    code,
    url,
    discountPercent: settings.referralDiscountPercent,
    rewardCredits: 0,
    invited,
    rewarded: 0,
    shareText: `${settings.siteName}'te onaylı öğretmenlerle ders. Bu bağlantıyla kayıt olursan ilk siparişinde %${settings.referralDiscountPercent} indirim kazanırsın: ${url}`,
  });
});
