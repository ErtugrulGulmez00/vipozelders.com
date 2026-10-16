"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { formatMoney } from "@/lib/money";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import { createCreditPurchase, CreditError, refundCreditPurchase, startCreditCheckout } from "@/server/credits";
import { db } from "@/server/db";
import {
  answerFollowUp,
  answerPoolQuestion,
  askFollowUp,
  askPoolQuestion,
  cancelPoolQuestion,
  claimPoolQuestion,
  disputePoolAnswer,
  PoolError,
  ratePoolAnswer,
  rejectPoolQuestion,
  releasePoolClaim,
  resolvePoolDispute,
} from "@/server/question-pool";

const file = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};
const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Bilinen iş kuralı hatalarını forma mesaj olarak döndürür. */
async function run(work: () => Promise<string | void>, ok: string): Promise<ActionState> {
  try {
    const message = await work();
    refresh();
    return success(message || ok);
  } catch (error) {
    if (error instanceof PoolError || error instanceof CreditError) return failure(error.message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Öğrenci
// ---------------------------------------------------------------------------

export async function buyCreditsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Kredi almak için veli/öğrenci hesabıyla giriş yapın.");
  if (formData.get("consent") !== "on") return failure("Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.", { consent: "Onay gerekli." });
  let redirectUrl: string;
  try {
    const purchase = await createCreditPurchase(user.id, Number(formData.get("credits")));
    const { ipAddress } = await requestMeta();
    redirectUrl = await startCreditCheckout(purchase.id, user.id, ipAddress ?? "127.0.0.1");
  } catch (error) {
    if (error instanceof CreditError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

export async function askPoolQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Soru göndermek için veli/öğrenci hesabıyla giriş yapın.");
  const [levelId, subjectId] = text(formData, "pair").split(":").map(Number);
  if (!levelId || !subjectId) return failure("Kademe ve dersi seçin.", { pair: "Seçin." });
  const image = file(formData, "image");
  if (!image) return failure("Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });
  let questionId: string;
  try {
    const question = await askPoolQuestion(user.id, { levelId, subjectId, note: text(formData, "note") || null, image });
    questionId = question.id;
  } catch (error) {
    if (error instanceof PoolError || error instanceof CreditError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/sorularim/${questionId}`);
}

export async function cancelPoolQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => cancelPoolQuestion(user.id, text(formData, "id")), "Soru geri çekildi, krediniz iade edildi.");
}

export async function askFollowUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => askFollowUp(user.id, text(formData, "id"), text(formData, "body")), "Ek sorunuz öğretmene iletildi.");
}

export async function ratePoolAnswerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => ratePoolAnswer(user.id, text(formData, "id"), Number(formData.get("rating"))), "Teşekkürler, puanınız kaydedildi.");
}

export async function disputePoolAnswerAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => disputePoolAnswer(user.id, text(formData, "id"), text(formData, "reason")), "Bildiriminiz alındı; ekibimiz inceleyip size dönecek.");
}

export async function refundCreditsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(async () => {
    const amount = await refundCreditPurchase(text(formData, "id"), user.id);
    return `${formatMoney(amount)} kartınıza iade ediliyor.`;
  }, "İade başlatıldı.");
}

// ---------------------------------------------------------------------------
// Öğretmen
// ---------------------------------------------------------------------------

export async function claimPoolQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const id = text(formData, "id");
  try {
    await claimPoolQuestion(user.id, id);
  } catch (error) {
    if (error instanceof PoolError) return failure(error.message);
    throw error;
  }
  redirect(`/ogretmen-paneli/soru-havuzu/${id}`);
}

export async function releasePoolClaimAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  try {
    await releasePoolClaim(user.id, text(formData, "id"));
  } catch (error) {
    if (error instanceof PoolError) return failure(error.message);
    throw error;
  }
  redirect("/ogretmen-paneli/soru-havuzu");
}

export async function rejectPoolQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => rejectPoolQuestion(user.id, text(formData, "id"), text(formData, "reason")), "Soru geri çevrildi; öğrencinin kredisi iade edildi.");
}

export async function answerPoolQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(
    () => answerPoolQuestion(user.id, text(formData, "id"), { text: String(formData.get("body") ?? ""), image: file(formData, "image"), video: file(formData, "video") }),
    "Çözüm gönderildi; öğrenciye bildirim gitti.",
  );
}

export async function answerFollowUpAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  return run(() => answerFollowUp(user.id, text(formData, "id"), text(formData, "body")), "Cevabınız öğrenciye iletildi.");
}

export async function setAnswersPoolAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const on = formData.get("answersPool") === "on";
  await db.teacherProfile.update({ where: { userId: user.id }, data: { answersPool: on } });
  refresh();
  return success(on ? "Soru havuzuna katıldınız." : "Soru havuzundan ayrıldınız; yeni soru bildirimi almayacaksınız.");
}

// ---------------------------------------------------------------------------
// Yönetici
// ---------------------------------------------------------------------------

export async function resolvePoolDisputeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  const upheld = formData.get("decision") === "upheld";
  return run(() => resolvePoolDispute(user.id, text(formData, "id"), upheld, text(formData, "note")), upheld ? "İtiraz haklı bulundu; kredi iade edildi." : "Çözüm geçerli sayıldı.");
}
