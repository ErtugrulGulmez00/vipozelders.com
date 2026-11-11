import { z } from "zod";
import { isDateString } from "@/lib/dates";
import { addPortalStudentExam, KOC_EXAM_KINDS } from "@/server/koc";
import { json, readBody } from "@/server/mobile/http";
import { kocLink, ruleErrors } from "@/server/mobile/koc";
import { withUser } from "@/server/mobile/route";

const schema = z.object({
  kind: z.enum(KOC_EXAM_KINDS as [string, ...string[]]),
  name: z.string().trim().min(2, "Deneme adını yazın.").max(80),
  date: z.string().refine(isDateString, "Tarih YYYY-AA-GG olmalı."),
  sections: z.array(z.object({ correct: z.number().int().min(0).max(200), wrong: z.number().int().min(0).max(200) })).min(1).max(12),
});

/** Öğrenci deneme sonucunu kendisi girer (bölümler sınav türündeki sırayla). */
export const POST = withUser<{ id: string }>(
  async ({ request, user, params }) => {
    const input = await readBody(request, schema);
    const link = await kocLink(user.id, params.id);
    await ruleErrors(() => addPortalStudentExam(user.id, link.student.id, input as Parameters<typeof addPortalStudentExam>[2]));
    return json({ ok: true }, 201);
  },
  { allowCenter: true },
);
