import { requireRole } from "@/server/mobile/auth";
import { studyJson } from "@/server/mobile/center";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Haftalık çalışma programı, atanmış kaynaklarda konu ilerlemesi ve veliyle paylaşılan koç görüşmeleri: ?hafta=YYYY-AA-GG */
export const GET = withUser<{ id: string }>(async ({ request, user, params }) => {
  requireRole(user, "STUDENT");
  return json(await studyJson(user.id, params.id, new URL(request.url).searchParams.get("hafta")));
});
