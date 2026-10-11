import { describe, expect, it } from "vitest";
import { formatTime, zonedDateTime } from "@/lib/dates";
import { dayIntervals, generateSlots, isSlotAvailable, type SlotQuery } from "@/server/availability";

// 2026-10-12 Pazartesi. "Şimdi" Pazar 09:00 (İstanbul).
const MONDAY = "2026-10-12";
const now = zonedDateTime("2026-10-11", 9 * 60);

function base(overrides: Partial<SlotQuery> = {}): SlotQuery {
  return {
    rules: [{ weekday: 1, startMinute: 18 * 60, endMinute: 20 * 60 }],
    exceptions: [],
    busy: [],
    durationMinutes: 60,
    bufferMinutes: 0,
    startDate: MONDAY,
    days: 1,
    now,
    minNoticeHours: 12,
    maxAdvanceDays: 30,
    ...overrides,
  };
}

const times = (query: SlotQuery) =>
  generateSlots(query)[0].slots.map((s) => `${formatTime(s.start)}${s.available ? "" : " dolu"}`);

describe("boş saat üretimi", () => {
  it("haftalık şablondan 30 dakikada bir saat üretir", () => {
    expect(times(base())).toEqual(["18:00", "18:30", "19:00"]);
  });

  it("90 dakikalık derste sığmayan saatleri çıkarır", () => {
    expect(times(base({ durationMinutes: 90 }))).toEqual(["18:00", "18:30"]);
  });

  it("dolu randevuyla çakışan saatleri dolu gösterir", () => {
    const busy = [{ start: zonedDateTime(MONDAY, 18 * 60), end: zonedDateTime(MONDAY, 19 * 60) }];
    expect(times(base({ busy }))).toEqual(["18:00 dolu", "18:30 dolu", "19:00"]);
  });

  it("tampon süreyi hem yeni hem mevcut randevuya uygular", () => {
    const rules = [{ weekday: 1, startMinute: 18 * 60, endMinute: 21 * 60 }];
    // Mevcut ders 18:00-19:00, tamponla 19:15'e kadar dolu
    const busy = [{ start: zonedDateTime(MONDAY, 18 * 60), end: zonedDateTime(MONDAY, 19 * 60 + 15) }];
    expect(times(base({ rules, busy, bufferMinutes: 15 }))).toEqual([
      "18:00 dolu",
      "18:30 dolu",
      "19:00 dolu",
      "19:30",
      "20:00",
    ]);
  });

  it("erken haber süresi içindeki saatleri hiç göstermez", () => {
    const lateNow = zonedDateTime(MONDAY, 8 * 60); // 12 saat sonrası 20:00
    expect(times(base({ now: lateNow }))).toEqual([]);
    expect(times(base({ now: zonedDateTime(MONDAY, 6 * 60 + 30) }))).toEqual(["18:30", "19:00"]);
  });

  it("en geç randevu sınırını aşan günleri üretmez", () => {
    const days = generateSlots(base({ days: 10, maxAdvanceDays: 3 }));
    expect(days.map((d) => d.date)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
  });

  it("izin günü bütün saatleri kapatır, ek saat yeni aralık açar", () => {
    const exceptions = [
      { date: MONDAY, type: "BLOCKED" as const, startMinute: null, endMinute: null },
      { date: MONDAY, type: "EXTRA" as const, startMinute: 10 * 60, endMinute: 12 * 60 },
    ];
    expect(times(base({ exceptions }))).toEqual(["10:00", "10:30", "11:00"]);
  });

  it("kısmi izin aralığı böler", () => {
    const exceptions = [{ date: MONDAY, type: "BLOCKED" as const, startMinute: 18 * 60 + 30, endMinute: 19 * 60 }];
    expect(dayIntervals(MONDAY, base().rules, exceptions)).toEqual([
      [18 * 60, 18 * 60 + 30],
      [19 * 60, 20 * 60],
    ]);
    expect(times(base({ exceptions }))).toEqual(["19:00"]);
  });

  it("istenen saatin seçilebilir olup olmadığını doğrular", () => {
    const query = base();
    expect(isSlotAvailable(query, zonedDateTime(MONDAY, 18 * 60 + 30))).toBe(true);
    expect(isSlotAvailable(query, zonedDateTime(MONDAY, 18 * 60 + 15))).toBe(false);
    expect(isSlotAvailable(query, zonedDateTime(MONDAY, 19 * 60 + 30))).toBe(false);
  });
});
