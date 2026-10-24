import { groupClassroomAccess } from "@/server/groups";
import { webLoginLink } from "@/server/mobile/auth";
import { ApiError, json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Grup dersi oturumunun sanal sınıf adresi (tek kullanımlık; WebView'da açılır) ya da 409 CLASSROOM_CLOSED. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  const access = await groupClassroomAccess(params.id, user.id);
  if (!access.ok) throw new ApiError(409, "CLASSROOM_CLOSED", access.reason, undefined, access.opensAt ? { opensAt: access.opensAt } : undefined);
  return json({ url: await webLoginLink(user.id, `/grup-ders/${params.id}`), opensAt: access.opensAt, closesAt: access.closesAt });
});
