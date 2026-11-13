import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { moduleEnabled, sectionAllowed, type CenterModuleKey } from "@/lib/center/modules";
import { failure, type ActionState } from "@/lib/action-state";
import { centerAccess, type CenterAccess } from "@/lib/center/subscription";
import { centerCan, type CenterPermission, type CenterRoleName } from "@/lib/center/permissions";
import { COACH_FEATURES, coachFeatureOpen, coachPlan, type CoachFeature, type CoachPlan } from "@/lib/pi-koc";
import { getCurrentUser, type SessionUser } from "../auth/current-user";
import { requestMeta, secureCookies } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";
import { getSiteSettings } from "../site";

/** Birden çok kurumda çalışan personelin seçili kurumu */
export const CENTER_COOKIE = "vd_center";

const centerSelect = {
  id: true,
  name: true,
  slug: true,
  kind: true,
  status: true,
  plan: true,
  studentLimit: true,
  trialEndsAt: true,
  paidUntil: true,
  promoUntil: true,
  promoStudents: true,
  overLimitSince: true,
  phone: true,
  email: true,
  address: true,
  logoKey: true,
  academicYear: true,
  notifyAbsence: true,
  remindPayments: true,
  reminderDaysBefore: true,
  isPublic: true,
  showTeacherSuggestions: true,
  disabledModules: true,
} as const;

export type CenterSummary = {
  id: string;
  name: string;
  slug: string;
  kind: "ETUT" | "DERSHANE" | "KURS" | "OTHER" | "COACH";
  status: "TRIAL" | "ACTIVE" | "SUSPENDED";
  plan: "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE";
  studentLimit: number;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
  promoUntil: Date | null;
  promoStudents: number | null;
  overLimitSince: Date | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoKey: string | null;
  academicYear: string;
  notifyAbsence: boolean;
  remindPayments: boolean;
  reminderDaysBefore: number;
  isPublic: boolean;
  showTeacherSuggestions: boolean;
  disabledModules: string[];
};

export type CenterContext = {
  user: SessionUser;
  member: { id: string; role: CenterRoleName; title: string | null; branch: string | null };
  center: CenterSummary;
  access: CenterAccess;
  /** Pi Koç hesabında paket durumu (ücretsiz / ücretli); kurumlarda null. center.studentLimit geçerli sınırı gösterir. */
  coach: CoachPlan | null;
  memberships: { centerId: string; centerName: string; role: CenterRoleName; coach: boolean }[];
  can: (permission: CenterPermission) => boolean;
};

type Resolution =
  | { kind: "anonymous" }
  | { kind: "password"; user: SessionUser }
  | { kind: "none"; user: SessionUser }
  | { kind: "suspended"; user: SessionUser; centerName: string }
  | { kind: "ok"; ctx: CenterContext };

/** Oturumdaki kullanıcının kurum üyeliğini çözer; istek başına bir kez çalışır. */
export const resolveCenter = cache(async (): Promise<Resolution> => {
  const user = await getCurrentUser();
  if (!user) return { kind: "anonymous" };
  if (user.mustChangePassword) return { kind: "password", user };

  const memberships = await db.centerMember.findMany({
    where: { userId: user.id, isActive: true },
    include: { center: { select: centerSelect } },
    orderBy: { createdAt: "asc" },
  });
  if (memberships.length === 0) return { kind: "none", user };

  const selectedId = (await cookies()).get(CENTER_COOKIE)?.value;
  const usable = memberships.filter((m) => m.center.status !== "SUSPENDED");
  const member = usable.find((m) => m.centerId === selectedId) ?? usable[0];
  if (!member) return { kind: "suspended", user, centerName: memberships[0].center.name };

  let center = member.center as CenterSummary;
  const role = member.role as CenterRoleName;
  // Pi Koç: geçerli öğrenci sınırı pakete göre (ücretsizde ayardaki sınır, ücretlide paketin sınırı)
  const coach = center.kind === "COACH" ? coachPlan(center, (await getSiteSettings()).piKocFreeStudents) : null;
  if (coach) center = { ...center, studentLimit: coach.studentLimit };
  return {
    kind: "ok",
    ctx: {
      user,
      member: { id: member.id, role, title: member.title, branch: member.branch },
      center,
      access: centerAccess(center),
      coach,
      memberships: usable.map((m) => ({ centerId: m.centerId, centerName: m.center.name, role: m.role as CenterRoleName, coach: m.center.kind === "COACH" })),
      can: (permission) => centerCan(role, permission),
    },
  };
});

/** Kurum paneli sayfaları için: giriş, üyelik ve (verildiyse) yetki kontrolü. */
export async function requireCenter(permission?: CenterPermission): Promise<CenterContext> {
  const resolved = await resolveCenter();
  if (resolved.kind === "anonymous") redirect("/kurum-giris");
  if (resolved.kind === "password") redirect("/sifre-degistir");
  if (resolved.kind !== "ok") redirect("/kurum-erisim");
  const { ctx } = resolved;
  if (permission && !ctx.can(permission)) redirect("/kurum?durum=yetki");
  return ctx;
}

export type CenterActionResult = { ok: true; ctx: CenterContext } | { ok: false; state: ActionState };

// Yazma işlemleri de modül ve Pi Koç kilitlerine uyar (sayfa kilidi eski sekmeden gönderilen formu durdurmaz)
const PERMISSION_MODULE: Partial<Record<CenterPermission, CenterModuleKey>> = {
  "etud.manage": "etutler",
  "homework.manage": "odevler",
  "resources.manage": "kaynaklar",
  "coaching.manage": "kocluk",
  "leads.manage": "on-kayit",
  "exams.manage": "denemeler",
  "questions.answer": "sorular",
  "finance.edit": "muhasebe",
  "expenses.manage": "muhasebe",
};
const COACH_BLOCKED = new Set<CenterPermission>(["groups.manage", "attendance.take", "staff.manage"]);

/**
 * Server Action'lar için yetki kontrolü. Yazma işlemlerinde aboneliğin süresi dolmuşsa
 * işlem yapılmaz (veriler silinmez, panel salt okunur olur).
 */
export async function centerAction(
  permission: CenterPermission | null,
  // overLimit: ücretsiz pakette sınırın üstünde öğrencisi olan koçun da yapabildiği işlem (öğrenciyi arşive alma)
  options: { write?: boolean; module?: CenterModuleKey; section?: string; overLimit?: boolean } = {},
): Promise<CenterActionResult> {
  const resolved = await resolveCenter();
  if (resolved.kind !== "ok") return { ok: false, state: failure("Oturumunuz kapanmış ya da kurum hesabınız etkin değil. Sayfayı yenileyip tekrar giriş yapın.") };
  const { ctx } = resolved;
  if (permission && !ctx.can(permission)) return { ok: false, state: failure("Bu işlem için yetkiniz yok. Kurum yöneticinizle görüşün.") };
  const moduleKey = options.module ?? (permission ? PERMISSION_MODULE[permission] : undefined);
  if (moduleKey && !moduleEnabled(ctx.center, moduleKey)) return { ok: false, state: failure("Bu modül kurum ayarlarından kapatılmış.") };
  if (ctx.center.kind === "COACH" && permission && COACH_BLOCKED.has(permission)) return { ok: false, state: failure("Bu işlem Pi Koç'ta yok.") };
  if (options.section && !sectionAllowed(ctx.center, options.section)) return { ok: false, state: failure("Bu bölüm kurumunuzda kullanılmıyor.") };
  if (options.write !== false && !ctx.access.writable) {
    return { ok: false, state: failure("Abonelik süreniz dolduğu için panel salt okunur. Kayıtlarınız duruyor; aboneliği yenileyince kaldığınız yerden devam edersiniz.") };
  }
  // Ücretli paketi biten koç ücretsiz pakete düşer; sınırın üstünde öğrencisi varsa önce paketi yenilemeli ya da öğrenci arşivlemeli
  if (ctx.coach && !ctx.coach.paid && options.write !== false && !options.overLimit) {
    const active = await db.centerStudent.count({ where: { centerId: ctx.center.id, status: "ACTIVE" } });
    if (active > ctx.coach.studentLimit) {
      return { ok: false, state: failure(`Ücretsiz pakette en fazla ${ctx.coach.studentLimit} öğrenci olur; şu an ${active} aktif öğrenciniz var. Paketinizi yenileyin ya da öğrencileri arşive alın. Kayıtlarınız duruyor.`) };
    }
  }
  return { ok: true, ctx };
}

/** Pi Koç ücretsiz paketinde kilitli özelliğin işlemi: kilitliyse hata durumu, açıksa null. */
export function coachFeatureLocked(ctx: CenterContext, feature: CoachFeature): ActionState | null {
  if (coachFeatureOpen(ctx.coach, feature)) return null;
  return failure(`${COACH_FEATURES[feature].title} ücretli pakette açılır. Hesap ve abonelik sayfasından paketinizi seçebilirsiniz.`);
}

/** Kurum içindeki işlemler: hem genel işlem kaydına hem kuruma bağlı olarak yazılır. */
export async function centerAudit(ctx: CenterContext, action: string, entityType: string, entityId: string | null, details?: Record<string, string | number | boolean | null>) {
  const { ipAddress } = await requestMeta();
  await audit({ actorId: ctx.user.id, action: `center.${action}`, entityType, entityId, details: { centerId: ctx.center.id, ...(details ?? {}) }, ipAddress });
}

export async function selectCenterCookie(centerId: string) {
  (await cookies()).set(CENTER_COOKIE, centerId, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Kurum türünde olmayan bölümün sayfaları açılmaz (bölüm klasörünün layout'unda çağrılır). */
export async function requireCenterSection(section: string): Promise<CenterContext> {
  const ctx = await requireCenter();
  if (!sectionAllowed(ctx.center, section)) redirect("/kurum");
  return ctx;
}

/** Kurumun kapattığı modülün sayfaları açılmaz (modül klasörünün layout'unda çağrılır). */
export async function requireCenterModule(key: CenterModuleKey): Promise<CenterContext> {
  const ctx = await requireCenter();
  if (!moduleEnabled(ctx.center, key)) redirect("/kurum?durum=modul");
  return ctx;
}
