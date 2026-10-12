import { z } from "zod";
import { dbDateToString, minutesToTime, toLocalDateString } from "@/lib/dates";
import { db } from "@/server/db";
import { requireRole } from "@/server/mobile/auth";
import { json, readBody } from "@/server/mobile/http";
import { withUser } from "@/server/mobile/route";
import { saveAvailability } from "@/server/teacher-profile";

async function calendarJson(teacherId: string) {
  const today = new Date(`${toLocalDateString(new Date())}T00:00:00.000Z`);
  const teacher = await db.teacherProfile.findUniqueOrThrow({
    where: { userId: teacherId },
    select: {
      bufferMinutes: true,
      availabilityRules: { orderBy: [{ weekday: "asc" }, { startMinute: "asc" }] },
      availabilityExceptions: { where: { date: { gte: today } }, orderBy: [{ date: "asc" }, { startMinute: "asc" }] },
    },
  });
  return {
    bufferMinutes: teacher.bufferMinutes,
    bufferOptions: [0, 5, 10, 15, 30],
    // weekday: 1 = Pazartesi … 7 = Pazar
    rules: teacher.availabilityRules.map((r) => ({ weekday: r.weekday, start: minutesToTime(r.startMinute), end: minutesToTime(r.endMinute) })),
    exceptions: teacher.availabilityExceptions.map((e) => ({
      id: e.id,
      date: dbDateToString(e.date),
      kind: e.type === "EXTRA" ? "EXTRA" : e.startMinute === null ? "BLOCKED_DAY" : "BLOCKED",
      start: e.startMinute === null ? null : minutesToTime(e.startMinute),
      end: e.endMinute === null ? null : minutesToTime(e.endMinute),
      note: e.note,
    })),
  };
}

/** Haftalık müsaitlik şablonu, tampon süre ve ileri tarihli izin/ek saatler. */
export const GET = withUser(async ({ user }) => {
  requireRole(user, "TEACHER");
  return json(await calendarJson(user.id));
});

const saveSchema = z.object({
  rules: z.array(z.object({ weekday: z.number().int().min(1).max(7), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })).max(50),
  bufferMinutes: z.number().int(),
});

/** Haftalık şablonu tümüyle değiştirir (web panelindeki "Takvimi kaydet" ile aynı kurallar). */
export const PUT = withUser(async ({ request, user }) => {
  requireRole(user, "TEACHER");
  const input = await readBody(request, saveSchema);
  await saveAvailability(user.id, JSON.stringify(input.rules), input.bufferMinutes);
  return json(await calendarJson(user.id));
});
