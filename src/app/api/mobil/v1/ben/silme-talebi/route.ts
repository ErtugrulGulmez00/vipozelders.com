import { z } from "zod";
import { audit } from "@/server/audit";
import { countRecentAttempts, recordLoginAttempt } from "@/server/auth/rate-limit";
import { clientIp } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { notifyRole } from "@/server/notifications";

/**
 * Hesap silme talebi (App Store ve Google Play zorunluluğu). Yöneticiye bildirim düşer;
 * açık ders, iade ve yasal saklama yükümlülükleri kontrol edilerek elle sonuçlandırılır.
 */
export const POST = withUser(
  async ({ request, user }) => {
    const { reason } = await readBody(request, z.object({ reason: z.string().trim().max(500).optional() }));
    const key = `delete-request:${user.id}`;
    if ((await countRecentAttempts(key, 24 * 3_600_000)) === 0) {
      await recordLoginAttempt(key, null, false);
      await notifyRole("ADMIN", {
        type: "account.deletion_request",
        title: "Hesap silme talebi",
        body: `${user.firstName} ${user.lastName} (${user.email ?? user.username}) hesabının silinmesini istedi.${reason ? ` Gerekçe: ${reason}` : ""}`,
        link: user.role === "TEACHER" ? `/yonetim/ogretmenler/${user.id}` : `/yonetim/ogrenciler/${user.id}`,
      });
      await audit({ actorId: user.id, action: "account.deletion_requested", entityType: "User", entityId: user.id, details: { reason: reason ?? null, source: "mobile" }, ipAddress: clientIp(request) });
    }
    return json({ message: "Talebiniz alındı. Açık dersleriniz ve ödemeleriniz kontrol edildikten sonra hesabınız en geç 30 gün içinde silinir ve size e-postayla bilgi verilir." }, 202);
  },
  { allowPasswordChange: true },
);
