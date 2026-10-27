import { describe, expect, it } from "vitest";
import { notificationScope, sideHome, sideOfPath, sideSwitches, type SideFacts } from "@/lib/sides";

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
  });
});
