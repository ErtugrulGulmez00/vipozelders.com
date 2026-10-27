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
  /** Bir alt kademeyi aylık ödemekle aynı paraya (yıllık) daha çok kapasite: "100 öğrenciye kadar paketinin fiyatına 5 kat" */
  upsell?: { from: string; ratio: number } | null;
};

/** Paketin kademe fiyatları (öğrenci sınırları iki pakette ortak). */
export function centerPlans(settings: SiteSettings, edition: CenterEditionName = "DERSHANE"): CenterPlanInfo[] {
  const etut = edition === "ETUT";
  const price = (dershane: number, etutPrice: number) => (etut ? etutPrice : dershane);
  const yearly = (dershane: number, etutPrice: number) => price(dershane, etutPrice) || null;
  const tiers: CenterPlanInfo[] = [
    { plan: "STARTER", name: `${settings.centerTier20Students} öğrenciye kadar`, priceTl: price(settings.centerTier20PriceTl, settings.centerEtut20PriceTl), yearlyPriceTl: yearly(settings.centerTier20YearlyTl, settings.centerEtut20YearlyTl), students: settings.centerTier20Students },
    { plan: "PRO", name: `${settings.centerTier100Students} öğrenciye kadar`, priceTl: price(settings.centerTier100PriceTl, settings.centerEtut100PriceTl), yearlyPriceTl: yearly(settings.centerTier100YearlyTl, settings.centerEtut100YearlyTl), students: settings.centerTier100Students },
    { plan: "BUSINESS", name: `${settings.centerTier200Students} öğrenciye kadar`, priceTl: price(settings.centerTier200PriceTl, settings.centerEtut200PriceTl), yearlyPriceTl: yearly(settings.centerTier200YearlyTl, settings.centerEtut200YearlyTl), students: settings.centerTier200Students },
    { plan: "ENTERPRISE", name: `Kurumsal · ${settings.centerTier200Students}+ öğrenci`, priceTl: price(settings.centerTierPlusPriceTl, settings.centerEtutPlusPriceTl), yearlyPriceTl: yearly(settings.centerTierPlusYearlyTl, settings.centerEtutPlusYearlyTl), students: null },
  ];
  const list = etut ? tiers : tiers.filter((t) => t.plan !== "STARTER");
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

/** Paket bu kademeyi satıyor mu (Dershane 100 öğrenciden başlar); satmıyorsa en yakın kademe. */
export function planForEdition(edition: CenterEditionName, plan: CenterPlanName): CenterPlanName {
  return edition === "DERSHANE" && plan === "STARTER" ? "PRO" : plan;
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
