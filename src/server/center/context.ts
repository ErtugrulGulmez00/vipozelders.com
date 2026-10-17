import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { moduleEnabled, type CenterModuleKey } from "@/lib/center/modules";
import { failure, type ActionState } from "@/lib/action-state";
import { centerAccess, type CenterAccess } from "@/lib/center/subscription";
import { centerCan, type CenterPermission, type CenterRoleName } from "@/lib/center/permissions";
import { getCurrentUser, type SessionUser } from "../auth/current-user";
import { requestMeta, secureCookies } from "../auth/session";
import { audit } from "../audit";
import { db } from "../db";

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
  kind: "ETUT" | "DERSHANE" | "KURS" | "OTHER";
  status: "TRIAL" | "ACTIVE" | "SUSPENDED";
  plan: "STARTER" | "PRO" | "ENTERPRISE";
  studentLimit: number;
  trialEndsAt: Date | null;
  paidUntil: Date | null;
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
  memberships: { centerId: string; centerName: string; role: CenterRoleName }[];
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

  const center = member.center as CenterSummary;
  const role = member.role as CenterRoleName;
  return {
    kind: "ok",
    ctx: {
      user,
      member: { id: member.id, role, title: member.title, branch: member.branch },
      center,
      access: centerAccess(center),
      memberships: usable.map((m) => ({ centerId: m.centerId, centerName: m.center.name, role: m.role as CenterRoleName })),
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

/**
 * Server Action'lar için yetki kontrolü. Yazma işlemlerinde aboneliğin süresi dolmuşsa
 * işlem yapılmaz (veriler silinmez, panel salt okunur olur).
 */
export async function centerAction(permission: CenterPermission | null, options: { write?: boolean } = {}): Promise<CenterActionResult> {
  const resolved = await resolveCenter();
  if (resolved.kind !== "ok") return { ok: false, state: failure("Oturumunuz kapanmış ya da kurum hesabınız etkin değil. Sayfayı yenileyip tekrar giriş yapın.") };
  const { ctx } = resolved;
  if (permission && !ctx.can(permission)) return { ok: false, state: failure("Bu işlem için yetkiniz yok. Kurum yöneticinizle görüşün.") };
  if (options.write !== false && !ctx.access.writable) {
    return { ok: false, state: failure("Abonelik süreniz dolduğu için panel salt okunur. Kayıtlarınız duruyor; aboneliği yenileyince kaldığınız yerden devam edersiniz.") };
  }
  return { ok: true, ctx };
}

/** Kurum içindeki işlemler: hem genel işlem kaydına hem kuruma bağlı olarak yazılır. */
export async function centerAudit(ctx: CenterContext, action: string, entityType: string, entityId: string | null, details?: Record<string, string | number | boolean | null>) {
  const { ipAddress } = await requestMeta();
  await audit({ actorId: ctx.user.id, action: `center.${action}`, entityType, entityId, details: { centerId: ctx.center.id, ...(details ?? {}) }, ipAddress });
}

export async function selectCenterCookie(centerId: string) {
  (await cookies()).set(CENTER_COOKIE, centerId, { httpOnly: true, secure: secureCookies(), sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

/** Kurumun kapattığı modülün sayfaları açılmaz (modül klasörünün layout'unda çağrılır). */
export async function requireCenterModule(key: CenterModuleKey): Promise<CenterContext> {
  const ctx = await requireCenter();
  if (!moduleEnabled(ctx.center, key)) redirect("/kurum?durum=modul");
  return ctx;
}
