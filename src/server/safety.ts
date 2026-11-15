import "server-only";
import { db } from "./db";
import { notifyRole } from "./notifications";

// Kullanıcı güvenliği: engelleme ve içerik bildirimi (Google Play kullanıcı içeriği politikası).
// Engellenen kişi engelleyene mesaj ve ders talebi gönderemez; engelleyen de o kişiye yazamaz (konuşma iki yönde kapanır).

export class SafetyError extends Error {}

export const REPORT_REASONS = [
  { key: "taciz", label: "Taciz, hakaret ya da tehdit" },
  { key: "uygunsuz", label: "Uygunsuz ya da müstehcen içerik" },
  { key: "dolandiricilik", label: "Dolandırıcılık ya da sahte hesap" },
  { key: "platform-disi", label: "Platform dışına yönlendirme / ödeme isteme" },
  { key: "spam", label: "İstenmeyen mesaj (spam)" },
  { key: "diger", label: "Diğer" },
] as const;

export type ReportKind = "message" | "thread" | "inquiry" | "user";

export function reasonLabel(key: string) {
  return REPORT_REASONS.find((r) => r.key === key)?.label ?? key;
}

/** a ile b arasında herhangi bir yönde engel var mı */
export async function isBlockedBetween(a: string, b: string) {
  const row = await db.userBlock.findFirst({ where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] }, select: { id: true } });
  return Boolean(row);
}

export async function hasBlocked(blockerId: string, blockedId: string) {
  return Boolean(await db.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId, blockedId } }, select: { id: true } }));
}

export async function blockUser(blockerId: string, blockedId: string) {
  if (blockerId === blockedId) throw new SafetyError("Kendinizi engelleyemezsiniz.");
  const target = await db.user.findUnique({ where: { id: blockedId }, select: { role: true } });
  if (!target) throw new SafetyError("Kişi bulunamadı.");
  if (target.role === "ADMIN") throw new SafetyError("Pi Kampüs ekibi engellenemez.");
  await db.userBlock.upsert({ where: { blockerId_blockedId: { blockerId, blockedId } }, create: { blockerId, blockedId }, update: {} });
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await db.userBlock.deleteMany({ where: { blockerId, blockedId } });
}

/** Bildirimi kaydeder ve yönetime haber verir. Aynı kişi aynı içeriği 24 saatte bir kez bildirebilir. */
export async function reportContent(input: { reporterId: string; targetUserId: string; kind: ReportKind; refId?: string | null; reason: string; note?: string | null }) {
  if (input.reporterId === input.targetUserId) throw new SafetyError("Kendinizi bildiremezsiniz.");
  if (!REPORT_REASONS.some((r) => r.key === input.reason)) throw new SafetyError("Bir bildirim nedeni seçin.");
  const target = await db.user.findUnique({ where: { id: input.targetUserId }, select: { firstName: true, lastName: true } });
  if (!target) throw new SafetyError("Kişi bulunamadı.");
  const recent = await db.contentReport.findFirst({
    where: { reporterId: input.reporterId, targetUserId: input.targetUserId, kind: input.kind, refId: input.refId ?? null, createdAt: { gte: new Date(Date.now() - 86_400_000) } },
    select: { id: true },
  });
  if (recent) return { duplicate: true };
  const note = input.note?.trim().slice(0, 1000) || null;
  const report = await db.contentReport.create({ data: { reporterId: input.reporterId, targetUserId: input.targetUserId, kind: input.kind, refId: input.refId ?? null, reason: input.reason, note } });
  await notifyRole("ADMIN", {
    type: "safety.report",
    title: "Yeni kullanıcı bildirimi",
    body: `${target.firstName} ${target.lastName} · ${reasonLabel(input.reason)}`,
    link: `/yonetim/sikayetler#${report.id}`,
    email: true,
  });
  return { duplicate: false };
}

export async function openReportCount() {
  return db.contentReport.count({ where: { status: "OPEN" } });
}
