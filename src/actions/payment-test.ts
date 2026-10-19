"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { failure, success, type ActionState } from "@/lib/action-state";
import { audit } from "@/server/audit";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { db } from "@/server/db";
import { appUrl } from "@/server/email";
import { garantiConfig, garantiConfigured, garantiProvider, garantiRaw, oosFormFields, type GarantiMode } from "@/server/payments/garanti";

const TEST_AMOUNT = 100; // 1,00 TL

/** Yönetim → Ödeme testi: randevuya bağlı olmayan 1 TL'lik Garanti ödemesi başlatır. */
export async function startGarantiTestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  const mode: GarantiMode = formData.get("mode") === "PROD" ? "PROD" : "TEST";
  if (mode === "PROD" && !garantiConfigured()) return failure("Canlı terminal bilgileri sunucuda tanımlı değil.");
  const admin = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { email: true } });
  const payment = await db.payment.create({ data: { provider: "garanti", amount: TEST_AMOUNT, raw: { diagnostic: true, garantiMode: mode } } });
  const { ipAddress } = await requestMeta();
  const fields = oosFormFields(garantiConfig(mode), {
    orderId: payment.id,
    amount: TEST_AMOUNT,
    email: admin.email ?? "odeme@pikampus.com",
    ipAddress: ipAddress ?? "127.0.0.1",
    returnUrl: appUrl("/api/odeme/garanti/donus"),
  });
  await db.payment.update({ where: { id: payment.id }, data: { providerToken: payment.id, raw: { diagnostic: true, garantiMode: mode, garantiForm: fields } satisfies Prisma.InputJsonValue } });
  await audit({ actorId: user.id, action: "payment.test_started", entityType: "Payment", entityId: payment.id, details: { mode } });
  redirect(`/odeme/garanti/${payment.id}`);
}

type DiagnosticRaw = ReturnType<typeof garantiRaw> & { diagnosticResult?: { status?: string; providerItemId?: string | null } };

/** Başarılı test ödemesini iade eder (gün sonundan önce iptal, sonra iade). */
export async function refundGarantiTestAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  const payment = await db.payment.findUnique({ where: { id: String(formData.get("id") ?? "") } });
  const raw = garantiRaw(payment?.raw) as DiagnosticRaw;
  if (!payment || !raw.diagnostic) return failure("Test ödemesi bulunamadı.");
  if (raw.diagnosticResult?.status !== "success") return failure("Yalnızca başarılı test ödemesi iade edilebilir.");
  const { ipAddress } = await requestMeta();
  const result = await garantiProvider.refund({ providerPaymentId: payment.id, providerItemId: raw.diagnosticResult.providerItemId ?? null, amount: payment.amount, ipAddress: ipAddress ?? "127.0.0.1", reference: payment.id });
  await db.payment.update({ where: { id: payment.id }, data: { raw: { ...(payment.raw as Prisma.JsonObject), diagnosticRefund: { ...result, at: new Date().toISOString() } } } });
  await audit({ actorId: user.id, action: "payment.test_refund", entityType: "Payment", entityId: payment.id, details: { ok: result.ok } });
  refresh();
  return result.ok ? success("İade başarılı.") : failure(result.error);
}
