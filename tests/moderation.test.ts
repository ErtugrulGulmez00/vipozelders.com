import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { messageTeacher, offPlatformReason, sendMessage, threadsToReviewCount } from "@/server/messages";
import { isNewTeacher, searchTeachers } from "@/server/teachers";
import { createFixture, hoursAfter, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("platform dışına yönlendirme algılama", () => {
  it("şüpheli ifadeleri yakalar, normal ders konuşmasını işaretlemez", () => {
    for (const text of ["WhatsApp'tan yazalım", "numaranı verir misin", "beni ara", "ödemeyi elden yapalım", "IBAN atarım", "site dışında anlaşalım", "gmail adresim"]) {
      expect(offPlatformReason(text), text).not.toBeNull();
    }
    for (const text of ["Oğlum 8. sınıf, matematikte zorlanıyor.", "Salı ve perşembe olur mu?", "Deneme sonuçlarını paylaşabilirim.", "Telefonla ulaşamadım ama buradan yazıyorum"]) {
      expect(offPlatformReason(text), text).toBeNull();
    }
  });
});

describe("mesaj denetimi", () => {
  it("öğretmenin şüpheli mesajı işaretlenir, öğretmen uyarılır, 3 işarette yönetici bilgilendirilir", async () => {
    const fixture = await createFixture();
    const admin = await db.user.create({ data: { role: "ADMIN", username: `admin.m.${randomUUID().slice(0, 8)}`, firstName: "A", lastName: "B", passwordHash: "x" } });
    const parents = [await fixture.createStudent(), await fixture.createStudent(), await fixture.createStudent()];
    const before = await threadsToReviewCount();

    const threads = [];
    for (const [i, parent] of parents.entries()) {
      const thread = await messageTeacher(parent.id, fixture.teacher.id, "Merhaba, matematik dersi almak istiyoruz.", hoursAfter(NOW, i));
      await sendMessage(thread.id, { id: fixture.teacher.id, role: "TEACHER" }, "Tabii, WhatsApp'tan yazın, 0532 111 22 33", hoursAfter(NOW, i + 0.1));
      threads.push(thread);
    }
    const flagged = await db.directMessage.findMany({ where: { authorId: fixture.teacher.id } });
    expect(flagged).toHaveLength(3);
    expect(flagged[0].masked).toBe(true);
    expect(flagged[0].body).not.toContain("0532");
    expect(flagged[0].originalBody).toContain("0532");
    expect(flagged[0].flagReason).toMatch(/gizlendi/);
    expect(flagged[0].flagReason).toMatch(/Başka uygulama/);

    // Öğretmene saatte en fazla bir uyarı (mesajlar 1'er saat arayla)
    expect(await db.notification.count({ where: { userId: fixture.teacher.id, type: "message.warning" } })).toBe(3);
    // Üçüncü işarette yöneticiye bildirim
    expect(await db.notification.count({ where: { userId: admin.id, type: "admin.message_flags", link: `/yonetim/mesajlar?ogretmen=${fixture.teacher.id}` } })).toBe(1);
    expect(await threadsToReviewCount()).toBe(before + 3);

    // Velinin temiz mesajı işaretlenmez, incelenen konuşma listeden düşer
    await sendMessage(threads[0].id, { id: parents[0].id, role: "STUDENT" }, "Teşekkürler, buradan devam edelim.", hoursAfter(NOW, 5));
    await db.messageThread.update({ where: { id: threads[0].id }, data: { reviewedAt: hoursAfter(NOW, 6) } });
    expect(await threadsToReviewCount()).toBe(before + 2);
  });
});

describe("öğretmen arama", () => {
  it("ücretsiz tanışma süzgeci ve yeni öğretmen rozeti", async () => {
    const fixture = await createFixture();
    await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { offersIntro: true, publishedAt: new Date() } });
    const subject = await db.subject.findUniqueOrThrow({ where: { id: fixture.offering.subjectId } });
    const withIntro = await searchTeachers({ subject: subject.slug, intro: "1" });
    expect(withIntro.items.map((t) => t.userId)).toContain(fixture.teacher.id);
    expect(withIntro.items.find((t) => t.userId === fixture.teacher.id)?.isNew).toBe(true);

    await db.teacherProfile.update({ where: { userId: fixture.teacher.id }, data: { offersIntro: false } });
    expect((await searchTeachers({ subject: subject.slug, intro: "1" })).items.map((t) => t.userId)).not.toContain(fixture.teacher.id);

    const now = new Date("2030-06-01T00:00:00Z");
    expect(isNewTeacher({ publishedAt: new Date("2030-05-10T00:00:00Z"), createdAt: new Date("2030-01-01"), ratingCount: 0 }, now)).toBe(true);
    expect(isNewTeacher({ publishedAt: new Date("2030-03-01T00:00:00Z"), createdAt: new Date("2030-01-01"), ratingCount: 0 }, now)).toBe(false);
    expect(isNewTeacher({ publishedAt: new Date("2030-05-10T00:00:00Z"), createdAt: new Date("2030-01-01"), ratingCount: 5 }, now)).toBe(false);
  });
});
