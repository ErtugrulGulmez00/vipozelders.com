// Deneme sınavı kuralları: hazır şablonlar, net hesabı, cevap anahtarıyla okuma, konu analizi ve sıralama.

export type ExamKindName = "LGS" | "TYT" | "AYT_SAY" | "AYT_EA" | "AYT_SOZ" | "YDT" | "CUSTOM";

export type SectionPreset = { name: string; questionCount: number; subjectSlug: string | null };

export type ExamPreset = {
  label: string;
  /** Yanlış başına götürülen doğru: LGS'de 3 yanlış 1 doğruyu, YKS'de 4 yanlış 1 doğruyu götürür. */
  wrongPenalty: number;
  /** Eksik konular için yönlendirilecek pazaryeri kademesi */
  levelSlug: string | null;
  sections: SectionPreset[];
};

export const EXAM_PRESETS: Record<ExamKindName, ExamPreset> = {
  LGS: {
    label: "LGS",
    wrongPenalty: 1 / 3,
    levelSlug: "lgs",
    sections: [
      { name: "Türkçe", questionCount: 20, subjectSlug: "turkce" },
      { name: "T.C. İnkılap Tarihi ve Atatürkçülük", questionCount: 10, subjectSlug: "inkilap-tarihi" },
      { name: "Din Kültürü ve Ahlak Bilgisi", questionCount: 10, subjectSlug: "din-kulturu" },
      { name: "Yabancı Dil", questionCount: 10, subjectSlug: "ingilizce" },
      { name: "Matematik", questionCount: 20, subjectSlug: "matematik" },
      { name: "Fen Bilimleri", questionCount: 20, subjectSlug: "fen-bilimleri" },
    ],
  },
  TYT: {
    label: "TYT",
    wrongPenalty: 0.25,
    levelSlug: "yks",
    sections: [
      { name: "Türkçe", questionCount: 40, subjectSlug: "turkce" },
      { name: "Sosyal Bilimler", questionCount: 20, subjectSlug: null },
      { name: "Temel Matematik", questionCount: 40, subjectSlug: "matematik" },
      { name: "Fen Bilimleri", questionCount: 20, subjectSlug: null },
    ],
  },
  AYT_SAY: {
    label: "AYT Sayısal",
    wrongPenalty: 0.25,
    levelSlug: "yks",
    sections: [
      { name: "Matematik", questionCount: 40, subjectSlug: "matematik" },
      { name: "Fizik", questionCount: 14, subjectSlug: "fizik" },
      { name: "Kimya", questionCount: 13, subjectSlug: "kimya" },
      { name: "Biyoloji", questionCount: 13, subjectSlug: "biyoloji" },
    ],
  },
  AYT_EA: {
    label: "AYT Eşit Ağırlık",
    wrongPenalty: 0.25,
    levelSlug: "yks",
    sections: [
      { name: "Matematik", questionCount: 40, subjectSlug: "matematik" },
      { name: "Türk Dili ve Edebiyatı", questionCount: 24, subjectSlug: "edebiyat" },
      { name: "Tarih-1", questionCount: 10, subjectSlug: "tarih" },
      { name: "Coğrafya-1", questionCount: 6, subjectSlug: "cografya" },
    ],
  },
  AYT_SOZ: {
    label: "AYT Sözel",
    wrongPenalty: 0.25,
    levelSlug: "yks",
    sections: [
      { name: "Türk Dili ve Edebiyatı", questionCount: 24, subjectSlug: "edebiyat" },
      { name: "Tarih-1", questionCount: 10, subjectSlug: "tarih" },
      { name: "Coğrafya-1", questionCount: 6, subjectSlug: "cografya" },
      { name: "Tarih-2", questionCount: 11, subjectSlug: "tarih" },
      { name: "Coğrafya-2", questionCount: 11, subjectSlug: "cografya" },
      { name: "Felsefe Grubu", questionCount: 12, subjectSlug: "felsefe" },
      { name: "Din Kültürü ve Ahlak Bilgisi", questionCount: 6, subjectSlug: null },
    ],
  },
  YDT: {
    label: "YDT",
    wrongPenalty: 0.25,
    levelSlug: "yks",
    sections: [{ name: "Yabancı Dil", questionCount: 80, subjectSlug: "ingilizce" }],
  },
  CUSTOM: { label: "Serbest deneme / yazılı", wrongPenalty: 0, levelSlug: null, sections: [] },
};

export const PENALTY_OPTIONS: { value: string; label: string; penalty: number }[] = [
  { value: "0", label: "Yanlış doğruyu götürmez", penalty: 0 },
  { value: "3", label: "3 yanlış 1 doğruyu götürür (LGS)", penalty: 1 / 3 },
  { value: "4", label: "4 yanlış 1 doğruyu götürür (YKS)", penalty: 0.25 },
];

export function penaltyLabel(penalty: number): string {
  if (penalty === 0) return "Yanlış doğruyu götürmez";
  return `${Math.round(1 / penalty)} yanlış 1 doğruyu götürür`;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeNet(correct: number, wrong: number, penalty: number): number {
  return round2(correct - wrong * penalty);
}

export class AnswerFormatError extends Error {}

const BLANK_MARKS = new Set(["-", ".", "_", "*", "0", "#"]);

/**
 * Öğrencinin ya da anahtarın cevaplarını sadeleştirir: büyük harf, boşluk/virgül ayırıcıları atılır,
 * boş soru "-" olur. Anahtarda iptal edilen soru "X" ile yazılır.
 */
export function normalizeAnswers(input: string, options: { allowCancelled?: boolean } = {}): string {
  let result = "";
  for (const raw of input.toUpperCase().replace(/[\s,;|]+/g, "")) {
    if ("ABCDE".includes(raw)) result += raw;
    else if (BLANK_MARKS.has(raw)) result += "-";
    else if (raw === "X" && options.allowCancelled) result += "X";
    else throw new AnswerFormatError(`“${raw}” geçerli bir cevap değil (A-E${options.allowCancelled ? ", iptal için X" : ""}, boş için -).`);
  }
  return result;
}

export type QuestionOutcome = "C" | "W" | "B";

/** Cevap anahtarına göre okuma. İptal edilen (X) soru herkese doğru sayılır. */
export function gradeAnswers(key: string, answers: string): { correct: number; wrong: number; blank: number; outcomes: QuestionOutcome[] } {
  if (answers.length > key.length) throw new AnswerFormatError(`${key.length} soru var ama ${answers.length} cevap yazılmış.`);
  const outcomes: QuestionOutcome[] = [];
  for (let i = 0; i < key.length; i++) {
    const answer = answers[i] ?? "-";
    if (key[i] === "X") outcomes.push("C");
    else if (answer === "-") outcomes.push("B");
    else outcomes.push(answer === key[i] ? "C" : "W");
  }
  return {
    correct: outcomes.filter((o) => o === "C").length,
    wrong: outcomes.filter((o) => o === "W").length,
    blank: outcomes.filter((o) => o === "B").length,
    outcomes,
  };
}

/**
 * Konu dağılımı metnini soru başına konu listesine çevirir. Her satır:
 * "1-3: Üslü sayılar", "4 Kareköklü ifadeler", "5, 7, 9: Olasılık".
 */
export function parseTopics(text: string, questionCount: number): { topics: string[]; errors: string[] } {
  const topics: string[] = Array.from({ length: questionCount }, () => "");
  const errors: string[] = [];
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = /^(\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*)\s*(?:[:)]\s*|\s+)(\S.*)$/.exec(line);
    if (!match) {
      errors.push(`${index + 1}. satır anlaşılamadı: “${line}”`);
      continue;
    }
    const topic = match[2].trim().slice(0, 120);
    for (const piece of match[1].split(",").map((p) => p.trim()).filter(Boolean)) {
      const range = /^(\d+)\s*[-–]\s*(\d+)$/.exec(piece);
      const from = Number(range ? range[1] : piece);
      const to = Number(range ? range[2] : piece);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to > questionCount || from > to) {
        errors.push(`${index + 1}. satır: “${piece}” soru aralığı 1-${questionCount} dışında.`);
        continue;
      }
      for (let q = from; q <= to; q++) topics[q - 1] = topic;
    }
  }
  return { topics, errors };
}

/** Soru başına konu listesini düzenlenebilir metne çevirir (ardışık aynı konular aralık olur). */
export function topicsToText(topics: string[]): string {
  const lines: string[] = [];
  let start = 0;
  for (let i = 1; i <= topics.length; i++) {
    if (i === topics.length || topics[i] !== topics[start]) {
      if (topics[start]) lines.push(`${start + 1 === i ? start + 1 : `${start + 1}-${i}`}: ${topics[start]}`);
      start = i;
    }
  }
  return lines.join("\n");
}

export type TopicStat = { topic: string; questions: number; correct: number; wrong: number; blank: number; rate: number };

/** Konu bazında başarı: bir öğrenci için tek, sınıf için birden çok cevap dizisi verilir. En zayıf konu başta. */
export function topicBreakdown(topics: string[], outcomeSets: QuestionOutcome[][]): TopicStat[] {
  const stats = new Map<string, TopicStat>();
  topics.forEach((topic, i) => {
    if (!topic) return;
    const stat = stats.get(topic) ?? { topic, questions: 0, correct: 0, wrong: 0, blank: 0, rate: 0 };
    stat.questions += 1;
    for (const outcomes of outcomeSets) {
      const o = outcomes[i];
      if (o === "C") stat.correct += 1;
      else if (o === "W") stat.wrong += 1;
      else stat.blank += 1;
    }
    stats.set(topic, stat);
  });
  const total = Math.max(outcomeSets.length, 1);
  return [...stats.values()]
    .map((s) => ({ ...s, rate: s.questions ? s.correct / (s.questions * total) : 0 }))
    .sort((a, b) => a.rate - b.rate || b.questions - a.questions);
}

/** Büyükten küçüğe sıralama numarası; eşit netler aynı sırayı paylaşır (1, 2, 2, 4). */
export function competitionRanks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => b - a);
  return values.map((v) => sorted.findIndex((s) => s === v) + 1);
}

/** Netin soru sayısına oranı (0-1), grafik ve renklendirme için. */
export function successRate(net: number, questionCount: number): number {
  return questionCount > 0 ? Math.max(0, Math.min(1, net / questionCount)) : 0;
}

export function formatNet(net: number): string {
  return net.toLocaleString("tr-TR", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
