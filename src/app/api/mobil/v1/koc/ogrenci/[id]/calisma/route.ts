import { z } from "zod";
import { isDateString } from "@/lib/dates";
import { addPortalStudySession } from "@/server/koc-extra";
import { json, readBody } from "@/server/mobile/http";
import { kocLink, ruleErrors } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

const schema = z.object({
  date: z.string().refine(isDateString, "Tarih YYYY-AA-GG olmalı."),
  subject: z.string().trim().max(60).nullable().optional(),
  minutes: z.number().int().min(1, "En az 1 dakika.").max(720, "En fazla 720 dakika."),
});

/** Öğrenci çalışma süresini (sayaç ya da elle) kaydeder. */
export const POST = withUser<{ id: string }>(
  async ({ request, user, params }) => {
    const input = await readBody(request, schema);
    const link = await kocLink(user.id, params.id);
    const row = await ruleErrors(() => addPortalStudySession(user.id, link.student.id, { date: input.date, subject: input.subject || null, minutes: input.minutes }));
    return json({ id: row.id }, 201);
  },
  { allowCenter: true },
);
