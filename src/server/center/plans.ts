import { EDITIONS, type CenterEditionName } from "@/lib/center/editions";
import type { SiteSettings } from "../settings";

// Kurum paneli abonelikleri iki eksende: paket (Etüt Merkezi / Dershane; açık modülleri belirler) ve öğrenci
// kapasitesi kademesi (fiyatı belirler; Etüt Merkezi paketi daha uygun fiyatlı). Fiyat ve sınırlar yönetimdeki site ayarlarından gelir.

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

/** Paketin kademe fiyatları (öğrenci sınırları iki pakette ortak). */
export function centerPlans(settings: SiteSettings, edition: CenterEditionName = "DERSHANE"): CenterPlanInfo[] {
  const etut = edition === "ETUT";
  const price = (dershane: number, etutPrice: number) => (etut ? etutPrice : dershane);
  const yearly = (dershane: number, etutPrice: number) => price(dershane, etutPrice) || null;
  return [
    { plan: "STARTER", name: `${settings.centerTier20Students} öğrenciye kadar`, priceTl: price(settings.centerTier20PriceTl, settings.centerEtut20PriceTl), yearlyPriceTl: yearly(settings.centerTier20YearlyTl, settings.centerEtut20YearlyTl), students: settings.centerTier20Students },
    { plan: "PRO", name: `${settings.centerTier100Students} öğrenciye kadar`, priceTl: price(settings.centerTier100PriceTl, settings.centerEtut100PriceTl), yearlyPriceTl: yearly(settings.centerTier100YearlyTl, settings.centerEtut100YearlyTl), students: settings.centerTier100Students, highlight: true },
    { plan: "BUSINESS", name: `${settings.centerTier200Students} öğrenciye kadar`, priceTl: price(settings.centerTier200PriceTl, settings.centerEtut200PriceTl), yearlyPriceTl: yearly(settings.centerTier200YearlyTl, settings.centerEtut200YearlyTl), students: settings.centerTier200Students },
    { plan: "ENTERPRISE", name: `Kurumsal · ${settings.centerTier200Students}+ öğrenci`, priceTl: price(settings.centerTierPlusPriceTl, settings.centerEtutPlusPriceTl), yearlyPriceTl: yearly(settings.centerTierPlusYearlyTl, settings.centerEtutPlusYearlyTl), students: null },
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
  const tier = centerPlans(settings, edition).find((p) => p.plan === plan);
  return `${EDITIONS[edition].name} · ${tier?.name ?? plan}`;
}
