import { z } from "zod";
import { isDateString } from "@/lib/dates";
import { addPortalQuestionLog } from "@/server/koc";
import { json, readBody } from "@/server/mobile/http";
import { kocLink, ruleErrors } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

const schema = z.object({
  date: z.string().refine(isDateString, "Tarih YYYY-AA-GG olmalı."),
  subject: z.string().trim().min(1, "Dersi yazın.").max(60),
  solved: z.number().int().min(0).max(2000),
  correct: z.number().int().min(0).max(2000),
  wrong: z.number().int().min(0).max(2000),
});

/** Öğrenci çözdüğü soruyu girer. */
export const POST = withUser<{ id: string }>(
  async ({ request, user, params }) => {
    const input = await readBody(request, schema);
    const link = await kocLink(user.id, params.id);
    const row = await ruleErrors(() => addPortalQuestionLog(user.id, link.student.id, input));
    return json({ id: row.id }, 201);
  },
  { allowCenter: true },
);
