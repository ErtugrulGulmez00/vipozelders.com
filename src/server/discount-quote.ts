import { formatMoney } from "@/lib/money";
import { parsePackages } from "./credits";
import { db } from "./db";
import { DiscountError, resolveDiscount, type DiscountTarget } from "./discounts";
import { lessonPrice, splitCommission } from "./pricing";
import { loadSettings } from "./settings";

export type CouponQuoteInput = { target: DiscountTarget; code: string; ref: string; duration?: number; credits?: number };
export type CouponCheck = { ok: true; discount: number; finalPrice: number; label: string; text: string } | { ok: false; error: string };

/** Ödeme formundaki "Uygula" (web ve mobil): indirimi hesaplar, kayıt oluşturmaz; ödemede yeniden doğrulanır. */
export async function quoteDiscount(userId: string, input: CouponQuoteInput): Promise<CouponCheck> {
  if (!input.code.trim()) return { ok: false, error: "İndirim kodunu yazın." };
  const settings = await loadSettings();
  let price = 0;
  let commission = 0;
  if (input.target === "booking") {
    const offering = await db.teacherOffering.findUnique({ where: { id: input.ref }, include: { teacher: { select: { commissionRateBps: true } } } });
    if (!offering || !input.duration) return { ok: false, error: "Ders bulunamadı." };
    price = lessonPrice(offering.hourlyPrice, input.duration);
    commission = splitCommission(price, offering.teacher.commissionRateBps ?? settings.commissionRateBps).commissionAmount;
  } else if (input.target === "credits") {
    const pack = parsePackages(settings.questionPackages).find((p) => p.credits === input.credits);
    if (!pack) return { ok: false, error: "Önce paket seçin." };
    price = commission = pack.price;
  } else if (input.target === "subscription") {
    const plan = await db.questionPlan.findUnique({ where: { id: input.ref } });
    if (!plan) return { ok: false, error: "Abonelik bulunamadı." };
    price = plan.price;
    commission = splitCommission(price, settings.subscriptionCommissionBps).commissionAmount;
  } else {
    const course = await db.groupCourse.findUnique({ where: { id: input.ref } });
    if (!course) return { ok: false, error: "Ders bulunamadı." };
    price = course.price;
    commission = splitCommission(price, course.commissionRateBps).commissionAmount;
  }
  try {
    const discount = await resolveDiscount(userId, input.code, input.target, price, commission);
    return { ok: true, discount: discount.amount, finalPrice: price - discount.amount, label: discount.label ?? "İndirim", text: `${formatMoney(discount.amount)} indirim · ödenecek ${formatMoney(price - discount.amount)}` };
  } catch (error) {
    if (error instanceof DiscountError) return { ok: false, error: error.message };
    throw error;
  }
}
