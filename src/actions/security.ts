"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, type ActionState } from "@/lib/action-state";
import { audit } from "@/server/audit";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta, revokeOtherSessions } from "@/server/auth/session";
import { beginTotpSetup, checkUserTotp, disableTotp, totpSetupState } from "@/server/auth/two-factor";

const code = (formData: FormData) => String(formData.get("code") ?? "").trim();

async function log(actorId: string, action: string) {
  const { ipAddress } = await requestMeta();
  await audit({ actorId, action, entityType: "User", entityId: actorId, ipAddress });
}

/** Yönetici hesabında iki adımlı doğrulama kurulumunu başlatır (QR kod gösterilir). */
export async function beginTwoFactorSetupAction(): Promise<void> {
  const user = await actionUser("ADMIN");
  if (!user) return;
  const state = await totpSetupState(user.id);
  if (!state.enabledAt) await beginTotpSetup(user.id);
  refresh();
}

export async function cancelTwoFactorSetupAction(): Promise<void> {
  const user = await actionUser("ADMIN");
  if (!user) return;
  const state = await totpSetupState(user.id);
  if (!state.enabledAt) await disableTotp(user.id);
  refresh();
}

export async function confirmTwoFactorSetupAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  if (!(await checkUserTotp(user.id, code(formData), "pending"))) {
    return failure("Kod doğrulanamadı. Uygulamadaki güncel kodu yazın; telefonunuzun saati otomatik olmalı.", { code: "Kod hatalı." });
  }
  // Açık kalmış diğer oturumlar kapatılır; bundan sonra her girişte kod istenir.
  await revokeOtherSessions(user.id);
  await log(user.id, "security.2fa_enabled");
  redirect("/yonetim/guvenlik?durum=2fa-acildi");
}

export async function disableTwoFactorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  if (!(await checkUserTotp(user.id, code(formData)))) return failure("Kod hatalı.", { code: "Uygulamadaki güncel kodu yazın." });
  await disableTotp(user.id);
  await log(user.id, "security.2fa_disabled");
  redirect("/yonetim/guvenlik?durum=2fa-kapatildi");
}
