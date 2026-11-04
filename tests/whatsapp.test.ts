import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { planChannels, whatsappAllowed, type ChannelMode } from "@/lib/notification-channels";
import { messageGuardians } from "@/server/center/messages";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { saveSettings } from "@/server/settings";
import { isWhatsappStopWord, stopWhatsappFor, toWhatsAppNumber } from "@/server/whatsapp";
import { createStudent } from "./helpers";

const setMode = (mode: ChannelMode) => saveSettings({ notificationChannel: mode });

afterEach(async () => {
  await db.siteSetting.deleteMany({ where: { key: "notificationChannel" } });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("Bildirim kanalı stratejisi", () => {
  const both = { email: true, whatsapp: true };
  it("email modunda yalnızca e-posta", () => {
    expect(planChannels("email", both)).toEqual({ email: true, whatsapp: false });
  });
  it("whatsapp modunda WhatsApp; ulaşılamıyorsa e-posta; istenirse ikisi", () => {
    expect(planChannels("whatsapp", both)).toEqual({ email: false, whatsapp: true });
    expect(planChannels("whatsapp", { email: true, whatsapp: false })).toEqual({ email: true, whatsapp: false });
    expect(planChannels("whatsapp", { ...both, alsoEmail: true })).toEqual({ email: true, whatsapp: true });
  });
  it("hybrid modunda ikisi birden; e-postası olmayana yalnızca WhatsApp", () => {
    expect(planChannels("hybrid", both)).toEqual({ email: true, whatsapp: true });
    expect(planChannels("hybrid", { email: false, whatsapp: true })).toEqual({ email: false, whatsapp: true });
  });
});

describe("WhatsApp bildirimleri", () => {
  it("telefon numarası uluslararası biçime çevrilir", () => {
    expect(toWhatsAppNumber("0532 111 22 33")).toBe("905321112233");
    expect(toWhatsAppNumber("+90 532 111 22 33")).toBe("905321112233");
    expect(toWhatsAppNumber("12345")).toBeNull();
  });

  it("varsayılan (email) modda bildirim WhatsApp'a değil e-postaya gider", async () => {
    const student = await createStudent();
    await db.user.update({ where: { id: student.id }, data: { phone: "05321112233" } });
    await notify({ userId: student.id, type: "booking.confirmed", title: "Dersiniz onaylandı", body: "Matematik · yarın 19:00", link: "/hesabim/derslerim/x" });
    expect(await db.whatsAppMessage.count({ where: { userId: student.id } })).toBe(0);
    expect(await db.emailMessage.count({ where: { userId: student.id } })).toBe(1);
  });

  it("whatsapp modunda önemli bildirim WhatsApp kuyruğuna düşer; önemsiz bildirim ve tercihini kapatan kullanıcı hariç", async () => {
    await setMode("whatsapp");
    const student = await createStudent();
    await db.user.update({ where: { id: student.id }, data: { phone: "05321112233", whatsappConsentAt: new Date() } });
    await notify({ userId: student.id, type: "booking.confirmed", title: "Dersiniz onaylandı", body: "Matematik · yarın 19:00", link: "/hesabim/derslerim/x", lesson: "Lise Matematik · yarın 19:00" });
    await notify({ userId: student.id, type: "earning.released", title: "Önemsiz", body: "—" });
    const queued = await db.whatsAppMessage.findMany({ where: { userId: student.id } });
    expect(queued).toHaveLength(1);
    expect(queued[0].template).toBe("ders_durumu");
    expect(queued[0].params).toEqual(["Lise Matematik · yarın 19:00", "Dersiniz onaylandı", expect.stringContaining("/hesabim/derslerim/x")]);
    // WhatsApp giden önemli bildirim e-postayla tekrar gitmez; önemsiz olan e-postayla gider
    expect(await db.emailMessage.count({ where: { userId: student.id } })).toBe(1);

    await db.user.update({ where: { id: student.id }, data: { whatsappOptOut: true } });
    await notify({ userId: student.id, type: "booking.confirmed", title: "Tekrar", body: "—" });
    expect(await db.whatsAppMessage.count({ where: { userId: student.id } })).toBe(1);
    expect(await db.emailMessage.count({ where: { userId: student.id } })).toBe(2);
  });

  it("izin vermemiş kullanıcıya WhatsApp gitmez, e-postaya düşer", async () => {
    await setMode("whatsapp");
    const student = await createStudent();
    await db.user.update({ where: { id: student.id }, data: { phone: "05321112233" } });
    await notify({ userId: student.id, type: "booking.confirmed", title: "Dersiniz onaylandı", body: "—" });
    expect(await db.whatsAppMessage.count({ where: { userId: student.id } })).toBe(0);
    expect(await db.emailMessage.count({ where: { userId: student.id } })).toBe(1);
  });

  it("kurum mesajında izin aranır: elle mesaj (force) izinsiz veliye WhatsApp'la gitmez", async () => {
    await setMode("whatsapp");
    const id = randomUUID().slice(0, 8);
    const center = await db.center.create({ data: { name: `Test Etüt ${id}`, slug: `test-etut-${id}`, status: "ACTIVE" } });
    const student = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ali", lastName: "Koç" } });
    const noConsent = await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, fullName: "Ayşe Koç", relation: "Anne", phone: "05321110001", email: `a${id}@test.local` } });
    const input = { centerId: center.id, centerName: center.name, studentId: student.id, kind: "custom", message: "Toplantı cumartesi", force: true };
    expect(noConsent.notifyWhatsapp).toBe(false);
    expect(await messageGuardians(input)).toMatchObject({ whatsapp: 0, email: 1 });
    await db.centerGuardian.update({ where: { id: noConsent.id }, data: { notifyWhatsapp: true } });
    expect(await messageGuardians(input)).toMatchObject({ whatsapp: 1, email: 0 });
  });

  it("DUR yazan numara hesapta ve veli kayıtlarında kapanır, sıradaki mesajı iptal olur", async () => {
    const id = randomUUID().slice(0, 8);
    const phone = `0532${String(Date.now()).slice(-7)}`;
    const user = await createStudent();
    await db.user.update({ where: { id: user.id }, data: { phone, whatsappConsentAt: new Date() } });
    const center = await db.center.create({ data: { name: `Test Etüt ${id}`, slug: `test-etut-${id}`, status: "ACTIVE" } });
    const student = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ali", lastName: "Koç" } });
    const guardian = await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, fullName: "Ayşe Koç", relation: "Anne", phone, notifyWhatsapp: true } });
    const queued = await db.whatsAppMessage.create({ data: { to: phone, body: "x", params: [], type: "center.custom" } });

    expect(["dur", " DUR. ", "Durdur", "stop", "iptal", "IPTAL"].every(isWhatsappStopWord)).toBe(true);
    expect(isWhatsappStopWord("derse gelemiyorum dur")).toBe(false);
    expect(await stopWhatsappFor(`9${phone}`)).toBe(2);

    const after = await db.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(whatsappAllowed(after)).toBe(false);
    expect((await db.centerGuardian.findUniqueOrThrow({ where: { id: guardian.id } })).notifyWhatsapp).toBe(false);
    expect((await db.whatsAppMessage.findUniqueOrThrow({ where: { id: queued.id } })).status).toBe("FAILED");
  });
});
