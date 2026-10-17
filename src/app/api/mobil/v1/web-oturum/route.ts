import { z } from "zod";
import { requireRole, TEACHER_PANEL_TARGETS, webLoginLink } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/**
 * Öğretmen web panelinin bir sayfasını uygulama içinde oturum açık açmak için tek kullanımlık bağlantı:
 * { path: "/ogretmen-paneli/profil" } → { url } (5 dakika geçerli, WebView'da açılır).
 */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "TEACHER");
  const { path } = await readBody(request, z.object({ path: z.enum(TEACHER_PANEL_TARGETS as [string, ...string[]], { error: "Bu sayfa uygulamada açılamaz." }) }));
  return json({ url: await webLoginLink(user.id, path) });
});
