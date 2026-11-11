import { describe, expect, it } from "vitest";
import { gateHome, kurumHome, notificationScope, sideHome, sideOfPath, sideSwitches, wrongGateMessage, type SideFacts } from "@/lib/sides";

const facts = (f: Partial<SideFacts> & Pick<SideFacts, "role">): SideFacts => ({ staff: false, portal: false, privateSide: true, privateActivity: false, ...f });

describe("Giriş kapısı ve taraflar", () => {
  it("kurumda da çalışan öğretmen kurum kapısından kurum paneline, özel ders kapısından öğretmen paneline gider", () => {
    const teacher = facts({ role: "TEACHER", staff: true, privateActivity: true });
    expect(sideHome(teacher, "kurum")).toBe("/kurum");
    expect(sideHome(teacher, "ozel")).toBe("/ogretmen-paneli");
    expect(notificationScope(teacher, "kurum")).toBe("center");
    expect(notificationScope(teacher, "ozel")).toBe("private");
    expect(sideSwitches(teacher, "teacher").map((s) => s.href)).toEqual(["/kurum"]);
    expect(sideSwitches(teacher, "center").map((s) => s.href)).toEqual(["/ogretmen-paneli"]);
  });

  it("kurum personeli hangi kapıdan girerse girsin kurum paneline gider, bütün bildirimlerini görür", () => {
    const staff = facts({ role: "CENTER", staff: true, privateSide: false });
    expect(sideHome(staff, "ozel")).toBe("/kurum");
    expect(sideHome(staff, "kurum")).toBe("/kurum");
    expect(notificationScope(staff, "kurum")).toBe("all");
    expect(sideSwitches(staff, "center")).toEqual([]);
  });

  it("kurumun açtığı öğrenci hesabı özel ders kapısından da kurum tarafına düşer", () => {
    const student = facts({ role: "STUDENT", portal: true, privateSide: false });
    expect(sideHome(student, "ozel")).toBe("/hesabim/kurum");
    expect(sideHome(student, "kurum")).toBe("/hesabim/kurum");
    expect(notificationScope(student, "kurum")).toBe("all");
    expect(sideSwitches(student, "portal")).toEqual([]);
  });

  it("kurum velisi kapıya göre iki tarafı görür; özel derste işlemi yoksa kurum tarafında özel ders tanıtılmaz", () => {
    const parent = facts({ role: "STUDENT", portal: true });
    expect(sideHome(parent, "kurum")).toBe("/hesabim/kurum");
    expect(sideHome(parent, "ozel")).toBe("/hesabim");
    expect(sideSwitches(parent, "portal")).toEqual([]);
    expect(sideSwitches(parent, "student").map((s) => s.href)).toEqual(["/hesabim/kurum"]);
    const active = { ...parent, privateActivity: true };
    expect(sideSwitches(active, "portal").map((s) => s.href)).toEqual(["/hesabim"]);
  });

  it("kurumla bağı olmayan kişi kurum kapısından kendi paneline gider", () => {
    expect(sideHome(facts({ role: "STUDENT" }), "kurum")).toBe("/hesabim");
    expect(sideHome(facts({ role: "TEACHER" }), "kurum")).toBe("/ogretmen-paneli");
    expect(sideHome(facts({ role: "ADMIN" }), "kurum")).toBe("/yonetim");
    expect(notificationScope(facts({ role: "TEACHER" }), "ozel")).toBe("all");
  });

  it("kurum tarafı adresleri", () => {
    expect(sideOfPath("/kurum/ogrenciler")).toBe("kurum");
    expect(sideOfPath("/hesabim/kurum/abc")).toBe("kurum");
    expect(sideOfPath("/hesabim")).toBe("ozel");
    expect(sideOfPath("/kurumlar")).toBe("ozel");
    expect(sideOfPath("/koc/ogrenciler")).toBe("koc");
    expect(sideOfPath("/kocum/abc")).toBe("koc");
  });
});

describe("Giriş kapısı kuralı (gateHome): girilen kapının tarafı açılır, yoksa giriş yapılmaz", () => {
  const coach = facts({ role: "CENTER", kocStaff: true, privateSide: false });
  const kocStudent = facts({ role: "STUDENT", kocStudent: true, privateSide: false });
  const owner = facts({ role: "CENTER", staff: true, privateSide: false });
  const parent = facts({ role: "STUDENT", portal: true });
  const teacher = facts({ role: "TEACHER", staff: true, privateActivity: true });
  const teacherCoach = facts({ role: "TEACHER", kocStaff: true, privateActivity: true });

  it("her hesap yalnızca kendi tarafının kapısından girer", () => {
    const row = (f: SideFacts) => [gateHome(f, "ozel"), gateHome(f, "kurum"), gateHome(f, "koc")];
    expect(row(coach)).toEqual([null, null, "/koc"]);
    expect(row(kocStudent)).toEqual([null, null, "/kocum"]);
    expect(row(owner)).toEqual([null, "/kurum", null]);
    expect(row(parent)).toEqual(["/hesabim", "/hesabim/kurum", null]);
    expect(row(teacher)).toEqual(["/ogretmen-paneli", "/kurum", null]);
    expect(row(teacherCoach)).toEqual(["/ogretmen-paneli", null, "/koc"]);
    expect(row(facts({ role: "ADMIN" }))).toEqual(["/yonetim", "/yonetim", "/yonetim"]);
  });

  it("yanlış kapıda kişinin hangi sekmeden girmesi gerektiği söylenir", () => {
    expect(wrongGateMessage(coach, "ozel")).toBe("Bu hesapla Özel ders tarafında kaydınız yok. Hesabınız Pi Koç tarafında: üstteki “Pi Koç” sekmesinden girin.");
    expect(wrongGateMessage(teacher, "koc")).toContain("Özel ders ve Kurum tarafında");
    expect(wrongGateMessage(facts({ role: "CENTER", privateSide: false }), "kurum")).toBe("Bu hesapla Kurum tarafında kaydınız yok.");
  });

  it("Pi Koç hesabı kurum tarafına sayılmaz; geçiş bağlantıları doğru tarafa gider", () => {
    expect(kurumHome(coach)).toBeNull();
    expect(sideSwitches(teacherCoach, "teacher").map((s) => s.href)).toEqual(["/koc"]);
    expect(sideSwitches(teacherCoach, "koc").map((s) => s.href)).toEqual(["/ogretmen-paneli"]);
  });
});
