import { describe, expect, it } from "vitest";
import { ruleBasedSummary, summaryFacts, type SummaryInput } from "@/lib/koc-summary";

const base: SummaryInput = {
  solved: 420,
  previousSolved: 355,
  accuracy: 0.71,
  activeDays: 6,
  studyMinutes: 570,
  subjects: [
    { subject: "Matematik", solved: 180, accuracy: 0.62 },
    { subject: "Türkçe", solved: 140, accuracy: 0.84 },
    { subject: "Fizik", solved: 5, accuracy: 0.2 },
  ],
  plan: { done: 18, total: 24 },
  exam: { kindLabel: "TYT", net: 78.5, change: 4.25, inWeek: true },
  goal: { kindLabel: "TYT", targetNet: 90, gap: 11.5 },
  priorityTopics: ["Türev", "Paragraf"],
};

describe("ruleBasedSummary", () => {
  it("haftanın tespitlerini cümleye döker", () => {
    const text = ruleBasedSummary(base);
    expect(text).toContain("Bu hafta 420 soru çözdü, geçen haftaya göre %18 daha fazla; doğruluk oranı %71.");
    // 10 sorunun altındaki ders karşılaştırmaya girmez
    expect(text).toContain("En güçlü ders Türkçe (%84); Matematik doğruluğu %62 ile en düşük");
    expect(text).toContain("24 görevlik programın 18 tanesini tamamladı (%75); programın büyük bölümünü uyguladı.");
    expect(text).toContain("Toplam çalışma süresi 9 sa 30 dk, 6 gün çalıştı.");
    expect(text).toContain("Bu haftaki TYT denemesinde 78,5 net yaptı, bir önceki denemeye göre 4,25 net artış.");
    expect(text).toContain("TYT hedefine (90 net) 11,5 net kaldı.");
    expect(text).toContain("Önümüzdeki hafta önceliğimiz: Türev, Paragraf.");
  });

  it("boş haftada yalnızca kayıt olmadığını söyler", () => {
    const text = ruleBasedSummary({ ...base, solved: 0, previousSolved: 0, accuracy: null, activeDays: 0, studyMinutes: 0, subjects: [], plan: { done: 0, total: 0 }, exam: null, goal: null, priorityTopics: [] });
    expect(text).toBe("Bu hafta soru kaydı girilmedi.");
  });

  it("düşüşü ve ulaşılan hedefi yazar", () => {
    const text = ruleBasedSummary({ ...base, solved: 200, exam: { ...base.exam!, change: -2, inWeek: false }, goal: { ...base.goal!, gap: 0 } });
    expect(text).toContain("geçen haftaya göre %44 daha az");
    expect(text).toContain("Son TYT denemesinde 78,5 net yaptı, bir önceki denemeye göre 2 net düşüş.");
    expect(text).toContain("TYT hedefi olan 90 nete ulaştı.");
  });
});

describe("summaryFacts", () => {
  it("yapay zekâya isimsiz sayılar gider", () => {
    const facts = summaryFacts(base, "12. sınıf");
    expect(facts).toContain("Sınıf: 12. sınıf");
    expect(facts).toContain("- Matematik: 180 soru, doğruluk %62");
    expect(facts).toContain("Program: 24 görevden 18 tamamlandı");
    expect(facts).toContain("Bu haftaki TYT denemesi: 78,5 net (bir öncekine göre +4,25)");
  });
});
