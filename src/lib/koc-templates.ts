// Pi Koç hazır haftalık program şablonları. Koç kendi şablonlarını da kaydeder (CenterPlanTemplate).
// weekday: 1 = Pazartesi … 7 = Pazar

export type TemplateItem = { weekday: number; subject: string; topic: string | null; targetQuestions: number | null; note: string | null };
/** premium: hazır program kütüphanesi (ücretli Pi Koç); ücretsiz pakette ilk üç şablon ve koçun kendi şablonları */
export type PlanTemplate = { id: string; name: string; description: string; items: TemplateItem[]; premium?: boolean };

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
  // ——— Hazır program kütüphanesi (ücretli pakette) ———
  {
    id: "hazir-lgs-son",
    premium: true,
    name: "LGS · son 3 ay yoğun",
    description: "Her gün matematik ve fen; Türkçe paragraf her gün; haftada iki deneme ve yanlış analizi.",
    items: [
      ...day(1, [["Matematik", null, 35], ["Fen Bilimleri", null, 30], ["Türkçe", "Paragraf", 25]]),
      ...day(2, [["Matematik", null, 35], ["İnkılap Tarihi", null, 20], ["Türkçe", "Paragraf", 25]]),
      ...day(3, [["Deneme", "LGS denemesi", null, "Süre tutarak çöz; yanlışları konu konu not et"]]),
      ...day(4, [["Matematik", null, 35], ["Fen Bilimleri", null, 30], ["İngilizce", null, 15]]),
      ...day(5, [["Matematik", null, 35], ["Din Kültürü", null, 15], ["Türkçe", "Paragraf", 25]]),
      ...day(6, [["Deneme", "LGS denemesi", null, "Deneme sonrası yanlış analizi"]]),
      ...day(7, [["Tekrar", "Haftanın yanlışları", null, "En çok yanlış yapılan iki konuyu tekrar et"]]),
    ],
  },
  {
    id: "hazir-lgs-7",
    premium: true,
    name: "7. sınıf · LGS temeli",
    description: "Okul konularını pekiştiren hafif tempo; ayda iki deneme alışkanlığı için cumartesi mini deneme.",
    items: [
      ...day(1, [["Matematik", null, 20], ["Türkçe", "Okuma", null, "20 dakika kitap"]]),
      ...day(2, [["Fen Bilimleri", null, 20], ["İngilizce", "Kelime", null, "15 yeni kelime"]]),
      ...day(3, [["Matematik", null, 20], ["Sosyal Bilgiler", null, 10]]),
      ...day(4, [["Fen Bilimleri", null, 20], ["Türkçe", "Paragraf", 15]]),
      ...day(5, [["Matematik", null, 20], ["Din Kültürü", null, 10]]),
      ...day(6, [["Deneme", "Mini deneme", null, "Matematik ve fen bölümleri"]]),
      ...day(7, [["Tekrar", "Haftanın konuları", null]]),
    ],
  },
  {
    id: "hazir-tyt-son",
    premium: true,
    name: "TYT · son dönem (deneme ağırlıklı)",
    description: "Haftada iki TYT denemesi; ara günler zayıf konu tekrarı, her gün paragraf ve problem.",
    items: [
      ...day(1, [["Temel Matematik", "Problemler", 40], ["Türkçe", "Paragraf", 30], ["Fizik", null, 20]]),
      ...day(2, [["Deneme", "TYT denemesi", null, "Süre tutarak çöz"]]),
      ...day(3, [["Temel Matematik", null, 40], ["Türkçe", "Dil bilgisi", 25], ["Kimya", null, 20]]),
      ...day(4, [["Geometri", null, 30], ["Tarih", null, 20], ["Biyoloji", null, 20]]),
      ...day(5, [["Temel Matematik", "Problemler", 40], ["Türkçe", "Paragraf", 30], ["Coğrafya", null, 15]]),
      ...day(6, [["Deneme", "TYT denemesi", null, "Deneme sonrası yanlış analizi"]]),
      ...day(7, [["Tekrar", "Denemelerin yanlışları", null, "Yanlış defterini güncelle"]]),
    ],
  },
  {
    id: "hazir-ayt-ea",
    premium: true,
    name: "AYT Eşit ağırlık · dengeli hafta",
    description: "Matematik her gün; edebiyat, tarih ve coğrafya dönüşümlü; cumartesi TYT tekrarı, pazar deneme.",
    items: [
      ...day(1, [["Matematik", null, 40], ["Türk Dili ve Edebiyatı", null, 25]]),
      ...day(2, [["Matematik", null, 40], ["Tarih", null, 20]]),
      ...day(3, [["Matematik", null, 40], ["Coğrafya", null, 20]]),
      ...day(4, [["Matematik", null, 40], ["Türk Dili ve Edebiyatı", null, 25]]),
      ...day(5, [["Matematik", null, 40], ["Tarih", null, 20], ["Coğrafya", null, 15]]),
      ...day(6, [["Temel Matematik", "TYT tekrarı", 30], ["Türkçe", "Paragraf", 30]]),
      ...day(7, [["Deneme", "AYT denemesi", null, "Deneme sonrası analiz"]]),
    ],
  },
  {
    id: "hazir-ayt-soz",
    premium: true,
    name: "AYT Sözel · dengeli hafta",
    description: "Edebiyat ve tarih her gün; coğrafya, felsefe grubu ve din dönüşümlü; pazar deneme.",
    items: [
      ...day(1, [["Türk Dili ve Edebiyatı", null, 30], ["Tarih", null, 25]]),
      ...day(2, [["Türk Dili ve Edebiyatı", null, 30], ["Coğrafya", null, 25]]),
      ...day(3, [["Tarih", null, 30], ["Felsefe Grubu", null, 20]]),
      ...day(4, [["Türk Dili ve Edebiyatı", null, 30], ["Coğrafya", null, 25]]),
      ...day(5, [["Tarih", null, 30], ["Din Kültürü", null, 15]]),
      ...day(6, [["Türkçe", "Paragraf", 30], ["Temel Matematik", "TYT tekrarı", 25]]),
      ...day(7, [["Deneme", "AYT denemesi", null, "Deneme sonrası analiz"]]),
    ],
  },
  {
    id: "hazir-ydt",
    premium: true,
    name: "YDT · dil haftası",
    description: "Her gün kelime ve okuma; gramer, cloze ve çeviri dönüşümlü; pazar deneme.",
    items: [
      ...day(1, [["Yabancı Dil", "Kelime", null, "30 kelime"], ["Yabancı Dil", "Okuma parçası", 15]]),
      ...day(2, [["Yabancı Dil", "Gramer", 30], ["Yabancı Dil", "Kelime", null, "30 kelime"]]),
      ...day(3, [["Yabancı Dil", "Cloze test", 20], ["Yabancı Dil", "Okuma parçası", 15]]),
      ...day(4, [["Yabancı Dil", "Çeviri", 20], ["Yabancı Dil", "Kelime", null, "30 kelime"]]),
      ...day(5, [["Yabancı Dil", "Paragraf tamamlama", 20], ["Yabancı Dil", "Diyalog", 15]]),
      ...day(6, [["Türkçe", "Paragraf", 25], ["Temel Matematik", "TYT tekrarı", 20]]),
      ...day(7, [["Deneme", "YDT denemesi", null, "Deneme sonrası kelime listesi"]]),
    ],
  },
  {
    id: "hazir-okul",
    premium: true,
    name: "Okul dönemi · 9-10. sınıf",
    description: "Okul derslerine paralel kısa tekrar; yazılı haftasında ilgili derse ağırlık verin.",
    items: [
      ...day(1, [["Matematik", "Okulda işlenen konu", 20], ["Türk Dili ve Edebiyatı", null, null, "Ders notlarını tekrar"]]),
      ...day(2, [["Fizik", null, 15], ["İngilizce", "Kelime", null, "15 kelime"]]),
      ...day(3, [["Matematik", "Okulda işlenen konu", 20], ["Tarih", null, null, "Ders notlarını tekrar"]]),
      ...day(4, [["Kimya", null, 15], ["Biyoloji", null, 15]]),
      ...day(5, [["Matematik", "Okulda işlenen konu", 20], ["Coğrafya", null, null, "Ders notlarını tekrar"]]),
      ...day(6, [["Tekrar", "Haftanın konuları", null, "Eksik kalan ödevler"]]),
      ...day(7, [["Okuma", "Kitap", null, "30 dakika"]]),
    ],
  },
  {
    id: "hazir-tatil",
    premium: true,
    name: "Yarıyıl tatili · tekrar kampı",
    description: "İlk dönemin konularını kapatma haftası: her gün iki ders yoğun tekrar ve bir deneme.",
    items: [
      ...day(1, [["Matematik", "1. dönem tekrarı", 50], ["Türkçe", "Paragraf", 30]]),
      ...day(2, [["Fen Bilimleri", "1. dönem tekrarı", 40], ["Sosyal / Tarih", "1. dönem tekrarı", 25]]),
      ...day(3, [["Deneme", "Genel deneme", null, "Süre tutarak çöz"]]),
      ...day(4, [["Matematik", "1. dönem tekrarı", 50], ["İngilizce", null, 20]]),
      ...day(5, [["Fen Bilimleri", "1. dönem tekrarı", 40], ["Türkçe", "Dil bilgisi", 25]]),
      ...day(6, [["Deneme", "Genel deneme", null, "Deneme sonrası analiz"]]),
      ...day(7, [["Dinlenme", "Serbest gün", null, "Kitap okuma"]]),
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
