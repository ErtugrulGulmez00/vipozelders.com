import { describe, expect, it } from "vitest";
import { COACH_DISABLED_MODULES, coachAllows, moduleEnabled, OPTIONAL_MODULES } from "@/lib/center/modules";
import { buildCenterReport, buildStudentRows, type ReportInput } from "@/lib/center/reports";
import { bookedMinutes, findRoomConflicts, type RoomSlot } from "@/lib/center/rooms";
import { centerPlans } from "@/server/center/plans";
import { settingsSchema } from "@/server/settings";

describe("Modüller", () => {
  it("bütün bölümler açık; yalnızca kurumun kapattığı modül kapanır", () => {
    expect(moduleEnabled({ disabledModules: [] }, "sinif-defteri")).toBe(true);
    expect(moduleEnabled({ disabledModules: [] }, "denemeler")).toBe(true);
    expect(moduleEnabled({ disabledModules: ["odevler"] }, "odevler")).toBe(false);
    expect(OPTIONAL_MODULES.map((m) => m.key)).toContain("sinif-defteri");
  });
});

describe("Pi Koç", () => {
  it("koç hesabı sınıf ve kurum bölümlerini kullanmaz; takip bölümleri açıktır", () => {
    for (const section of ["siniflar", "yoklama", "etutler", "derslikler", "personel"]) expect(coachAllows(section)).toBe(false);
    for (const section of ["ogrenciler", "denemeler", "kaynaklar", "kocluk", "muhasebe", "abonelik"]) expect(coachAllows(section)).toBe(true);
    expect([...COACH_DISABLED_MODULES].sort()).toEqual(["calisma-salonu", "etutler", "on-kayit", "sinif-defteri"]);
  });
});

describe("Paket fiyatları", () => {
  const settings = settingsSchema.parse({});

  it("50 / 100 (öne çıkan, az farkla 2 kat) / 200 / 200+ teklif", () => {
    const plans = centerPlans(settings);
    expect(plans.map((p) => p.plan)).toEqual(["STARTER", "PRO", "BUSINESS", "ENTERPRISE"]);
    expect(plans[0]).toMatchObject({ students: 50, priceTl: 3799, yearlyPriceTl: 32999, upsell: null, quote: false });
    expect(plans[1]).toMatchObject({ students: 100, priceTl: 3999, yearlyPriceTl: 35999, highlight: true, upsell: { ratio: 2, diffTl: 3000, yearly: true } });
    expect(plans[2]).toMatchObject({ students: 200, upsell: null });
    expect(plans[3]).toMatchObject({ students: null, quote: true, name: "200'den fazla öğrenci" });
    expect(plans.filter((p) => p.highlight)).toHaveLength(1);
  });
});

describe("Derslikler", () => {
  const slot = (id: string, room: string, weekday: number, start: number, end: number): RoomSlot => ({ id, room, weekday, startMinute: start, endMinute: end, label: id, students: 10 });

  it("aynı derslikte aynı gün kesişen dersler çakışır; bitişik ve farklı gün çakışmaz; ad farkı yok sayılır", () => {
    const conflicts = findRoomConflicts([slot("a", "101", 1, 540, 600), slot("b", " 101 ", 1, 580, 640), slot("c", "101", 1, 640, 700), slot("d", "101", 2, 540, 600), slot("e", "Lab", 1, 540, 600)]);
    expect(conflicts.map(([x, y]) => `${x.id}-${y.id}`)).toEqual(["a-b"]);
  });

  it("haftalık dolu süre çakışan saatleri bir kez sayar", () => {
    expect(bookedMinutes([slot("a", "101", 1, 540, 600), slot("b", "101", 1, 580, 640), slot("c", "101", 3, 600, 645)])).toBe(100 + 45);
  });
});

describe("Kurum raporları", () => {
  const input: ReportInput = {
    groups: [
      { id: "g1", name: "8-A", gradeName: "8. sınıf" },
      { id: "g2", name: "12-S", gradeName: "12. sınıf" },
    ],
    students: [
      { id: "s1", name: "Ali", studentNumber: "1", groupIds: ["g1"] },
      { id: "s2", name: "Ayşe", studentNumber: "2", groupIds: ["g1"] },
      { id: "s3", name: "Can", studentNumber: "3", groupIds: ["g2"] },
    ],
    attendance: [
      { studentId: "s1", status: "PRESENT" },
      { studentId: "s1", status: "ABSENT" },
      { studentId: "s2", status: "LATE" },
      { studentId: "s2", status: "PRESENT" },
    ],
    homework: [
      { studentId: "s1", status: "DONE" },
      { studentId: "s2", status: "PARTIAL" },
      { studentId: "s2", status: "PENDING" },
    ],
    exams: [
      { examId: "e1", examName: "LGS-1", date: "2026-10-01", studentId: "s1", net: 50 },
      { examId: "e2", examName: "LGS-2", date: "2026-10-20", studentId: "s1", net: 60 },
      { examId: "e2", examName: "LGS-2", date: "2026-10-20", studentId: "s2", net: 70 },
      { examId: "e3", examName: "TYT-1", date: "2026-10-15", studentId: "s3", net: 80 },
    ],
    overdue: [{ studentId: "s3", amount: 500_00 }],
  };

  it("sınıf ölçüleri yalnızca o sınıfın öğrencilerinden; son deneme sınıfın en son girdiği deneme", () => {
    const { total, groups } = buildCenterReport(input);
    const g1 = groups.find((g) => g.id === "g1")!;
    expect(g1.students).toBe(2);
    expect(g1.attendanceRate).toBe(3 / 4);
    expect(g1.absences).toBe(1);
    expect(g1.homeworkRate).toBe(1.5 / 2);
    expect(g1.exam).toEqual({ name: "LGS-2", avgNet: 65, participants: 2 });
    expect(g1.overdue).toBe(0);
    const g2 = groups.find((g) => g.id === "g2")!;
    expect(g2.attendanceRate).toBeNull();
    expect(g2.exam?.name).toBe("TYT-1");
    expect(g2.overdue).toBe(500_00);
    expect(total.students).toBe(3);
    expect(total.overdue).toBe(500_00);
  });

  it("öğrenci satırları kendi son netini gösterir", () => {
    const rows = buildStudentRows(input);
    expect(rows.find((r) => r.id === "s1")?.lastNet).toBe(60);
    expect(rows.find((r) => r.id === "s3")?.lastNet).toBe(80);
  });
});
