import { z } from "zod";
import { db } from "@/server/db";
import { CENTER_EXPORT_TARGET, CENTER_PANEL_TARGET, requireRole, TEACHER_PANEL_TARGETS, webLoginLink } from "@/server/mobile/auth";
import { ApiError, json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/**
 * Web panelinin bir sayfasını uygulama içinde oturum açık açmak için tek kullanımlık bağlantı (5 dakika geçerli, WebView'da açılır):
 *  - öğretmen: { path: "/ogretmen-paneli/profil" } (TEACHER_PANEL_TARGETS)
 *  - kurum personeli: { path: "/kurum" } ya da alt sayfası (bildirim bağlantıları, ör. "/kurum/sorular/abc");
 *    Excel dışa aktarımı ("/api/kurum/disa-aktar/borclar") tarayıcıda açılıp indirilir
 * → { url }
 */
export const POST = withUser(
  async ({ request, user }) => {
    const { path } = await readBody(request, z.object({ path: z.string().trim().max(300) }));
    if (CENTER_PANEL_TARGET.test(path) || CENTER_EXPORT_TARGET.test(path)) {
      const staff = await db.centerMember.count({ where: { userId: user.id, isActive: true } });
      if (!staff) throw new ApiError(403, "FORBIDDEN", "Bu hesap bir kurumun personeli değil.");
      return json({ url: await webLoginLink(user.id, path) });
    }
    requireRole(user, "TEACHER");
    if (!TEACHER_PANEL_TARGETS.includes(path)) throw new ApiError(422, "VALIDATION", "Bu sayfa uygulamada açılamaz.", { path: "Bu sayfa uygulamada açılamaz." });
    return json({ url: await webLoginLink(user.id, path) });
  },
  { allowCenter: true },
);
