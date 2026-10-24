import { lessonRequestSchema, submitLessonRequest } from "@/server/lesson-requests";
import { clientIp, optionalUser } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";

/**
 * Aradığı öğretmeni bulamayan veli için talep formu: { name, phone, email?, levelId?, subjectId?,
 * mode: "online"|"yuz-yuze"|"farketmez", cityName?, preferredTimes?, note? } → 201 { ok }. Ekip veliye döner.
 */
export const POST = publicRoute(async ({ request }) => {
  const input = await readBody(request, lessonRequestSchema);
  const viewer = await optionalUser(request);
  await submitLessonRequest(input, viewer?.role === "STUDENT" ? viewer.id : null, clientIp(request));
  return json({ ok: true, message: "Talebiniz alındı. Ekibimiz size uygun öğretmeni bulup en kısa sürede dönecek." }, 201);
});
