import { CENTER_PACKAGE } from "@/lib/center/editions";
import type { SiteSettings } from "../settings";

// Kurum paneli aboneliği: tek paket (Etüt Merkezi), fiyatı öğrenci kapasitesi kademesi belirler. Fiyat ve sınırlar
// yönetimdeki site ayarlarından gelir.

export type CenterPlanName = "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
export const CENTER_PLANS: CenterPlanName[] = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

export type CenterPlanInfo = {
  plan: CenterPlanName;
  name: string;
  /** Aylık indirimli fiyat, KDV dahil TL */
  priceTl: number;
  /** Yıllık fiyat, KDV dahil TL; 0 = gösterilmez */
  yearlyPriceTl: number | null;
  /** Aktif öğrenci sınırı; Kurumsal kademede null (200+, kuruma göre) */
  students: number | null;
  highlight?: boolean;
  /** Bir alt kademeyi aylık ödemekle aynı paraya (yıllık) daha çok kapasite: "100 öğrenciye kadar paketinin fiyatına 5 kat" */
  upsell?: { from: string; ratio: number } | null;
};

/** Kademe fiyatları. */
export function centerPlans(settings: SiteSettings): CenterPlanInfo[] {
  const tiers: CenterPlanInfo[] = [
    { plan: "STARTER", name: `${settings.centerTier20Students} öğrenciye kadar`, priceTl: settings.centerEtut20PriceTl, yearlyPriceTl: settings.centerEtut20YearlyTl || null, students: settings.centerTier20Students },
    { plan: "PRO", name: `${settings.centerTier100Students} öğrenciye kadar`, priceTl: settings.centerEtut100PriceTl, yearlyPriceTl: settings.centerEtut100YearlyTl || null, students: settings.centerTier100Students },
    { plan: "BUSINESS", name: `${settings.centerTier200Students} öğrenciye kadar`, priceTl: settings.centerEtut200PriceTl, yearlyPriceTl: settings.centerEtut200YearlyTl || null, students: settings.centerTier200Students },
    { plan: "ENTERPRISE", name: `Kurumsal · ${settings.centerTier200Students}+ öğrenci`, priceTl: settings.centerEtutPlusPriceTl, yearlyPriceTl: settings.centerEtutPlusYearlyTl || null, students: null },
  ];
  const list = tiers;
  // "Aynı para": bir alt kademeyi 12 ay aylık ödemek (%1 yuvarlama payıyla; 3.749 × 12 ≈ 44.999)
  const sameMoney = (monthly: number) => Math.round(monthly * 12 * 1.01);
  // Öne çıkan kademe: yıllık fiyatı bir alttakini aylık ödemeye denk gelen ilk kademe (yoksa ilk kademenin bir üstü)
  const deal = list.findIndex((t, i) => i > 0 && t.yearlyPriceTl !== null && t.yearlyPriceTl <= sameMoney(list[i - 1].priceTl));
  const highlight = deal > 0 ? deal : Math.min(1, list.length - 1);
  return list.map((t, i) => ({
    ...t,
    highlight: i === highlight,
    upsell: i > 0 && t.yearlyPriceTl !== null && t.yearlyPriceTl <= sameMoney(list[i - 1].priceTl) && t.students && list[i - 1].students ? { from: list[i - 1].name, ratio: Math.round(t.students / list[i - 1].students!) } : null,
  }));
}

/** Kademenin öğrenci sınırı (Kurumsal kademede mevcut sınır korunur, en az başlangıç sınırı). */
export function planStudentLimit(plan: CenterPlanName, settings: SiteSettings, current: number): number {
  if (plan === "STARTER") return settings.centerTier20Students;
  if (plan === "PRO") return settings.centerTier100Students;
  if (plan === "BUSINESS") return settings.centerTier200Students;
  return Math.max(current, settings.centerTierPlusStudents);
}

/** Paket ve kademe birlikte: "Etüt Merkezi · 100 öğrenciye kadar" */
export function subscriptionLabel(settings: SiteSettings, plan: CenterPlanName): string {
  const tier = centerPlans(settings).find((p) => p.plan === plan);
  return `${CENTER_PACKAGE.name} · ${tier?.name ?? plan}`;
}
