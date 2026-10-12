"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { saveAttendance, type AttendanceStatusName } from "@/server/center/attendance";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { completeEtud, deleteEtud, saveEtud, setEtudStatus } from "@/server/center/etuds";
import { bool, date, guard, int, list, opt, requiredText, str, time } from "@/server/center/form";
import { deleteOrArchiveGroup, deleteSlot, saveGroup, saveSlot, setGroupActive, setGroupStudents } from "@/server/center/groups";

// Sınıflar, ders programı, yoklama ve etütler.

export async function saveGroupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  const groupId = opt(formData, "groupId");
  let createdId = "";
  const result = await guard(async () => {
    const capacity = int(formData, "capacity", 0, 0, 500);
    const group = await saveGroup(auth.ctx, groupId, {
      name: requiredText(formData, "name", "Sınıf adı", 1, 60),
      gradeName: opt(formData, "gradeName", 40),
      targetExam: opt(formData, "targetExam", 40),
      teacherId: opt(formData, "teacherId"),
      room: opt(formData, "room", 40),
      capacity: capacity || null,
    });
    createdId = group.id;
    return success("Sınıf kaydedildi.");
  });
  if (!result.ok || groupId) {
    if (result.ok) refresh();
    return result;
  }
  redirect(`/kurum/siniflar/${createdId}`);
}

export async function archiveGroupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  const groupId = str(formData, "groupId");
  if (formData.get("restore") === "1") {
    return guard(async () => {
      await setGroupActive(auth.ctx, groupId, true);
      refresh();
      return success("Sınıf yeniden etkin.");
    });
  }
  const result = await guard(async () => {
    const outcome = await deleteOrArchiveGroup(auth.ctx, groupId);
    return success(outcome);
  });
  if (!result.ok) return result;
  redirect(`/kurum/siniflar?durum=${result.message === "deleted" ? "sinif-silindi" : "sinif-arsiv"}`);
}

export async function setGroupStudentsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const count = await setGroupStudents(auth.ctx, str(formData, "groupId"), list(formData, "studentIds"));
    refresh();
    return success(`Sınıf listesi kaydedildi (${count} öğrenci).`);
  });
}

export async function saveSlotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const weekday = int(formData, "weekday", 0, 0, 7);
    if (weekday < 1) throw new CenterError("Gün seçin.", { weekday: "Gün seçin." });
    await saveSlot(auth.ctx, str(formData, "groupId"), opt(formData, "slotId"), {
      weekday,
      startMinute: time(formData, "start", "Başlangıç saati"),
      endMinute: time(formData, "end", "Bitiş saati"),
      subject: requiredText(formData, "subject", "Ders", 2, 60),
      teacherId: opt(formData, "teacherId"),
      room: opt(formData, "room", 40),
    });
    refresh();
    return success("Ders programa eklendi.");
  });
}

export async function deleteSlotAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("groups.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await deleteSlot(auth.ctx, str(formData, "slotId"));
    refresh();
    return success("Ders programdan çıkarıldı.");
  });
}

const STATUSES: AttendanceStatusName[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export async function saveAttendanceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("attendance.take");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const records = list(formData, "studentIds").map((studentId) => {
      const status = str(formData, `status:${studentId}`) as AttendanceStatusName;
      return { studentId, status: STATUSES.includes(status) ? status : "PRESENT", note: opt(formData, `note:${studentId}`, 200) };
    });
    const result = await saveAttendance(auth.ctx, {
      groupId: str(formData, "groupId"),
      date: date(formData, "date"),
      startMinute: time(formData, "start", "Başlangıç saati"),
      endMinute: time(formData, "end", "Bitiş saati"),
      subject: str(formData, "subject", 60),
      slotId: opt(formData, "slotId"),
      records,
      notify: bool(formData, "notify"),
    });
    const absent = records.filter((r) => r.status === "ABSENT").length;
    refresh();
    return success(
      `Yoklama kaydedildi: ${records.length - absent} geldi, ${absent} gelmedi.${result.notified ? ` ${result.notified} öğrencinin velisine bildirim gönderildi.` : ""}`,
    );
  });
}

function parseEtudForm(formData: FormData) {
  return {
    date: date(formData, "date"),
    startMinute: time(formData, "start", "Başlangıç saati"),
    endMinute: time(formData, "end", "Bitiş saati"),
    teacherId: opt(formData, "teacherId"),
    subject: requiredText(formData, "subject", "Ders", 2, 60),
    topic: opt(formData, "topic", 120),
    room: opt(formData, "room", 40),
    notes: opt(formData, "notes", 1000),
    studentIds: list(formData, "studentIds"),
  };
}

export async function saveEtudAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("etud.manage");
  if (!auth.ok) return auth.state;
  const etudId = opt(formData, "etudId");
  let id = "";
  const result = await guard(async () => {
    id = await saveEtud(auth.ctx, etudId, parseEtudForm(formData));
    return success("Etüt kaydedildi.");
  });
  if (!result.ok) return result;
  if (etudId) {
    refresh();
    return result;
  }
  redirect(`/kurum/etutler/${id}?durum=etut-planlandi`);
}

export async function completeEtudAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("etud.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const attendance = list(formData, "studentIds").map((studentId) => {
      const status = str(formData, `status:${studentId}`) as AttendanceStatusName;
      return { studentId, status: STATUSES.includes(status) ? status : "PRESENT" };
    });
    const notified = await completeEtud(auth.ctx, str(formData, "etudId"), attendance, opt(formData, "notes", 1000), bool(formData, "notify"));
    refresh();
    return success(`Etüt tamamlandı olarak işaretlendi.${notified ? ` ${notified} velisine devamsızlık bildirimi gönderildi.` : ""}`);
  });
}

export async function setEtudStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("etud.manage");
  if (!auth.ok) return auth.state;
  const status = str(formData, "status");
  if (status !== "PLANNED" && status !== "CANCELLED") return failure("Geçersiz durum.");
  return guard(async () => {
    await setEtudStatus(auth.ctx, str(formData, "etudId"), status);
    refresh();
    return success(status === "CANCELLED" ? "Etüt iptal edildi." : "Etüt yeniden planlandı.");
  });
}

export async function deleteEtudAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("etud.manage");
  if (!auth.ok) return auth.state;
  const etudId = str(formData, "etudId");
  const result = await guard(async () => {
    await deleteEtud(auth.ctx, etudId);
    await centerAudit(auth.ctx, "etud.delete", "CenterEtud", etudId);
    return success();
  });
  if (!result.ok) return result;
  redirect("/kurum/etutler?durum=etut-silindi");
}
