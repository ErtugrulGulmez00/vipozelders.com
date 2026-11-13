import { CENTER_PACKAGE } from "@/lib/center/editions";
import type { SiteSettings } from "../settings";

// Kurum paneli aboneliği: tek paket (Etüt Merkezi), fiyatı öğrenci kapasitesi kademesi belirler. Fiyat ve sınırlar
// yönetimdeki site ayarlarından gelir.

export type CenterPlanName = "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
export const CENTER_PLANS: CenterPlanName[] = ["STARTER", "PRO", "BUSINESS", "ENTERPRISE"];

export type CenterPlanInfo = {
  plan: CenterPlanName;
  name: string;
  /** Aylık fiyat, KDV hariç TL (0 = teklif) */
  priceTl: number;
  /** Yıllık peşin fiyat, KDV hariç TL; null = gösterilmez */
  yearlyPriceTl: number | null;
  /** Aktif öğrenci sınırı; Kurumsal kademede null (200+, kuruma göre) */
  students: number | null;
  highlight?: boolean;
  /** Bir alt kademeden az farkla kat kat kapasite: "50 öğrenciye kadar paketinden 3.000 ₺ fazlasına 2 kat öğrenci" */
  upsell?: { from: string; ratio: number; diffTl: number; yearly: boolean } | null;
  /** Fiyat yerine teklif (Kurumsal kademe) */
  quote?: boolean;
};

/** Kademe fiyatları. */
export function centerPlans(settings: SiteSettings): CenterPlanInfo[] {
  const list: Omit<CenterPlanInfo, "highlight" | "upsell" | "quote">[] = [
    { plan: "STARTER", name: `${settings.centerTier20Students} öğrenciye kadar`, priceTl: settings.centerEtut20PriceTl, yearlyPriceTl: settings.centerEtut20YearlyTl || null, students: settings.centerTier20Students },
    { plan: "PRO", name: `${settings.centerTier100Students} öğrenciye kadar`, priceTl: settings.centerEtut100PriceTl, yearlyPriceTl: settings.centerEtut100YearlyTl || null, students: settings.centerTier100Students },
    { plan: "BUSINESS", name: `${settings.centerTier200Students} öğrenciye kadar`, priceTl: settings.centerEtut200PriceTl, yearlyPriceTl: settings.centerEtut200YearlyTl || null, students: settings.centerTier200Students },
    { plan: "ENTERPRISE", name: `${settings.centerTier200Students}'den fazla öğrenci`, priceTl: settings.centerEtutPlusPriceTl, yearlyPriceTl: settings.centerEtutPlusYearlyTl || null, students: null },
  ];
  // Öne çıkan: 100'lük kademe; bir alttakinden az farkla kat kat kapasite ("3.000 ₺ farkla 2 kat")
  return list.map((t, i) => {
    const prev = i > 0 ? list[i - 1] : null;
    const price = t.yearlyPriceTl ?? t.priceTl;
    const prevPrice = prev ? (prev.yearlyPriceTl ?? prev.priceTl) : 0;
    const upsell =
      prev && t.students && prev.students && price > 0 && prevPrice > 0 && t.students >= prev.students * 2 && price - prevPrice <= prevPrice * 0.15
        ? { from: prev.name, ratio: Math.round(t.students / prev.students), diffTl: price - prevPrice, yearly: Boolean(t.yearlyPriceTl) }
        : null;
    return { ...t, highlight: t.plan === "PRO", upsell, quote: t.priceTl <= 0 };
  });
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
