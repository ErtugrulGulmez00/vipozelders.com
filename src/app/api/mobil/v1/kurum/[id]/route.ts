import { unlinkGuardian } from "@/server/center/portal";
import { requireRole } from "@/server/mobile/auth";
import { childDetailJson } from "@/server/mobile/center";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Öğrenci ayrıntısı: devam, etüt, yayınlanan denemeler, eksik konular, ödemeler, duyurular, program. */
export const GET = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await childDetailJson(user.id, params.id));
});

/** Öğrencinin bağlantısını bu hesaptan kaldırır (kurumdaki kayıt silinmez; yeniden davetle bağlanılır). */
export const DELETE = withUser<{ id: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  await unlinkGuardian(user.id, params.id);
  return new Response(null, { status: 204 });
});
