import type { PdfExam } from "./exam-pdf";
import { competitionRanks, gradeAnswers, round2, topicBreakdown } from "./exams";

// PDF'ten okunan bir öğrencinin anlık karnesi: sisteme kayıtlı olmasa da eşleştirme ekranında gösterilir.

export type CardSection = { name: string; questions: number; correct: number; wrong: number; blank: number; net: number; avgNet: number };
export type CardTopic = { section: string; topic: string; questions: number; wrong: number; blank: number };
export type StudentCard = {
  totalNet: number;
  avgTotalNet: number;
  /** Bu PDF'teki öğrenciler arasında toplam nete göre sıra */
  rank: number;
  of: number;
  score: number | null;
  ranks: { label: string; rank: number; of: number | null }[];
  sections: CardSection[];
  /** Cevap anahtarı ve kazanım varsa yanlış ya da boş bırakılan tüm konular, en çok kaçırılan önce */
  weakTopics: CardTopic[];
};

export function buildStudentCards(exam: PdfExam): StudentCard[] {
  const totals = exam.students.map((st) => round2(st.sections.reduce((t, s) => t + (s?.net ?? 0), 0)));
  const ranks = competitionRanks(totals);
  const avg = (values: number[]) => (values.length ? round2(values.reduce((t, v) => t + v, 0) / values.length) : 0);
  const sectionAvgs = exam.sections.map((_, i) => avg(exam.students.map((st) => st.sections[i]?.net).filter((n): n is number => typeof n === "number")));
  const avgTotal = avg(totals);
  return exam.students.map((st, idx) => {
    const sections: CardSection[] = [];
    const weak: CardTopic[] = [];
    exam.sections.forEach((section, i) => {
      const s = st.sections[i];
      if (!s) return;
      sections.push({
        name: section.name,
        questions: section.questionCount,
        correct: s.correct,
        wrong: s.wrong,
        blank: Math.max(0, section.questionCount - s.correct - s.wrong),
        net: round2(s.net),
        avgNet: sectionAvgs[i],
      });
      if (section.answerKey && s.answers && section.topics.some(Boolean)) {
        try {
          const { outcomes } = gradeAnswers(section.answerKey, s.answers);
          for (const t of topicBreakdown(section.topics, [outcomes])) {
            if (t.wrong + t.blank > 0) weak.push({ section: section.name, topic: t.topic, questions: t.questions, wrong: t.wrong, blank: t.blank });
          }
        } catch {
          // Cevap dizisi anahtarla uyuşmuyorsa konu analizi atlanır
        }
      }
    });
    // Önce en çok soru kaçırılan konu (13 sorudan 11 boş, 1 sorudan 1 yanlıştan önce gelir)
    weak.sort((a, b) => b.wrong + b.blank - (a.wrong + a.blank) || (b.wrong + b.blank) / b.questions - (a.wrong + a.blank) / a.questions || b.wrong - a.wrong);
    return {
      totalNet: totals[idx],
      avgTotalNet: avgTotal,
      rank: ranks[idx],
      of: exam.students.length,
      score: st.score,
      ranks: st.ranks,
      sections,
      weakTopics: weak,
    };
  });
}
