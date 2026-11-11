import { deletePortalQuestionLog } from "@/server/koc";
import { kocLink, ruleErrors } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

/** Öğrenci yalnızca kendi girdiği soru kaydını siler. */
export const DELETE = withUser<{ id: string; logId: string }>(
  async ({ user, params }) => {
    await kocLink(user.id, params.id);
    await ruleErrors(() => deletePortalQuestionLog(user.id, params.logId));
    return new Response(null, { status: 204 });
  },
  { allowCenter: true },
);
