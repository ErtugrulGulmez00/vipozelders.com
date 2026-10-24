import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { notify } from "@/server/notifications";
import { toWhatsAppNumber } from "@/server/whatsapp";
import { createStudent } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("WhatsApp bildirimleri", () => {
  it("telefon numarası uluslararası biçime çevrilir", () => {
    expect(toWhatsAppNumber("0532 111 22 33")).toBe("905321112233");
    expect(toWhatsAppNumber("+90 532 111 22 33")).toBe("905321112233");
    expect(toWhatsAppNumber("12345")).toBeNull();
  });

  it("önemli bildirim WhatsApp kuyruğuna düşer; önemsiz bildirim ve tercihini kapatan kullanıcı hariç", async () => {
    const student = await createStudent();
    await db.user.update({ where: { id: student.id }, data: { phone: "05321112233" } });
    await notify({ userId: student.id, type: "booking.confirmed", title: "Dersiniz onaylandı", body: "Matematik · yarın 19:00", link: "/hesabim/derslerim/x" });
    await notify({ userId: student.id, type: "earning.released", title: "Önemsiz", body: "—" });
    const queued = await db.whatsAppMessage.findMany({ where: { userId: student.id } });
    expect(queued).toHaveLength(1);
    expect(queued[0].body).toContain("Dersiniz onaylandı");
    expect(queued[0].body).toContain("/hesabim/derslerim/x");

    await db.user.update({ where: { id: student.id }, data: { whatsappOptOut: true } });
    await notify({ userId: student.id, type: "booking.confirmed", title: "Tekrar", body: "—" });
    expect(await db.whatsAppMessage.count({ where: { userId: student.id } })).toBe(1);
  });
});
