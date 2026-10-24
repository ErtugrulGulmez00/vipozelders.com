import { z } from "zod";
import { sendMessage } from "@/server/messages";
import { json, readBody } from "@/server/mobile/http";
import { threadJson } from "@/server/mobile/messages";
import { withUser } from "@/server/mobile/route";

/** Konuşmanın mesajları (açılınca okundu işaretlenir). */
export const GET = withUser<{ id: string }>(async ({ user, params }) => json(await threadJson(user.id, params.id)));

/** Mesaj gönderir: { body }. İletişim bilgileri gizlenir; yanıt: güncel konuşma ve masked. */
export const POST = withUser<{ id: string }>(async ({ request, user, params }) => {
  const { body } = await readBody(request, z.object({ body: z.string() }));
  const { masked } = await sendMessage(params.id, { id: user.id, role: user.role }, body);
  return json({ ...(await threadJson(user.id, params.id)), masked });
});
