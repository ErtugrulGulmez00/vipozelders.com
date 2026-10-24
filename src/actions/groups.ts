"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { isDateString, timeToMinutes, zonedDateTime } from "@/lib/dates";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { cancelEnrollment, cancelGroupCourse, createGroupCourse, enrollInGroup, GroupError, inviteToGroup, startGroupCheckout } from "@/server/groups";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

async function run(work: () => Promise<string | void>, ok: string): Promise<ActionState> {
  try {
    const message = await work();
    refresh();
    return success(message || ok);
  } catch (error) {
    if (error instanceof GroupError) return failure(error.message);
    throw error;
  }
}

// Öğretmen

export async function createGroupCourseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const [levelId, subjectId] = text(formData, "pair").split(":").map(Number);
  if (!levelId || !subjectId) return failure("Kademe ve dersi seçin.", { pair: "Seçin." });
  const firstDate = text(formData, "firstDate");
  const deadlineDate = text(formData, "deadlineDate");
  const startMinute = timeToMinutes(text(formData, "startTime"));
  const deadlineMinute = timeToMinutes(text(formData, "deadlineTime") || "23:59");
  if (!isDateString(firstDate)) return failure("Başlangıç tarihini seçin.", { firstDate: "Tarih seçin." });
  if (!isDateString(deadlineDate) || deadlineMinute === null) return failure("Kayıt bitiş tarihini seçin.", { deadlineDate: "Tarih seçin." });
  if (startMinute === null) return failure("Ders saatini seçin.", { startTime: "Saat seçin." });
  const weekdays = formData.getAll("weekdays").map(Number).filter((d) => d >= 1 && d <= 7);
  let courseId: string;
  try {
    const course = await createGroupCourse(user.id, {
      levelId,
      subjectId,
      title: text(formData, "title"),
      description: text(formData, "description") || null,
      priceTl: Number(text(formData, "priceTl").replace(/\./g, "").replace(",", ".")),
      capacity: Number(text(formData, "capacity")),
      minParticipants: Number(text(formData, "minParticipants")),
      enrollDeadline: zonedDateTime(deadlineDate, deadlineMinute),
      isPublic: formData.get("isPublic") === "on",
      schedule: { firstDate, weekdays, startMinute, durationMinutes: Number(text(formData, "durationMinutes")), weeks: Number(text(formData, "weeks")) },
    });
    courseId = course.id;
  } catch (error) {
    if (error instanceof GroupError) return failure(error.message);
    throw error;
  }
  redirect(`/ogretmen-paneli/grup-dersleri/${courseId}`);
}

export async function inviteToGroupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const email = text(formData, "email");
  if (!email) return failure("Öğrencinin e-posta adresini yazın.", { email: "E-posta gerekli." });
  return run(async () => {
    const student = await inviteToGroup(user.id, text(formData, "courseId"), email);
    return `${student.firstName} ${student.lastName.charAt(0)}. davet edildi; ödeme yapınca listenize eklenir.`;
  }, "Davet gönderildi.");
}

export async function cancelGroupCourseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = text(formData, "reason");
  if (reason.length < 5) return failure("Öğrencilere gösterilecek kısa bir gerekçe yazın.", { reason: "Gerekçe yazın." });
  return run(() => cancelGroupCourse(text(formData, "courseId"), reason, { id: user.id, role: "TEACHER" }), "Ders iptal edildi; ödeme yapanlara tam iade yapılıyor.");
}

// Veli / öğrenci

export async function enrollInGroupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Kayıt olmak için veli/öğrenci hesabıyla giriş yapın.");
  if (formData.get("consent") !== "on") return failure("Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.", { consent: "Onay gerekli." });
  const learnerName = text(formData, "learnerName");
  if (!learnerName) return failure("Dersin kimin için olduğunu yazın.", { learnerName: "Ad gerekli." });
  let redirectUrl: string;
  try {
    const enrollment = await enrollInGroup(user.id, text(formData, "courseId"), learnerName);
    const { ipAddress } = await requestMeta();
    redirectUrl = await startGroupCheckout(enrollment.id, user.id, ipAddress ?? "127.0.0.1");
  } catch (error) {
    if (error instanceof GroupError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

export async function cancelEnrollmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => cancelEnrollment(user.id, text(formData, "id")), "Kaydınız iptal edildi; ödediyseniz ücretin tamamı kartınıza iade ediliyor.");
}

// Yönetici

export async function adminCancelGroupCourseAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = text(formData, "reason");
  if (reason.length < 5) return failure("Gerekçe yazın.", { reason: "Gerekçe yazın." });
  return run(() => cancelGroupCourse(text(formData, "courseId"), reason, { id: user.id, role: "ADMIN" }), "Ders iptal edildi; yapılmamış oturumların ücreti iade ediliyor.");
}
