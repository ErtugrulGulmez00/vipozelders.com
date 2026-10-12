import type { SiteSettings } from "../settings";

// Kurum paneli abonelik planları. Fiyat ve öğrenci sınırları yönetimdeki site ayarlarından gelir.

export type CenterPlanName = "STARTER" | "PRO" | "ENTERPRISE";

export type CenterPlanInfo = {
  plan: CenterPlanName;
  name: string;
  /** Aylık, KDV dahil TL; null = teklif usulü */
  priceTl: number | null;
  /** null = sınırsız / anlaşmaya göre */
  students: number | null;
  highlight?: boolean;
  features: string[];
};

export function centerPlans(settings: SiteSettings): CenterPlanInfo[] {
  return [
    {
      plan: "STARTER",
      name: "Başlangıç",
      priceTl: settings.centerStarterPriceTl,
      students: settings.centerStarterStudents,
      features: [
        `${settings.centerStarterStudents} aktif öğrenciye kadar`,
        "Öğrenci ve veli kayıtları, Excel'den aktarım",
        "Yoklama, devamsızlık bildirimi",
        "Deneme sonuçları ve net analizi",
        "Ödeme planı, tahsilat ve makbuz",
        "Veli portalı",
      ],
    },
    {
      plan: "PRO",
      name: "Profesyonel",
      priceTl: settings.centerProPriceTl,
      students: settings.centerProStudents,
      highlight: true,
      features: [
        `${settings.centerProStudents} aktif öğrenciye kadar`,
        "Başlangıç planındaki her şey",
        "Cevap anahtarıyla okuma ve konu bazında eksik analizi",
        "Etüt planlama, ders programı",
        "Gider takibi ve aylık gelir-gider raporu",
        "Sınırsız personel hesabı",
      ],
    },
    {
      plan: "ENTERPRISE",
      name: "Kurumsal",
      priceTl: null,
      students: null,
      features: ["Birden çok şube", "Kuruma özel SMS başlığı", "Toplu veri aktarımı ve eğitim", "Öncelikli destek"],
    },
  ];
}

/** Planın öğrenci sınırı (Kurumsal planda yönetici elle belirler). */
export function planStudentLimit(plan: CenterPlanName, settings: SiteSettings, current: number): number {
  if (plan === "STARTER") return settings.centerStarterStudents;
  if (plan === "PRO") return settings.centerProStudents;
  return Math.max(current, settings.centerProStudents);
}
