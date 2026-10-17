import { createHash } from "node:crypto";
import { db } from "./db";
import { notifyRole } from "./notifications";

// Hata takibi: sunucuda yakalanan hatalar veritabanına yazılır. Yeni (ya da çözüldükten sonra tekrar eden) hata
// yöneticilere bildirilir; aynı hata için en fazla 6 saatte bir bildirim gider.

const NOTIFY_EVERY_MS = 6 * 3_600_000;

export type ErrorReport = { error: unknown; source: string; routePath?: string | null; path?: string | null; method?: string | null };

function describe(error: unknown) {
  if (error instanceof Error) {
    const digest = "digest" in error ? String((error as { digest?: unknown }).digest ?? "") || null : null;
    return { message: error.message || error.name, stack: error.stack ?? null, digest };
  }
  return { message: String(error), stack: null, digest: null };
}

/** Next.js'in akış kontrolü için fırlattığı "hatalar" (yönlendirme, 404) kaydedilmez. */
function isControlFlow(digest: string | null, message: string) {
  return Boolean(digest && /^(NEXT_REDIRECT|NEXT_HTTP_ERROR_FALLBACK|NEXT_NOT_FOUND|DYNAMIC_SERVER_USAGE|BAILOUT_TO_CLIENT_SIDE_RENDERING)/.test(digest)) || message === "NEXT_REDIRECT";
}

/** Hatayı kaydeder; kayıt sırasında oluşan hata uygulamayı etkilemez. */
export async function recordError(report: ErrorReport, now = new Date()): Promise<void> {
  try {
    const { message, stack, digest } = describe(report.error);
    if (isControlFlow(digest, message)) return;
    // Değişken kısımlar (kimlikler, sayılar) parmak izine girmez; aynı hata tek satırda toplanır.
    const normalized = message.replace(/[a-z0-9]{20,}/gi, "#").replace(/\d+/g, "0").slice(0, 300);
    const fingerprint = createHash("sha256").update(`${report.source}|${report.routePath ?? ""}|${normalized}`).digest("hex").slice(0, 40);
    const data = {
      message: message.slice(0, 1000),
      stack: stack?.slice(0, 6000) ?? null,
      lastPath: report.path?.slice(0, 500) ?? null,
      method: report.method ?? null,
      digest,
      lastSeenAt: now,
    };
    const event = await db.errorEvent.upsert({
      where: { fingerprint },
      create: { fingerprint, source: report.source, routePath: report.routePath ?? null, ...data, firstSeenAt: now },
      update: { ...data, count: { increment: 1 } },
    });
    const reopened = event.resolvedAt !== null;
    const due = !event.lastNotifiedAt || now.getTime() - event.lastNotifiedAt.getTime() > NOTIFY_EVERY_MS;
    if (!reopened && !due) return;
    const claimed = await db.errorEvent.updateMany({
      where: { id: event.id, OR: [{ lastNotifiedAt: null }, { lastNotifiedAt: { lt: new Date(now.getTime() - NOTIFY_EVERY_MS) } }, { resolvedAt: { not: null } }] },
      data: { lastNotifiedAt: now, resolvedAt: null },
    });
    if (claimed.count !== 1) return;
    await notifyRole("ADMIN", {
      type: "admin.error",
      title: reopened ? "Çözülen bir hata tekrar oluştu" : event.count > 1 ? `Sitede hata tekrar ediyor (${event.count} kez)` : "Sitede yeni bir hata oluştu",
      body: `${report.routePath ?? report.source}: ${message.slice(0, 200)}`,
      link: "/yonetim/hatalar",
    });
  } catch (error) {
    console.error("[hata takibi]", error);
  }
}
