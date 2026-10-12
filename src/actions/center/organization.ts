"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { success, type ActionState } from "@/lib/action-state";
import type { CenterRoleName } from "@/lib/center/permissions";
import { centerAction, centerAudit, resolveCenter, selectCenterCookie } from "@/server/center/context";
import { CenterError } from "@/server/center/errors";
import { CENTERS_CACHE_TAG } from "@/server/center/public";
import { bool, email, guard, int, opt, phone, requiredText, str } from "@/server/center/form";
import { addStaff, resetStaffPassword, updateStaff } from "@/server/center/staff";
import { db } from "@/server/db";
import { deleteUpload, saveUpload, UploadError } from "@/server/storage";

const ROLES: CenterRoleName[] = ["OWNER", "MANAGER", "TEACHER", "ACCOUNTANT"];

function role(formData: FormData): CenterRoleName {
  const value = str(formData, "role") as CenterRoleName;
  if (!ROLES.includes(value)) throw new CenterError("Rol seçin.", { role: "Rol seçin." });
  return value;
}

export async function addStaffAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("staff.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const result = await addStaff(auth.ctx, {
      firstName: requiredText(formData, "firstName", "Ad", 2, 50),
      lastName: requiredText(formData, "lastName", "Soyad", 2, 50),
      email: email(formData, "email"),
      phone: phone(formData, "phone"),
      role: role(formData),
      title: opt(formData, "title", 60),
      branch: opt(formData, "branch", 60),
    });
    await centerAudit(auth.ctx, "staff.add", "CenterMember", result.member.id, { role: result.member.role });
    if (result.linkedExisting) {
      refresh();
      return success("Bu e-postayla kayıtlı hesap kuruma eklendi; kişi mevcut şifresiyle giriş yapabilir.");
    }
    return success("Personel hesabı açıldı.", { username: result.username, password: result.temporaryPassword, emailSent: Boolean(str(formData, "email")) });
  });
}

export async function updateStaffAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("staff.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    await updateStaff(auth.ctx, str(formData, "memberId"), { role: role(formData), title: opt(formData, "title", 60), branch: opt(formData, "branch", 60), isActive: bool(formData, "isActive") });
    await centerAudit(auth.ctx, "staff.update", "CenterMember", str(formData, "memberId"));
    refresh();
    return success("Personel bilgileri güncellendi.");
  });
}

export async function resetStaffPasswordAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("staff.manage");
  if (!auth.ok) return auth.state;
  return guard(async () => {
    const result = await resetStaffPassword(auth.ctx, str(formData, "memberId"));
    await centerAudit(auth.ctx, "staff.password_reset", "CenterMember", str(formData, "memberId"));
    return success("Yeni geçici şifre oluşturuldu.", { username: result.username, password: result.temporaryPassword });
  });
}

export async function updateCenterSettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const auth = await centerAction("settings.manage");
  if (!auth.ok) return auth.state;
  const { ctx } = auth;
  return guard(async () => {
    const cityId = int(formData, "cityId", 0, 0, 81) || null;
    const districtId = int(formData, "districtId", 0, 0) || null;
    if (districtId && cityId && !(await db.district.findFirst({ where: { id: districtId, cityId } }))) throw new CenterError("İlçe seçilen ile ait değil.");
    let logoKey: string | null | undefined;
    const file = formData.get("logo");
    if (file instanceof File && file.size > 0) {
      try {
        logoKey = await saveUpload(file, { visibility: "public", folder: "center-logos", maxBytes: 2 * 1024 * 1024, kinds: ["image"] });
      } catch (error) {
        if (error instanceof UploadError) throw new CenterError(error.message, { logo: error.message });
        throw error;
      }
    } else if (bool(formData, "removeLogo")) {
      logoKey = null;
    }
    const academicYear = str(formData, "academicYear", 20);
    if (academicYear && !/^\d{4}-\d{4}$/.test(academicYear)) throw new CenterError("Eğitim yılı 2026-2027 biçiminde olmalı.", { academicYear: "Örn: 2026-2027" });
    await db.center.update({
      where: { id: ctx.center.id },
      data: {
        name: requiredText(formData, "name", "Kurum adı", 3, 120),
        kind: (["ETUT", "DERSHANE", "KURS", "OTHER"] as const).find((k) => k === str(formData, "kind")) ?? ctx.center.kind,
        // Sabit hat da olabilir (0212 ...); serbest metin.
        phone: opt(formData, "phone", 30),
        email: email(formData, "email"),
        address: opt(formData, "address", 300),
        cityId,
        districtId: cityId ? districtId : null,
        taxOffice: opt(formData, "taxOffice", 80),
        taxNumber: opt(formData, "taxNumber", 20),
        description: opt(formData, "description", 3000),
        isPublic: bool(formData, "isPublic"),
        academicYear: academicYear || ctx.center.academicYear,
        notifyAbsence: bool(formData, "notifyAbsence"),
        remindPayments: bool(formData, "remindPayments"),
        reminderDaysBefore: int(formData, "reminderDaysBefore", 3, 0, 14),
        showTeacherSuggestions: bool(formData, "showTeacherSuggestions"),
        ...(logoKey !== undefined ? { logoKey } : {}),
      },
    });
    if (logoKey !== undefined && ctx.center.logoKey) await deleteUpload(ctx.center.logoKey);
    await centerAudit(ctx, "settings.update", "Center", ctx.center.id);
    updateTag(CENTERS_CACHE_TAG);
    refresh();
    return success("Kurum ayarları kaydedildi.");
  });
}

/** Birden fazla kurumda çalışan personel için kurum değiştirme. */
export async function switchCenterAction(formData: FormData) {
  const resolved = await resolveCenter();
  if (resolved.kind !== "ok") redirect("/kurum");
  const centerId = str(formData, "centerId");
  if (resolved.ctx.memberships.some((m) => m.centerId === centerId)) await selectCenterCookie(centerId);
  redirect("/kurum");
}
