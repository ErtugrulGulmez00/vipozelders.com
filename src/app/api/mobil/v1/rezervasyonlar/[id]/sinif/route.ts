import { webLoginLink } from "@/server/mobile/auth";
import { ApiError, json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { classroomAccess } from "@/server/video";

/**
 * Sanal sınıfa giriş adresi (5 dakika geçerli, tek kullanımlık). Uygulama bunu tam ekran WebView'da açar;
 * görüntü, ses, sohbet ve beyaz tahta sitedeki sınıf sayfasıyla aynıdır.
 */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  const access = await classroomAccess(params.id, user.id);
  if (!access.ok) {
    throw new ApiError(409, "CLASSROOM_CLOSED", access.reason, undefined, access.opensAt ? { opensAt: access.opensAt } : undefined);
  }
  return json({ url: await webLoginLink(user.id, `/ders/${params.id}`), opensAt: access.opensAt, closesAt: access.closesAt });
});
