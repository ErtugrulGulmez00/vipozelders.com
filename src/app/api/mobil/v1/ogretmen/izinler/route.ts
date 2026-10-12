import { z } from "zod";
import { requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { addAvailabilityException } from "@/server/teacher-profile";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tarih YYYY-AA-GG biçiminde olmalı."),
  // BLOCKED_DAY: bütün gün kapalı · BLOCKED: saat aralığı kapalı · EXTRA: o güne ek müsaitlik
  kind: z.enum(["BLOCKED_DAY", "BLOCKED", "EXTRA"]),
  start: z.string().optional(),
  end: z.string().optional(),
  note: z.string().max(200).optional(),
});

/** İzin veya tek seferlik ek saat ekler. */
export const POST = withUser(async ({ request, user }) => {
  requireRole(user, "TEACHER");
  const input = await readBody(request, schema);
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) if (value !== undefined) form.set(key, value);
  await addAvailabilityException(user.id, form);
  return json({ ok: true }, 201);
});
