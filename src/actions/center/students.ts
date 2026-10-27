"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { mapStudentRows } from "@/lib/center/import";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { bool, guard, list, opt, parseGuardianForm, parseStudentForm, str } from "@/server/center/form";
import { messageGuardians } from "@/server/center/messages";
import { createGuardianInvite } from "@/server/center/portal";
import { readSpreadsheet } from "@/server/center/spreadsheet";
import {
  addStudentNote,
  createStudent,
  deleteGuardian,
  deleteStudent,
  deleteStudentNote,
  importStudents,
  saveGuardian,
  setStudentStatus,
  updateStudent,
} from "@/server/center/students";

export async function createStudentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  const { ctx } = auth;
  let studentId = "";
  const result = await guard(async () => {
    const input = parseStudentForm(formData);
    const guardians = [parseGuardianForm(formData, "guardian1"), parseGuardianForm(formData, "guardian2")].filter((g) => g !== null);
    const student = await createStudent(ctx, input, guardians, list(formData, "groupIds"), opt(formData, "leadId"));
    studentId = student.id;
    await centerAudit(ctx, "student.create", "CenterStudent", student.id);
    return success();
  });
  if (!result.ok) return result;
  redirect(`/kurum/ogrenciler/${studentId}?durum=kaydedildi`);
}

export async function updateStudentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  const { ctx } = auth;
  const studentId = str(formData, "studentId");
  const result = await guard(async () => {
    const input = parseStudentForm(formData);
    const identity = bool(formData, "clearIdentity") ? { action: "clear" as const } : input.identityNumber ? { action: "set" as const, value: input.identityNumber } : { action: "keep" as const };
    await updateStudent(ctx, studentId, input, formData.has("groupsField") ? list(formData, "groupIds") : null, identity);
    await centerAudit(ctx, "student.update", "CenterStudent", studentId);
    return success();
  });
  if (!result.ok) return result;
  redirect(`/kurum/ogrenciler/${studentId}?durum=guncellendi`);
}

export async function setStudentStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  const status = str(formData, "status");
  if (status !== "ACTIVE" && status !== "PASSIVE" && status !== "LEFT") return failure("Geçersiz durum.");
  return guard(async () => {
    await setStudentStatus(auth.ctx, str(formData, "studentId"), status);
    await centerAudit(auth.ctx, "student.status", "CenterStudent", str(formData, "studentId"), { status });
    refresh();
    return success("Öğrencinin durumu güncellendi.");
  });
}

export async function deleteStudentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.delete");
  if (!auth.ok) return auth.state;
  const studentId = str(formData, "studentId");
  const result = await guard(async () => {
    await deleteStudent(auth.ctx, studentId);
    await centerAudit(auth.ctx, "student.delete", "CenterStudent", studentId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/kurum/ogrenciler?durum=silindi");
}

export async function saveGuardianAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const input = parseGuardianForm(formData);
    if (!input) throw new CenterError("Velinin adını ve en az bir iletişim bilgisini yazın.", { fullName: "Ad soyad gerekli." });
    const guardianId = opt(formData, "guardianId");
    await saveGuardian(auth.ctx, str(formData, "studentId"), guardianId, input);
    refresh();
    return success(guardianId ? "Veli bilgileri güncellendi." : "Veli eklendi.");
  });
}

export async function deleteGuardianAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteGuardian(auth.ctx, str(formData, "guardianId"));
    refresh();
    return success("Veli silindi.");
  });
}

/** Veli portalı daveti: bağlantı ekranda kalır (WhatsApp ile de paylaşılabilir), istenirse WhatsApp ile gider. */
export async function inviteGuardianAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const url = await createGuardianInvite(auth.ctx, str(formData, "guardianId"), bool(formData, "send"));
    return success(bool(formData, "send") ? "Davet gönderildi. Bağlantıyı ayrıca kopyalayıp paylaşabilirsiniz." : "Davet bağlantısı hazır.", { url });
  });
}

export async function addNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("notes.write");
  if (!auth.ok) return auth.state;
  const kind = str(formData, "kind");
  const text = str(formData, "text", 3000);
  if (text.length < 2) return failure("Notu yazın.", { text: "Not boş olamaz." });
  return guard(async () => {
    await addStudentNote(auth.ctx, str(formData, "studentId"), {
      kind: kind === "GUIDANCE" || kind === "PARENT_MEETING" || kind === "BEHAVIOR" ? kind : "GENERAL",
      text,
      visibleToParent: bool(formData, "visibleToParent"),
    });
    refresh();
    return success("Not eklendi.");
  });
}

export async function deleteNoteAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("notes.write");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteStudentNote(auth.ctx, str(formData, "noteId"));
    refresh();
    return success("Not silindi.");
  });
}

/** Öğrencinin velilerine elle mesaj (WhatsApp ve/veya e-posta). */
export async function messageStudentGuardiansAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("messages.send");
  if (!auth.ok) return auth.state;
  const text = str(formData, "text", 600);
  if (text.length < 5) return failure("Mesajı yazın.", { text: "Mesaj çok kısa." });
  const whatsapp = bool(formData, "whatsapp");
  const email = bool(formData, "email");
  if (!whatsapp && !email) return failure("WhatsApp ya da e-posta seçin.");
  const counts = await messageGuardians({
    centerId: auth.ctx.center.id,
    centerName: auth.ctx.center.name,
    studentId: str(formData, "studentId"),
    kind: "custom",
    force: true,
    channels: { whatsapp, email },
    messageTitle: "Kurumdan mesaj",
    message: text,
    email: { subject: "Kurumdan mesaj", title: "Kurumdan mesajınız var", lines: text.split(/\r?\n/).filter(Boolean) },
    notification: { title: `${auth.ctx.center.name} size mesaj gönderdi`, body: text.slice(0, 180) },
  });
  if (counts.whatsapp + counts.email + counts.app === 0) return failure("Velilerin telefon ya da e-posta bilgisi yok (ya da aylık WhatsApp sınırı doldu).");
  refresh();
  return success(`Mesaj sıraya alındı: ${counts.whatsapp} WhatsApp, ${counts.email} e-posta${counts.app ? `, ${counts.app} site bildirimi` : ""}.`);
}

export async function importStudentsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const table = await readSpreadsheet(formData.get("file") as File);
    const { students, problems, unknownHeaders } = mapStudentRows(table);
    if (!students.length) return failure(problems[0]?.message ?? "Dosyada öğrenci bulunamadı.");
    const summary = await importStudents(auth.ctx, students);
    await centerAudit(auth.ctx, "student.import", "CenterStudent", null, { created: summary.created, updated: summary.updated });
    const notes = [...problems, ...summary.skipped].sort((a, b) => a.row - b.row).slice(0, 30).map((p) => `${p.row}. satır: ${p.message}`);
    refresh();
    return success(
      `${summary.created} yeni öğrenci eklendi, ${summary.updated} öğrenci güncellendi${summary.groupsCreated ? `, ${summary.groupsCreated} yeni sınıf açıldı` : ""}.`,
      { notes: notes.join("\n"), unknown: unknownHeaders.join(", ") },
    );
  });
}
