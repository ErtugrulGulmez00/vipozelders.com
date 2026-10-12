import { audit } from "./audit";
import { countRecentAttempts, recordLoginAttempt } from "./auth/rate-limit";
import { notifyRole } from "./notifications";

export const DELETION_REQUEST_MESSAGE =
  "Talebiniz alındı. Açık dersleriniz ve ödemeleriniz kontrol edildikten sonra hesabınız en geç 30 gün içinde silinir ve size e-postayla bilgi verilir.";

/**
 * Hesap silme talebi (KVKK ve uygulama mağazaları gereği hem web'de hem mobilde). Yöneticiye bildirim düşer;
 * açık ders, iade ve yasal saklama yükümlülükleri kontrol edilerek elle sonuçlandırılır. Günde bir talep kaydedilir.
 */
export async function requestAccountDeletion(
  user: { id: string; role: string; firstName: string; lastName: string; email: string | null; username: string | null },
  reason: string | undefined,
  context: { ipAddress: string | null; source: "web" | "mobile" },
) {
  const key = `delete-request:${user.id}`;
  if ((await countRecentAttempts(key, 24 * 3_600_000)) > 0) return;
  await recordLoginAttempt(key, null, false);
  const text = reason?.trim().slice(0, 500);
  await notifyRole("ADMIN", {
    type: "account.deletion_request",
    title: "Hesap silme talebi",
    body: `${user.firstName} ${user.lastName} (${user.email ?? user.username}) hesabının silinmesini istedi.${text ? ` Gerekçe: ${text}` : ""}`,
    link: user.role === "TEACHER" ? `/yonetim/ogretmenler/${user.id}` : `/yonetim/ogrenciler/${user.id}`,
  });
  await audit({ actorId: user.id, action: "account.deletion_requested", entityType: "User", entityId: user.id, details: { reason: text ?? null, source: context.source }, ipAddress: context.ipAddress });
}
