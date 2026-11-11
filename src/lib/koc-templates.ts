// Pi Koç hazır haftalık program şablonları. Koç kendi şablonlarını da kaydeder (CenterPlanTemplate).
// weekday: 1 = Pazartesi … 7 = Pazar

export type TemplateItem = { weekday: number; subject: string; topic: string | null; targetQuestions: number | null; note: string | null };
export type PlanTemplate = { id: string; name: string; description: string; items: TemplateItem[] };

const day = (weekday: number, rows: [string, string | null, number | null, string?][]): TemplateItem[] =>
  rows.map(([subject, topic, targetQuestions, note]) => ({ weekday, subject, topic, targetQuestions, note: note ?? null }));

export const BUILTIN_TEMPLATES: PlanTemplate[] = [
  {
    id: "hazir-tyt",
    name: "TYT · dengeli hafta",
    description: "Her gün matematik ve paragraf, dönüşümlü fen ve sosyal; pazar deneme ve analiz.",
    items: [
      ...day(1, [["Temel Matematik", "Problemler", 40], ["Türkçe", "Paragraf", 30], ["Fizik", null, 15]]),
      ...day(2, [["Temel Matematik", null, 40], ["Türkçe", "Paragraf", 30], ["Tarih", null, 15]]),
      ...day(3, [["Geometri", null, 30], ["Türkçe", "Dil bilgisi", 25], ["Kimya", null, 15]]),
      ...day(4, [["Temel Matematik", "Problemler", 40], ["Türkçe", "Paragraf", 30], ["Coğrafya", null, 15]]),
      ...day(5, [["Temel Matematik", null, 40], ["Türkçe", "Paragraf", 30], ["Biyoloji", null, 15]]),
      ...day(6, [["Geometri", null, 30], ["Felsefe", null, 15], ["Fizik", null, 15]]),
      ...day(7, [["Deneme", "TYT denemesi", null, "Deneme sonrası yanlışları konu konu not et"]]),
    ],
  },
  {
    id: "hazir-ayt-say",
    name: "AYT Sayısal · yoğun hafta",
    description: "Matematik her gün; fizik, kimya, biyoloji dönüşümlü; cumartesi TYT tekrarı, pazar deneme.",
    items: [
      ...day(1, [["Matematik", null, 40], ["Fizik", null, 25]]),
      ...day(2, [["Matematik", null, 40], ["Kimya", null, 25]]),
      ...day(3, [["Matematik", null, 40], ["Biyoloji", null, 25]]),
      ...day(4, [["Matematik", null, 40], ["Fizik", null, 25]]),
      ...day(5, [["Matematik", null, 40], ["Kimya", null, 25]]),
      ...day(6, [["Temel Matematik", "TYT tekrar", 30], ["Türkçe", "Paragraf", 30]]),
      ...day(7, [["Deneme", "AYT denemesi", null, "Deneme sonrası analiz"]]),
    ],
  },
  {
    id: "hazir-lgs",
    name: "LGS · okul sonrası hafta",
    description: "Okul günleri kısa ve düzenli; hafta sonu deneme ve tekrar.",
    items: [
      ...day(1, [["Matematik", null, 25], ["Türkçe", "Paragraf", 20]]),
      ...day(2, [["Fen Bilimleri", null, 25], ["İngilizce", null, 10]]),
      ...day(3, [["Matematik", null, 25], ["İnkılap Tarihi", null, 15]]),
      ...day(4, [["Fen Bilimleri", null, 25], ["Türkçe", "Paragraf", 20]]),
      ...day(5, [["Matematik", null, 25], ["Din Kültürü", null, 10]]),
      ...day(6, [["Deneme", "LGS denemesi", null, "Yanlışları işaretle"]]),
      ...day(7, [["Tekrar", "Haftanın yanlışları", null]]),
    ],
  },
];

/** Şablon kalemlerini kontrol eder (kaydederken ve uygularken). */
export function cleanTemplateItems(value: unknown): TemplateItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const r = raw as Record<string, unknown>;
      const weekday = Number(r.weekday);
      const subject = String(r.subject ?? "").trim().slice(0, 60);
      if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7 || subject.length < 2) return null;
      const target = Number(r.targetQuestions);
      return {
        weekday,
        subject,
        topic: r.topic ? String(r.topic).trim().slice(0, 160) || null : null,
        targetQuestions: Number.isInteger(target) && target > 0 && target <= 2000 ? target : null,
        note: r.note ? String(r.note).trim().slice(0, 300) || null : null,
      };
    })
    .filter((x): x is TemplateItem => x !== null)
    .slice(0, 80);
}
