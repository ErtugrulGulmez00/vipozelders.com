import { EDITIONS, type CenterEditionName } from "@/lib/center/editions";
import type { SiteSettings } from "../settings";

// Kurum paneli abonelikleri iki eksende: paket (Etüt Merkezi / Dershane; açık modülleri belirler) ve öğrenci
// kapasitesi kademesi (fiyatı belirler; iki pakette aynı). Fiyat ve sınırlar yönetimdeki site ayarlarından gelir.

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
};

export function centerPlans(settings: SiteSettings): CenterPlanInfo[] {
  return [
    { plan: "STARTER", name: `${settings.centerTier20Students} öğrenciye kadar`, priceTl: settings.centerTier20PriceTl, yearlyPriceTl: settings.centerTier20YearlyTl || null, students: settings.centerTier20Students },
    { plan: "PRO", name: `${settings.centerTier100Students} öğrenciye kadar`, priceTl: settings.centerTier100PriceTl, yearlyPriceTl: settings.centerTier100YearlyTl || null, students: settings.centerTier100Students, highlight: true },
    { plan: "BUSINESS", name: `${settings.centerTier200Students} öğrenciye kadar`, priceTl: settings.centerTier200PriceTl, yearlyPriceTl: settings.centerTier200YearlyTl || null, students: settings.centerTier200Students },
    { plan: "ENTERPRISE", name: `Kurumsal · ${settings.centerTier200Students}+ öğrenci`, priceTl: settings.centerTierPlusPriceTl, yearlyPriceTl: settings.centerTierPlusYearlyTl || null, students: null },
  ];
}

/** Kademenin öğrenci sınırı (Kurumsal kademede mevcut sınır korunur, en az başlangıç sınırı). */
export function planStudentLimit(plan: CenterPlanName, settings: SiteSettings, current: number): number {
  if (plan === "STARTER") return settings.centerTier20Students;
  if (plan === "PRO") return settings.centerTier100Students;
  if (plan === "BUSINESS") return settings.centerTier200Students;
  return Math.max(current, settings.centerTierPlusStudents);
}

/** Paket ve kademe birlikte: "Dershane · 100 öğrenciye kadar" */
export function subscriptionLabel(settings: SiteSettings, edition: CenterEditionName, plan: CenterPlanName): string {
  const tier = centerPlans(settings).find((p) => p.plan === plan);
  return `${EDITIONS[edition].name} · ${tier?.name ?? plan}`;
}
