import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { messageGuardians, notifyCenterManagers } from "@/server/center/messages";
import { db } from "@/server/db";
import { saveSettings } from "@/server/settings";
import { createStudent } from "./helpers";

afterEach(async () => {
  await db.siteSetting.deleteMany({ where: { key: "notificationChannel" } });
});

afterAll(async () => {
  await db.$disconnect();
});

async function centerWithGuardians() {
  const id = randomUUID().slice(0, 8);
  const owner = await createStudent(`kurum${id}`);
  await db.user.update({ where: { id: owner.id }, data: { role: "CENTER" } });
  const center = await db.center.create({ data: { name: `Test Dershanesi ${id}`, slug: `test-dershane-${id}`, status: "ACTIVE" } });
  await db.centerMember.create({ data: { centerId: center.id, userId: owner.id, role: "OWNER" } });
  const student = await db.centerStudent.create({ data: { centerId: center.id, firstName: "Ali", lastName: "Koç" } });
  const withPhone = await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, fullName: "Telefonlu Veli", relation: "Anne", phone: "05321112233", email: `anne.${id}@test.local` } });
  const noPhone = await db.centerGuardian.create({ data: { centerId: center.id, studentId: student.id, fullName: "Telefonsuz Veli", relation: "Baba", email: `baba.${id}@test.local` } });
  const input = { centerId: center.id, centerName: center.name, studentId: student.id, kind: "absence", messageTitle: "Devamsızlık", message: "Ali bugün derse gelmedi." };
  return { center, owner, withPhone, noPhone, input };
}

const channelsOf = async (centerId: string) => (await db.centerMessage.findMany({ where: { centerId }, select: { channel: true, to: true } })).map((m) => `${m.channel}:${m.to}`).sort();

describe("Kurum bildirim akışları", () => {
  it("email modunda iki veliye de e-posta, WhatsApp yok", async () => {
    const { center, withPhone, noPhone, input } = await centerWithGuardians();
    const counts = await messageGuardians(input);
    expect(counts).toMatchObject({ whatsapp: 0, email: 2 });
    expect(await channelsOf(center.id)).toEqual([`EMAIL:${noPhone.email}`, `EMAIL:${withPhone.email}`].sort());
  });

  it("whatsapp modunda telefonu olana WhatsApp, olmayana e-posta", async () => {
    await saveSettings({ notificationChannel: "whatsapp" });
    const { center, withPhone, noPhone, input } = await centerWithGuardians();
    const counts = await messageGuardians(input);
    expect(counts).toMatchObject({ whatsapp: 1, email: 1 });
    expect(await channelsOf(center.id)).toEqual([`EMAIL:${noPhone.email}`, `WHATSAPP:${withPhone.phone}`].sort());
  });

  it("whatsapp modunda kurum 'e-postayla da gönder' derse telefonu olana ikisi birden", async () => {
    await saveSettings({ notificationChannel: "whatsapp" });
    const { input } = await centerWithGuardians();
    const counts = await messageGuardians({ ...input, channels: { whatsapp: true, email: true } });
    expect(counts).toMatchObject({ whatsapp: 1, email: 2 });
  });

  it("portala bağlı velinin kurum kaydında e-postası yoksa hesabının e-postasına gider", async () => {
    const { center, noPhone, input } = await centerWithGuardians();
    const parent = await createStudent(`veli${randomUUID().slice(0, 8)}`);
    await db.centerGuardian.update({ where: { id: noPhone.id }, data: { email: null, userId: parent.id } });
    const counts = await messageGuardians({ ...input, guardianIds: [noPhone.id] });
    expect(counts).toMatchObject({ whatsapp: 0, email: 1 });
    expect(await channelsOf(center.id)).toEqual([`EMAIL:${parent.email}`]);
  });

  it("kurum yöneticisine bildirim e-postayla da gider", async () => {
    const { center, owner } = await centerWithGuardians();
    await notifyCenterManagers(center.id, { type: "center.lead", title: "Yeni ön kayıt", body: "Can Aday", link: "/kurum/on-kayit" });
    expect(await db.notification.count({ where: { userId: owner.id, type: "center.lead" } })).toBe(1);
    expect(await db.emailMessage.count({ where: { userId: owner.id } })).toBe(1);
  });
});
