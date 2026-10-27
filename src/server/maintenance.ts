import { hashToken } from "./auth/password";
import { db } from "./db";
import { DEFAULT_SETTINGS } from "./settings";

/**
 * Bakım modu proxy'de, sayfa çizilmeden önce uygulanır: ziyaretçiye 503 bakım sayfası,
 * yöneticiye normal site. Veritabanı her istekte değil, birkaç saniyede bir okunur.
 */

type MaintenanceState = { on: boolean; message: string; siteName: string };

const STATE_TTL_MS = 5_000;
const ADMIN_TTL_MS = 30_000;

let stateCache: { value: MaintenanceState; at: number } | null = null;
const adminCache = new Map<string, { admin: boolean; at: number }>();

export async function maintenanceState(): Promise<MaintenanceState> {
  if (stateCache && Date.now() - stateCache.at < STATE_TTL_MS) return stateCache.value;
  const rows = await db.siteSetting.findMany({ where: { key: { in: ["maintenanceMode", "maintenanceMessage", "siteName"] } } });
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const value: MaintenanceState = {
    on: map.maintenanceMode === true,
    message: typeof map.maintenanceMessage === "string" && map.maintenanceMessage.trim() ? map.maintenanceMessage : DEFAULT_SETTINGS.maintenanceMessage,
    siteName: typeof map.siteName === "string" && map.siteName.trim() ? map.siteName : DEFAULT_SETTINGS.siteName,
  };
  stateCache = { value, at: Date.now() };
  return value;
}

/** Ayar kaydedilince aynı süreçteki önbelleği hemen boşaltır. */
export function resetMaintenanceCache() {
  stateCache = null;
}

export async function isAdminSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const id = hashToken(token);
  const hit = adminCache.get(id);
  if (hit && Date.now() - hit.at < ADMIN_TTL_MS) return hit.admin;
  const session = await db.session.findUnique({
    where: { id },
    select: { expiresAt: true, user: { select: { role: true, status: true } } },
  });
  const admin = Boolean(session && session.expiresAt.getTime() > Date.now() && session.user.role === "ADMIN" && session.user.status === "ACTIVE");
  if (adminCache.size > 1000) adminCache.clear();
  adminCache.set(id, { admin, at: Date.now() });
  return admin;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** React'e ihtiyaç duymayan, kendi kendine yeten bakım sayfası. */
export function maintenanceHtml(state: MaintenanceState): string {
  const site = escapeHtml(state.siteName);
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Bakımdayız · ${site}</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1b1f3b;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#fff;padding:16px}main{max-width:460px;text-align:center}h1{font-size:28px;margin:16px 0 8px}p{color:#c9cce6;line-height:1.6;margin:0}.logo{font-weight:800;font-size:18px;color:#ffc845}a{display:inline-block;margin-top:28px;color:#c9cce6;font-size:13px;text-decoration:underline}</style></head>
<body><main><div class="logo">${site}</div><h1>Bakımdayız</h1><p>${escapeHtml(state.message)}</p><a href="/giris?next=/">Yönetici girişi</a></main></body></html>`;
}
