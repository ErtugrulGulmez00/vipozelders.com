import { describe, expect, it } from "vitest";
import { parseTopics, resourceSummary, weekStartOf } from "@/server/center/resources";

describe("kaynak takibi", () => {
  it("konu listesini satır satır temizler", () => {
    expect(parseTopics("1. Çarpanlar ve Katlar\n- Üslü İfadeler\n\nüslü ifadeler\n  Kareköklü İfadeler  ")).toEqual(["Çarpanlar ve Katlar", "Üslü İfadeler", "Kareköklü İfadeler"]);
  });

  it("tamamlanma ve konu başarısını hesaplar", () => {
    const summary = resourceSummary(["A", "B", "C", "D"], [
      { topic: "A", solved: 40, correct: 30, wrong: 10, completedAt: new Date() },
      { topic: "B", solved: 20, correct: 8, wrong: 12, completedAt: null },
    ]);
    expect(summary.doneCount).toBe(1);
    expect(summary.completion).toBe(0.25);
    expect(summary.solved).toBe(60);
    expect(summary.accuracy).toBeCloseTo(38 / 60);
    expect(summary.rows[1].accuracy).toBeCloseTo(0.4);
    expect(summary.rows[2].accuracy).toBeNull();
  });

  it("haftanın pazartesisini bulur", () => {
    expect(weekStartOf("2026-10-14")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-18")).toBe("2026-10-12");
    expect(weekStartOf("2026-10-12")).toBe("2026-10-12");
  });
});
