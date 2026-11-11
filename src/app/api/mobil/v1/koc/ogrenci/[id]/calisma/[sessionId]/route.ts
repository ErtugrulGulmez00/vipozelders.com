import { deleteStudySession } from "@/server/koc-extra";
import { kocLink, ruleErrors } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Öğrenci yalnızca kendi girdiği çalışma kaydını siler. */
export const DELETE = withUser<{ id: string; sessionId: string }>(
  async ({ user, params }) => {
    await kocLink(user.id, params.id);
    await ruleErrors(() => deleteStudySession({ userId: user.id }, params.sessionId));
    return new Response(null, { status: 204 });
  },
  { allowCenter: true },
);
