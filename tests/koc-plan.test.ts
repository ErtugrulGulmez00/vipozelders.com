import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { resourceForecast } = await import("@/server/koc-plan");
const { BUILTIN_TEMPLATES, cleanTemplateItems } = await import("@/lib/koc-templates");

const at = (date: string) => new Date(`${date}T12:00:00+03:00`);

describe("Pi Koç kitap bitiş tahmini", () => {
  const topics = ["A", "B", "C", "D", "E", "F"];

  it("son 4 haftadaki konu hızına göre kalan konuların bitiş gününü verir", () => {
    // 28 günde 2 konu bitti → 4 konu kalan → 56 gün
    const f = resourceForecast(topics, [{ topic: "A", completedAt: at("2026-11-01") }, { topic: "B", completedAt: at("2026-11-08") }], "2026-11-10");
    expect(f).toMatchObject({ remaining: 4, finishDate: "2027-01-05", finished: false });
    expect(f.perWeek).toBe(0.5);
  });

  it("son 4 haftada konu bitmediyse tarih vermez, hepsi bittiyse bitti der", () => {
    expect(resourceForecast(topics, [{ topic: "A", completedAt: at("2026-08-01") }], "2026-11-10")).toMatchObject({ finishDate: null, perWeek: 0, finished: false });
    expect(resourceForecast(["A"], [{ topic: "A", completedAt: at("2026-11-09") }], "2026-11-10")).toMatchObject({ remaining: 0, finished: true });
  });

  it("kaynakta olmayan konunun ilerlemesini saymaz", () => {
    expect(resourceForecast(["A", "B"], [{ topic: "Z", completedAt: at("2026-11-09") }], "2026-11-10").remaining).toBe(2);
  });
});

describe("Pi Koç program şablonları", () => {
  it("hazır şablonlar geçerli kalemlerden oluşur", () => {
    for (const t of BUILTIN_TEMPLATES) expect(cleanTemplateItems(t.items)).toHaveLength(t.items.length);
  });

  it("bozuk kalemleri ayıklar, sınırları uygular", () => {
    const items = cleanTemplateItems([
      { weekday: 1, subject: "Matematik", topic: "Problemler", targetQuestions: 40 },
      { weekday: 9, subject: "Fizik" },
      { weekday: 2, subject: "F" },
      { weekday: 3, subject: "Kimya", targetQuestions: -5, note: "  " },
    ]);
    expect(items).toEqual([
      { weekday: 1, subject: "Matematik", topic: "Problemler", targetQuestions: 40, note: null },
      { weekday: 3, subject: "Kimya", topic: null, targetQuestions: null, note: null },
    ]);
    expect(cleanTemplateItems("bozuk")).toEqual([]);
  });
});
