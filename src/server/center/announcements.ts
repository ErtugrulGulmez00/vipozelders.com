import { normalizePhone } from "@/lib/text";
import { db } from "../db";
import type { CenterContext } from "./context";
import { CenterError } from "./errors";
import { messageGuardians } from "./messages";

// Duyurular (tüm kurum ya da bir sınıf) ve ön kayıt adayları.

export async function sendAnnouncement(ctx: CenterContext, input: { title: string; body: string; groupId: string | null; sendEmail: boolean; sendWhatsapp: boolean }) {
  if (input.groupId && !(await db.centerGroup.findFirst({ where: { id: input.groupId, centerId: ctx.center.id } }))) throw new CenterError("Sınıf bulunamadı.");
  const announcement = await db.centerAnnouncement.create({
    data: { centerId: ctx.center.id, title: input.title, body: input.body, groupId: input.groupId, sendEmail: input.sendEmail, sendWhatsapp: input.sendWhatsapp, createdById: ctx.user.id },
  });
  const students = await db.centerStudent.findMany({
    where: { centerId: ctx.center.id, status: "ACTIVE", ...(input.groupId ? { groups: { some: { groupId: input.groupId } } } : {}) },
    select: { id: true },
  });
  const totals = { students: students.length, whatsapp: 0, email: 0, app: 0 };
  for (const student of students) {
    const counts = await messageGuardians({
      centerId: ctx.center.id,
      centerName: ctx.center.name,
      studentId: student.id,
      kind: "announcement",
      messageTitle: `Duyuru: ${input.title}`,
      message: input.sendWhatsapp || input.sendEmail ? input.body.slice(0, 900) : null,
      channels: { whatsapp: input.sendWhatsapp, email: input.sendEmail },
      email: input.sendEmail ? { subject: input.title, title: input.title, lines: input.body.split(/\r?\n/).filter(Boolean) } : null,
      notification: { title: `Duyuru: ${input.title}`, body: input.body.slice(0, 200) },
    });
    totals.whatsapp += counts.whatsapp;
    totals.email += counts.email;
    totals.app += counts.app;
  }
  return { announcement, totals };
}

export async function deleteAnnouncement(ctx: CenterContext, announcementId: string) {
  const announcement = await db.centerAnnouncement.findFirst({ where: { id: announcementId, centerId: ctx.center.id } });
  if (!announcement) throw new CenterError("Duyuru bulunamadı.");
  await db.centerAnnouncement.delete({ where: { id: announcementId } });
}

export async function createLead(ctx: CenterContext, input: { studentName: string; parentName: string | null; phone: string; email: string | null; gradeName: string | null; message: string | null; source: string }) {
  const phone = normalizePhone(input.phone);
  if (!phone) throw new CenterError("Telefon 05XX XXX XX XX biçiminde olmalı.", { phone: "Geçersiz numara." });
  return db.centerLead.create({ data: { ...input, phone, centerId: ctx.center.id } });
}

export async function updateLead(ctx: CenterContext, leadId: string, input: { status: "NEW" | "CONTACTED" | "ENROLLED" | "LOST"; note: string | null }) {
  const lead = await db.centerLead.findFirst({ where: { id: leadId, centerId: ctx.center.id } });
  if (!lead) throw new CenterError("Aday bulunamadı.");
  await db.centerLead.update({ where: { id: leadId }, data: input });
}

export async function deleteLead(ctx: CenterContext, leadId: string) {
  const lead = await db.centerLead.findFirst({ where: { id: leadId, centerId: ctx.center.id } });
  if (!lead) throw new CenterError("Aday bulunamadı.");
  await db.centerLead.delete({ where: { id: leadId } });
}
