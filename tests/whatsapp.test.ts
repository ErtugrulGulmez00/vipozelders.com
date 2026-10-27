import { afterAll, afterEach, describe, expect, it } from "vitest";
import { planChannels, type ChannelMode } from "@/lib/notification-channels";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { saveSettings } from "@/server/settings";
import { toWhatsAppNumber } from "@/server/whatsapp";
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
    await db.user.update({ where: { id: student.id }, data: { phone: "05321112233" } });
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
});
