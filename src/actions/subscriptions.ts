"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { failure, success, type ActionState } from "@/lib/action-state";
import { actionUser } from "@/server/auth/current-user";
import { requestMeta } from "@/server/auth/session";
import {
  askSubscriptionQuestion,
  createSubscription,
  endSubscriptionEarly,
  saveQuestionPlan,
  startSubscriptionCheckout,
  SubscriptionError,
} from "@/server/subscriptions";

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const file = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value : null;
};

async function run(work: () => Promise<string | void>, ok: string): Promise<ActionState> {
  try {
    const message = await work();
    refresh();
    return success(message || ok);
  } catch (error) {
    if (error instanceof SubscriptionError) return failure(error.message);
    throw error;
  }
}

// Öğretmen

export async function saveQuestionPlanAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("TEACHER");
  if (!user) return failure("Oturumunuz kapanmış.");
  const [levelId, subjectId] = text(formData, "pair").split(":").map(Number);
  if (!levelId || !subjectId) return failure("Kademe ve dersi seçin.", { pair: "Seçin." });
  return run(
    async () => {
      await saveQuestionPlan(user.id, {
        levelId,
        subjectId,
        priceTl: Number(text(formData, "priceTl").replace(/\./g, "").replace(",", ".")),
        dailyLimit: Number(text(formData, "dailyLimit")),
        answerHours: Number(text(formData, "answerHours")),
        description: text(formData, "description") || null,
        isActive: formData.get("isActive") === "on",
      });
    },
    "Abonelik planınız kaydedildi.",
  );
}

// Veli / öğrenci

export async function subscribeAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Abone olmak için veli/öğrenci hesabıyla giriş yapın.");
  if (formData.get("consent") !== "on") return failure("Ön bilgilendirme formunu ve mesafeli satış sözleşmesini onaylayın.", { consent: "Onay gerekli." });
  if (formData.get("immediate") !== "on") return failure("Aboneliğin hemen başladığını ve iade olmadığını onaylayın.", { immediate: "Onay gerekli." });
  let redirectUrl: string;
  try {
    const sub = await createSubscription(user.id, text(formData, "planId"), text(formData, "couponCode") || null);
    const { ipAddress } = await requestMeta();
    redirectUrl = await startSubscriptionCheckout(sub.id, user.id, ipAddress ?? "127.0.0.1");
  } catch (error) {
    if (error instanceof SubscriptionError) return failure(error.message);
    throw error;
  }
  redirect(redirectUrl);
}

export async function askSubscriptionQuestionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("STUDENT");
  if (!user) return failure("Oturumunuz kapanmış.");
  const image = file(formData, "image");
  if (!image) return failure("Sorunun fotoğrafını ekleyin.", { image: "Fotoğraf gerekli." });
  let questionId: string;
  try {
    const question = await askSubscriptionQuestion(user.id, text(formData, "subscriptionId"), { note: text(formData, "note") || null, image });
    questionId = question.id;
  } catch (error) {
    if (error instanceof SubscriptionError) return failure(error.message);
    throw error;
  }
  redirect(`/hesabim/sorularim/${questionId}`);
}

// Yönetici

export async function adminEndSubscriptionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await actionUser("ADMIN");
  if (!user) return failure("Oturumunuz kapanmış.");
  const reason = text(formData, "reason");
  if (reason.length < 5) return failure("Veliye ve öğretmene gösterilecek kısa bir gerekçe yazın.", { reason: "Gerekçe yazın." });
  return run(() => endSubscriptionEarly(text(formData, "id"), reason, user.id), "Abonelik sonlandırıldı; kalan günlerin ücreti iade ediliyor.");
}
