import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { LessonRequestError, submitLessonRequest } from "@/server/lesson-requests";
import { createFixture } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("öğretmen talebi", () => {
  it("talep kaydedilir, o derste ders veren öğretmene iletişim bilgisi olmadan haber gider", async () => {
    const f = await createFixture();
    const { levelId, subjectId } = f.offering;
    await db.levelSubject.create({ data: { levelId, subjectId } });
    const request = await submitLessonRequest({ name: "Ayten Kaya", phone: "0532 111 22 33", levelId, subjectId, mode: "online", preferredTimes: "Hafta içi akşam, beni 0533 999 88 77'den arayın" }, null, null);
    expect(request.phone).toBe("05321112233");
    expect(request.preferredTimes).not.toContain("0533");
    expect(request.notifiedTeachers).toBe(0); // kayıt anında; sayı sonra güncellenir
    const saved = await db.lessonRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(saved.notifiedTeachers).toBeGreaterThanOrEqual(1);
    const note = await db.notification.findFirstOrThrow({ where: { userId: f.teacher.id, type: "lesson_request" } });
    expect(note.body).not.toContain("0532");
  });

  it("geçersiz telefon reddedilir", async () => {
    await expect(submitLessonRequest({ name: "Ayten", phone: "12345", mode: "farketmez" }, null, null)).rejects.toThrow(LessonRequestError);
  });
});
