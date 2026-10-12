import { requireRole } from "@/server/mobile/auth";
import { childDetailJson } from "@/server/mobile/center";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğrenci ayrıntısı: devam, etüt, yayınlanan denemeler, eksik konular, ödemeler, duyurular, program. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await childDetailJson(user.id, params.id));
});
