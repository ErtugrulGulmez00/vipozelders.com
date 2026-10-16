import type { SiteSettings } from "../settings";

// Kurum paneli abonelik planları. Fiyat ve öğrenci sınırları yönetimdeki site ayarlarından gelir.

export type CenterPlanName = "STARTER" | "PRO" | "ENTERPRISE";

export type CenterPlanInfo = {
  plan: CenterPlanName;
  name: string;
  /** Aylık, KDV dahil TL; null = teklif usulü */
  priceTl: number | null;
  /** İndirim öncesi aylık fiyat (üstü çizili); null = gösterilmez */
  listPriceTl: number | null;
  yearlyPriceTl: number | null;
  yearlyListPriceTl: number | null;
  /** null = sınırsız / anlaşmaya göre */
  students: number | null;
  highlight?: boolean;
  features: string[];
};

/** İki planda da tüm özellikler aynıdır; yalnızca aktif öğrenci sınırı değişir. */
const ALL_FEATURES = [
  "Öğrenci ve veli kayıtları, Excel'den aktarım",
  "Yoklama, devamsızlık bildirimi, sınıf defteri",
  "Deneme sonuçları, optik okuma, konu bazında eksik analizi",
  "Ödev, etüt, ders programı, çalışma salonu",
  "Koçluk, çalışma programı, kaynak takibi",
  "Ödeme planı, tahsilat, makbuz, gider takibi",
  "Veli ve öğrenci portalı, fotoğrafla soru",
  "Sınırsız personel hesabı",
];

export function centerPlans(settings: SiteSettings): CenterPlanInfo[] {
  return [
    {
      plan: "STARTER",
      name: "Başlangıç",
      priceTl: settings.centerStarterPriceTl,
      listPriceTl: settings.centerStarterListPriceTl || null,
      yearlyPriceTl: settings.centerStarterYearlyPriceTl || null,
      yearlyListPriceTl: settings.centerStarterYearlyListPriceTl || null,
      students: settings.centerStarterStudents,
      features: [`${settings.centerStarterStudents} aktif öğrenciye kadar`, ...ALL_FEATURES],
    },
    {
      plan: "PRO",
      name: "Profesyonel",
      priceTl: settings.centerProPriceTl,
      listPriceTl: settings.centerProListPriceTl || null,
      yearlyPriceTl: settings.centerProYearlyPriceTl || null,
      yearlyListPriceTl: settings.centerProYearlyListPriceTl || null,
      students: settings.centerProStudents,
      highlight: true,
      features: [`${settings.centerProStudents} aktif öğrenciye kadar`, ...ALL_FEATURES],
    },
    {
      plan: "ENTERPRISE",
      name: "Kurumsal",
      priceTl: null,
      listPriceTl: null,
      yearlyPriceTl: null,
      yearlyListPriceTl: null,
      students: null,
      features: ["Daha fazla öğrenci", "Birden çok şube", "Toplu veri aktarımı ve eğitim", "Öncelikli destek"],
    },
  ];
}

/** Planın öğrenci sınırı (Kurumsal planda yönetici elle belirler). */
export function planStudentLimit(plan: CenterPlanName, settings: SiteSettings, current: number): number {
  if (plan === "STARTER") return settings.centerStarterStudents;
  if (plan === "PRO") return settings.centerProStudents;
  return Math.max(current, settings.centerProStudents);
}
