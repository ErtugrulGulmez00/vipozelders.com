"use server";

import { refresh } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/dates";
import { actionUser } from "@/server/auth/current-user";
import { centerAction } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { generatePackageCodes, generatePromoCodes, redeemPromoCode, revokePromoCode } from "@/server/koc-promo";

/** Pi Koç sahibi deneme kodunu girer (ücretsiz pakette sınırı aşmış olsa da kullanabilir). */
export async function redeemPromoAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("subscription.view", { overLimit: true, write: false });
  if (!auth.ok) return auth.state;
  if (auth.ctx.center.kind !== "COACH") return failure("Kod yalnızca Pi Koç hesabında kullanılır.");
  try {
    const result = await redeemPromoCode(auth.ctx.user, auth.ctx.center.id, String(formData.get("code") ?? ""));
    refresh();
    return success(
      result.kind === "PACKAGE"
        ? `Paket kodunuz kabul edildi: ${result.tier} paketi (${result.students} öğrenci) ${formatDate(result.until)} tarihine kadar açık.`
        : `Kod kabul edildi: ${result.tier} paketi (${result.students} öğrenci) ${formatDate(result.until)} tarihine kadar açık.`,
    );
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
}

/** Yönetim: tek kullanımlık deneme kodları üretir. */
export async function generatePromoCodesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Yetkiniz yok.");
  const count = Number(formData.get("count")) || 1;
  const days = Number(formData.get("days")) || 30;
  const note = String(formData.get("note") ?? "").trim().slice(0, 120) || null;
  const until = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(until) ? new Date(`${until}T23:59:59+03:00`) : null;
  try {
    const codes = await generatePromoCodes(admin.id, { count, days, note, expiresAt });
    refresh();
    return success(`${codes.length} kod üretildi: ${codes.join(", ")}`);
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
}

/** Yönetim: satılan paket için tek kullanımlık paket kodu üretir (kademe + ay). */
export async function generatePackageCodesAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Yetkiniz yok.");
  const count = Number(formData.get("count")) || 1;
  const students = Number(formData.get("students")) || 0;
  const months = Number(formData.get("months")) || 1;
  const note = String(formData.get("note") ?? "").trim().slice(0, 120) || null;
  const until = String(formData.get("expiresAt") ?? "").trim();
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(until) ? new Date(`${until}T23:59:59+03:00`) : null;
  try {
    const codes = await generatePackageCodes(admin.id, { count, students, months, note, expiresAt });
    refresh();
    return success(`${codes.length} paket kodu üretildi: ${codes.join(", ")}`);
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
}

export async function revokePromoCodeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return failure("Yetkiniz yok.");
  try {
    await revokePromoCode(admin.id, String(formData.get("codeId") ?? ""));
    refresh();
    return success("Kod iptal edildi; kullanılmış deneme kodunda deneme bitti (paket kodunun ödemesi kayıtlı kalır).");
  } catch (error) {
    if (error instanceof CenterError) return failure(error.message);
    throw error;
  }
}
