"use server";

import { refresh } from "next/cache";
import { success, type ActionState } from "@/lib/action-state";
import { centerAction, centerAudit } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { email, guard, opt, str } from "@/server/center/form";
import { answerQuestion } from "@/server/center/questions";
import { createStudentAccount, removeStudentAccount, resetStudentAccountPassword } from "@/server/center/students";

const fileOf = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

export async function answerQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("questions.answer");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const mode = str(formData, "mode") === "in_person" ? "in_person" : "answer";
    await answerQuestion(auth.ctx, str(formData, "questionId"), { mode, text: opt(formData, "text", 3000), image: fileOf(formData, "image"), video: fileOf(formData, "video") });
    refresh();
    return success(mode === "in_person" ? "Öğrenciye soruyu yüz yüze anlatacağınız bildirildi." : "Çözüm gönderildi; öğrenciye ve velisine bildirim gitti.");
  });
}

export async function createStudentAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    // Bildirimler e-postayla gittiği için öğrenci hesabında e-posta zorunlu
    const address = email(formData, "email");
    if (!address) throw new CenterError("Öğrencinin e-posta adresini yazın.", { email: "E-posta gerekli." });
    const result = await createStudentAccount(auth.ctx, str(formData, "studentId"), address);
    await centerAudit(auth.ctx, "student.account_create", "CenterStudent", str(formData, "studentId"), { invited: result.kind === "invited" });
    if (result.kind === "invited") {
      refresh();
      return success(`Bu e-posta sitede kayıtlı bir hesaba ait. Öğrenciye davet gönderildi (${result.email}); kabul edince hesabı bağlanır.`);
    }
    return success("Öğrenci giriş hesabı açıldı.", { username: result.username, password: result.temporaryPassword, emailSent: true, loginPath: "/kurum-giris" });
  });
}

export async function resetStudentAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const result = await resetStudentAccountPassword(auth.ctx, str(formData, "studentId"));
    await centerAudit(auth.ctx, "student.account_reset", "CenterStudent", str(formData, "studentId"));
    return success("Yeni geçici şifre oluşturuldu.", { username: result.username, password: result.temporaryPassword, loginPath: "/kurum-giris" });
  });
}

export async function removeStudentAccountAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("students.edit");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await removeStudentAccount(auth.ctx, str(formData, "studentId"));
    await centerAudit(auth.ctx, "student.account_remove", "CenterStudent", str(formData, "studentId"));
    refresh();
    return success("Öğrenci giriş hesabı kaldırıldı.");
  });
}
