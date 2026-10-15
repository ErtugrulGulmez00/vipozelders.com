import { afterAll, describe, expect, it } from "vitest";
import { normalizeOpticAnswers, parseOpticFile, parseSectionPositions } from "@/lib/center/optic";
import { buildSeating, parseRooms } from "@/lib/center/seating";
import { db } from "@/server/db";
import { markSummary, normalizeMarks, parsePeriods } from "@/server/center/study-hall";

afterAll(async () => {
  await db.$disconnect();
});

describe("optik okuyucu", () => {
  const template = { numberStart: 1, numberLength: 4, nameStart: 5, nameLength: 10, sections: [{ start: 15, length: 5 }, { start: 20, length: 3 }] };

  it("sabit konumlu satırları okur, baştaki sıfırları atar", () => {
    const text = ["0012Ali Kaya  ABCDEab*", "", "1003Ece Uz    AB DAC  "].join("\r\n");
    const rows = parseOpticFile(text, template);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ line: 1, number: "12", name: "Ali Kaya", answers: ["ABCDE", "AB*"] });
    expect(rows[1]).toMatchObject({ line: 3, number: "1003", name: "Ece Uz", answers: ["AB-DA", "C--"] });
  });

  it("cevap alanını normalleştirir ve ders konumlarını okur", () => {
    expect(normalizeOpticAnswers("a b#", 5)).toBe("A-B*-");
    expect(parseSectionPositions("30:20\n50 20, 70/10")).toEqual([{ start: 30, length: 20 }, { start: 50, length: 20 }, { start: 70, length: 10 }]);
    expect(() => parseSectionPositions("abc")).toThrow("Geçersiz ders konumu");
  });
});

describe("kelebek düzeni", () => {
  it("aynı sınıftan öğrenciler ardışık oturmaz, kapasite aşılırsa yerleşmeyenler döner", () => {
    const students = [
      ...Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, name: `A${i}`, group: "8-A", number: null })),
      ...Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, name: `B${i}`, group: "8-B", number: null })),
    ];
    const rooms = parseRooms("A salonu: 6\nB salonu: 5");
    const { seats, unplaced } = buildSeating(students, rooms);
    expect(seats).toHaveLength(11);
    expect(unplaced).toHaveLength(1);
    for (const room of rooms) {
      const inRoom = seats.filter((s) => s.room === room.name);
      for (let i = 1; i < inRoom.length; i++) expect(inRoom[i].student.group).not.toBe(inRoom[i - 1].student.group);
    }
    expect(() => parseRooms("salon")).toThrow("Salon satırı hatalı");
  });
});

describe("çalışma salonu", () => {
  it("periyotları doğrular ve sıralar", () => {
    expect(parsePeriods("10:00-10:45\n09:00 - 09:45")).toEqual(["09:00-09:45", "10:00-10:45"]);
    expect(() => parsePeriods("10:00-09:00")).toThrow("Periyot hatalı");
  });

  it("işaretleri periyot sayısına göre düzeltir ve özetler", () => {
    expect(normalizeMarks("GYx", 5)).toBe("GY---");
    expect(markSummary("GGY--")).toEqual({ present: 2, absent: 1, marked: 3 });
  });
});

