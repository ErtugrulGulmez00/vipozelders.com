"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { createLead, deleteAnnouncement, deleteLead, sendAnnouncement, updateLead } from "@/server/center/announcements";
import { centerAction, centerAudit } from "@/server/center/context";
import { bool, email, guard, opt, requiredText, str } from "@/server/center/form";

export async function sendAnnouncementAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("messages.send");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const { announcement, totals } = await sendAnnouncement(auth.ctx, {
      title: requiredText(formData, "title", "Başlık", 3, 120),
      body: requiredText(formData, "body", "Duyuru metni", 5, 2000),
      groupId: opt(formData, "groupId"),
      sendEmail: bool(formData, "sendEmail"),
      sendSms: bool(formData, "sendSms"),
    });
    await centerAudit(auth.ctx, "announcement.send", "CenterAnnouncement", announcement.id, { students: totals.students, sms: totals.sms });
    refresh();
    return success(
      `Duyuru yayınlandı (${totals.students} öğrenci). Velilere ${totals.sms} SMS, ${totals.email} e-posta ve ${totals.app} site bildirimi sıraya alındı.`,
    );
  });
}

export async function deleteAnnouncementAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("messages.send");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteAnnouncement(auth.ctx, str(formData, "announcementId"));
    refresh();
    return success("Duyuru kaldırıldı (gönderilmiş SMS/e-postalar geri alınamaz).");
  });
}

export async function createLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("leads.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await createLead(auth.ctx, {
      studentName: requiredText(formData, "studentName", "Öğrenci adı", 3, 80),
      parentName: opt(formData, "parentName", 80),
      phone: requiredText(formData, "phone", "Telefon", 10, 20),
      email: email(formData, "email"),
      gradeName: opt(formData, "gradeName", 40),
      message: opt(formData, "message", 1000),
      source: str(formData, "source", 30) || "telefon",
    });
    refresh();
    return success("Aday kaydedildi.");
  });
}

export async function updateLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("leads.manage");
  if (!auth.ok) return auth.state;
  const status = str(formData, "status");
  if (!["NEW", "CONTACTED", "ENROLLED", "LOST"].includes(status)) return failure("Durum seçin.");
  return guard(async () => {
    await updateLead(auth.ctx, str(formData, "leadId"), { status: status as "NEW" | "CONTACTED" | "ENROLLED" | "LOST", note: opt(formData, "note", 1000) });
    refresh();
    return success("Aday güncellendi.");
  });
}

export async function deleteLeadAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("leads.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteLead(auth.ctx, str(formData, "leadId"));
    refresh();
    return success("Aday silindi.");
  });
}
