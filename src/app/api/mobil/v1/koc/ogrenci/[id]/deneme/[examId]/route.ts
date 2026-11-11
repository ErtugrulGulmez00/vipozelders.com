import { deletePortalStudentExam } from "@/server/koc";
import { kocLink, ruleErrors } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Öğrenci yalnızca kendi girdiği denemeyi siler. */
export const DELETE = withUser<{ id: string; examId: string }>(
  async ({ user, params }) => {
    await kocLink(user.id, params.id);
    await ruleErrors(() => deletePortalStudentExam(user.id, params.examId));
    return new Response(null, { status: 204 });
  },
  { allowCenter: true },
);
