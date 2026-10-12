import { requireRole } from "@/server/mobile/auth";
import { reportCardJson } from "@/server/mobile/center";
import { json } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";

/** Yayınlanmış bir denemenin karnesi (ders ve konu analizi, net gelişimi). */
export const GET = withUser<{ id: string; examId: string }>(async ({ user, params }) => {
  requireRole(user, "STUDENT");
  return json(await reportCardJson(user.id, params.id, params.examId));
});
