"use server";

import { refresh, updateTag } from "next/cache";
import { failure, success, type ActionState } from "@/lib/action-state";
import { parseMoneyInput } from "@/lib/money";
import { actionUser } from "@/server/auth/current-user";
import { adminCreateCenter, adminRecordSubscriptionPayment, adminUpdateCenter, setCenterApplicationStatus } from "@/server/center/admin";
import { CenterError } from "@/server/center/errors";
import { CENTERS_CACHE_TAG } from "@/server/center/public";
import { email, guard, int, opt, phone, requiredText, str } from "@/server/center/form";
import type { CenterPlanName } from "@/server/center/plans";
import { createCenterUser } from "@/server/center/staff";
import { db } from "@/server/db";

// Pi Kampüs yöneticisinin kurum işlemleri.

const DENIED = failure("Bu işlem için yönetici yetkisi gerekli.");
const PLANS: CenterPlanName[] = ["STARTER", "PRO", "ENTERPRISE"];
const KINDS = ["ETUT", "DERSHANE", "KURS", "OTHER"] as const;

const plan = (formData: FormData) => PLANS.find((p) => p === str(formData, "plan")) ?? "STARTER";
const kind = (formData: FormData) => KINDS.find((k) => k === str(formData, "kind")) ?? "ETUT";

export async function createCenterAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return DENIED;
  return guard(async () => {
    const { center, owner } = await adminCreateCenter(admin.id, {
      name: requiredText(formData, "name", "Kurum adı", 3, 120),
      kind: kind(formData),
      cityId: int(formData, "cityId", 0, 0, 81) || null,
      plan: plan(formData),
      trialDays: int(formData, "trialDays", 14, 1, 90),
      phone: opt(formData, "phone", 30),
      email: email(formData, "centerEmail"),
      owner: {
        firstName: requiredText(formData, "ownerFirstName", "Yetkili adı", 2, 50),
        lastName: requiredText(formData, "ownerLastName", "Yetkili soyadı", 2, 50),
        email: email(formData, "ownerEmail"),
        phone: phone(formData, "ownerPhone", "Yetkili telefonu"),
      },
      applicationId: opt(formData, "applicationId"),
    });
    return success("Kurum açıldı.", {
      centerId: center.id,
      username: owner.username,
      password: owner.temporaryPassword,
      linkedExisting: owner.linkedExisting,
      emailSent: Boolean(str(formData, "ownerEmail")),
    });
  });
}

function optionalDate(formData: FormData, key: string): Date | null {
  const value = str(formData, key);
  if (!value) return null;
  const date = new Date(`${value}T23:59:59+03:00`);
  if (Number.isNaN(date.getTime())) throw new CenterError("Tarih geçersiz.", { [key]: "Geçersiz tarih." });
  return date;
}

export async function updateCenterAdminAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return DENIED;
  return guard(async () => {
    const status = (["TRIAL", "ACTIVE", "SUSPENDED"] as const).find((s) => s === str(formData, "status")) ?? "TRIAL";
    await adminUpdateCenter(admin.id, str(formData, "centerId"), {
      name: requiredText(formData, "name", "Kurum adı", 3, 120),
      kind: kind(formData),
      plan: plan(formData),
      status,
      studentLimit: int(formData, "studentLimit", 100, 1, 100_000),
      trialEndsAt: optionalDate(formData, "trialEndsAt"),
      paidUntil: optionalDate(formData, "paidUntil"),
    });
    updateTag(CENTERS_CACHE_TAG);
    refresh();
    return success("Kurum güncellendi.");
  });
}

export async function recordSubscriptionPaymentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return DENIED;
  return guard(async () => {
    const amount = parseMoneyInput(str(formData, "amount"));
    if (amount === null || amount <= 0) throw new CenterError("Tutar geçersiz.", { amount: "Örn: 1.490" });
    const newPlan = PLANS.find((p) => p === str(formData, "plan")) ?? null;
    const periodEnd = await adminRecordSubscriptionPayment(admin.id, str(formData, "centerId"), {
      amount,
      months: int(formData, "months", 1, 1, 36),
      method: str(formData, "method", 30) || "Havale/EFT",
      reference: opt(formData, "reference", 120),
      plan: newPlan,
    });
    updateTag(CENTERS_CACHE_TAG);
    refresh();
    return success(`Ödeme kaydedildi. Abonelik ${periodEnd.toLocaleDateString("tr-TR")} tarihine kadar geçerli.`);
  });
}

export async function addCenterOwnerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return DENIED;
  return guard(async () => {
    const center = await db.center.findUnique({ where: { id: str(formData, "centerId") } });
    if (!center) throw new CenterError("Kurum bulunamadı.");
    const result = await createCenterUser(center.id, center.name, {
      firstName: requiredText(formData, "firstName", "Ad", 2, 50),
      lastName: requiredText(formData, "lastName", "Soyad", 2, 50),
      email: email(formData, "email"),
      phone: phone(formData, "phone"),
      role: "OWNER",
      title: "Kurum sahibi",
      branch: null,
    });
    return success("Kurum sahibi eklendi.", { username: result.username, password: result.temporaryPassword, linkedExisting: result.linkedExisting });
  });
}

export async function setCenterApplicationStatusAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await actionUser("ADMIN");
  if (!admin) return DENIED;
  const status = str(formData, "status") === "REJECTED" ? "REJECTED" : "NEW";
  await setCenterApplicationStatus(admin.id, str(formData, "applicationId"), status, opt(formData, "note", 500));
  refresh();
  return success(status === "REJECTED" ? "Başvuru kapatıldı." : "Başvuru yeniden açıldı.");
}
