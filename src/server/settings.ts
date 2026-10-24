import { z } from "zod";
import { db } from "./db";

/**
 * Admin panelinden değiştirilebilen site ayarları.
 * Veritabanında anahtar-değer olarak tutulur; eksik/geçersiz alanlar varsayılana döner.
 */
export const settingsSchema = z.object({
  siteName: z.string().min(1).default("Pi Kampüs"),
  siteTagline: z.string().default("Okul öncesinden üniversite sınavına, doğru öğretmen bir tık uzağında."),
  contactEmail: z.string().default("info@pikampus.com"),
  contactPhone: z.string().default("+90 505 043 47 96"),
  // Sağ alttaki WhatsApp destek düğmesinin numarası (boşsa düğme gösterilmez)
  supportWhatsapp: z.string().default("+90 505 043 47 96"),
  companyName: z.string().default(""),
  companyAddress: z.string().default(""),
  companyTaxInfo: z.string().default(""),
  announcement: z.string().default(""),

  // Para (baz puan: 1500 = %15)
  commissionRateBps: z.number().int().min(0).max(9000).default(1500),

  // Randevu kuralları
  paymentHoldMinutes: z.number().int().min(5).max(120).default(15),
  approvalWindowHours: z.number().int().min(1).max(72).default(12),
  // Fotoğrafla soruda öğretmenin çözümü göndermesi için süre; dolarsa ücret iade edilir.
  questionAnswerHours: z.number().int().min(1).max(72).default(24),
  approvalMinHoursBeforeStart: z.number().int().min(0).max(48).default(1),
  minNoticeHours: z.number().int().min(1).max(168).default(2),
  // Aynı güne randevu: kapalıysa en erken yarına randevu alınır (öğretmen onayı için zaman kalır)
  allowSameDayBooking: z.boolean().default(false),
  maxAdvanceDays: z.number().int().min(1).max(180).default(30),
  classroomOpensMinutesBefore: z.number().int().min(0).max(60).default(10),

  // İptal ve iade
  fullRefundHours: z.number().int().min(0).max(168).default(24),
  partialRefundHours: z.number().int().min(0).max(168).default(2),
  partialRefundPercent: z.number().int().min(0).max(100).default(50),
  disputeWindowHours: z.number().int().min(1).max(336).default(48),

  // Ödeme kuruluşunun parayı bize aktarma süresi (gün). Öğretmen hakedişi bu süre dolmadan serbest kalmaz.
  settlementDays: z.number().int().min(0).max(60).default(15),
  // Öğretmenlere ödenebilir bakiyenin havale edildiği ayın günleri (ör. "1,15")
  payoutDays: z.string().default("1,15"),

  // Soru kredisi ve soru havuzu. Paketler "kredi:fiyat(TL)" virgülle; 1 kredi = 1 soru.
  questionPackages: z.string().default("1:25,10:200,20:360,50:750"),
  poolTeacherFeeTl: z.number().int().min(0).max(1000).default(8),
  poolClaimMinutes: z.number().int().min(5).max(240).default(30),
  creditValidityMonths: z.number().int().min(1).max(60).default(12),
  creditRefundDays: z.number().int().min(0).max(90).default(14),
  // Havuzdaki soruları yalnızca belgeleri onaylı öğretmenler görsün
  poolVerifiedOnly: z.boolean().default(true),

  // Öğretmenin sattığı aylık soru aboneliği
  subscriptionsEnabled: z.boolean().default(true),
  subscriptionCommissionBps: z.number().int().min(0).max(9000).default(1500),
  subscriptionDays: z.number().int().min(7).max(90).default(30),
  subscriptionMinPriceTl: z.number().int().min(1).max(100_000).default(100),
  subscriptionMaxPriceTl: z.number().int().min(1).max(100_000).default(10_000),
  // Süresinde cevaplanmayan soru bu sayıya ulaşınca yönetici uyarılır (iade yapılmaz)
  subscriptionMissLimit: z.number().int().min(1).max(50).default(3),
  // Dönem bitmeden kaç gün önce yenileme hatırlatması gider
  subscriptionReminderDays: z.number().int().min(0).max(14).default(3),

  // Grup dersi (sanal dershane): komisyon, katılımcı sınırları, kişi başı ücret aralığı
  groupsEnabled: z.boolean().default(true),
  groupCommissionBps: z.number().int().min(0).max(9000).default(2000),
  groupMinParticipants: z.number().int().min(2).max(50).default(4),
  groupMaxCapacity: z.number().int().min(2).max(50).default(10),
  groupMinPriceTl: z.number().int().min(1).max(100_000).default(100),
  groupMaxPriceTl: z.number().int().min(1).max(100_000).default(20_000),

  // Yorumlar
  reviewWindowDays: z.number().int().min(1).max(365).default(30),

  // Kurum paneli abonelik planları (aylık, KDV dahil, tam TL)
  centerTrialDays: z.number().int().min(0).max(90).default(14),
  // Kurum planları: indirimli aylık/yıllık fiyat ve üstü çizili liste fiyatı (0 = gösterilmez)
  centerStarterPriceTl: z.number().int().min(0).max(1_000_000).default(4000),
  centerStarterListPriceTl: z.number().int().min(0).max(10_000_000).default(10000),
  centerStarterYearlyPriceTl: z.number().int().min(0).max(10_000_000).default(40000),
  centerStarterYearlyListPriceTl: z.number().int().min(0).max(10_000_000).default(100000),
  centerStarterStudents: z.number().int().min(1).max(100_000).default(50),
  centerProPriceTl: z.number().int().min(0).max(1_000_000).default(7000),
  centerProListPriceTl: z.number().int().min(0).max(10_000_000).default(17500),
  centerProYearlyPriceTl: z.number().int().min(0).max(10_000_000).default(80000),
  centerProYearlyListPriceTl: z.number().int().min(0).max(10_000_000).default(200000),
  centerProStudents: z.number().int().min(1).max(100_000).default(100),
  // Havale/EFT ile abonelik ödemesi için banka bilgisi (kurumun abonelik sayfasında görünür)
  centerBankInfo: z.string().default(""),

  maintenanceMode: z.boolean().default(false),
  maintenanceMessage: z.string().default("Kısa bir bakım çalışması yapıyoruz, birazdan buradayız."),
});

export type SiteSettings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof SiteSettings;

export const DEFAULT_SETTINGS: SiteSettings = settingsSchema.parse({});

function mergeSettings(raw: Record<string, unknown>): SiteSettings {
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const [key, schema] of Object.entries(settingsSchema.shape)) {
    if (key in raw) {
      const parsed = (schema as z.ZodType).safeParse(raw[key]);
      if (parsed.success) result[key] = parsed.data;
    }
  }
  return result as SiteSettings;
}

/** Ayarları her seferinde veritabanından okur (iş kurallarında bu kullanılır). */
export async function loadSettings(): Promise<SiteSettings> {
  const rows = await db.siteSetting.findMany();
  return mergeSettings(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

export async function saveSettings(values: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await loadSettings();
  const next = settingsSchema.parse({ ...current, ...values });
  await db.$transaction(
    (Object.keys(values) as SettingKey[]).map((key) =>
      db.siteSetting.upsert({
        where: { key },
        create: { key, value: next[key] },
        update: { value: next[key] },
      }),
    ),
  );
  return next;
}
