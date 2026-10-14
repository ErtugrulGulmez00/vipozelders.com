// Kurum paneli rolleri ve yetkileri. Hem sunucuda (asıl kontrol) hem arayüzde (menü/buton gizleme) kullanılır.

export type CenterRoleName = "OWNER" | "MANAGER" | "TEACHER" | "ACCOUNTANT";

export const CENTER_PERMISSIONS = [
  "students.view",
  "students.edit",
  "students.delete",
  "groups.manage",
  "attendance.take",
  "etud.manage",
  "homework.manage",
  "resources.manage",
  "questions.answer",
  "exams.manage",
  "notes.write",
  "finance.view",
  "finance.edit",
  "expenses.manage",
  "messages.send",
  "leads.manage",
  "staff.manage",
  "settings.manage",
  "subscription.view",
] as const;

export type CenterPermission = (typeof CENTER_PERMISSIONS)[number];

const MATRIX: Record<CenterRoleName, readonly CenterPermission[]> = {
  OWNER: CENTER_PERMISSIONS,
  // Müdür: abonelik dışında her şey (kurum sahibini düzenleyemez; staff modülünde ayrıca kontrol edilir)
  MANAGER: CENTER_PERMISSIONS.filter((p) => p !== "subscription.view"),
  TEACHER: ["students.view", "attendance.take", "etud.manage", "homework.manage", "resources.manage", "questions.answer", "exams.manage", "notes.write"],
  ACCOUNTANT: ["students.view", "students.edit", "finance.view", "finance.edit", "expenses.manage", "messages.send", "leads.manage"],
};

export function centerCan(role: CenterRoleName, permission: CenterPermission): boolean {
  return MATRIX[role].includes(permission);
}

export const CENTER_ROLE_LABEL: Record<CenterRoleName, string> = {
  OWNER: "Kurum sahibi",
  MANAGER: "Müdür",
  TEACHER: "Öğretmen",
  ACCOUNTANT: "Muhasebe / sekreter",
};

export const CENTER_ROLE_HINT: Record<CenterRoleName, string> = {
  OWNER: "Her şey: personel, ayarlar ve abonelik dahil",
  MANAGER: "Abonelik dışında her şey",
  TEACHER: "Öğrencileri görür; yoklama, etüt, ödev, program/kaynak, deneme ve not girer",
  ACCOUNTANT: "Öğrenci kaydı, ödeme planı, tahsilat, gider, duyuru ve ön kayıt",
};
