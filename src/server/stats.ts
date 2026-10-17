import { createHash } from "node:crypto";
import { addDaysToDateString, dateStringToDbDate, toLocalDateString } from "@/lib/dates";
import { db } from "./db";

// Çerezsiz ziyaret istatistiği. Kişisel veri saklanmaz: IP ve tarayıcı bilgisi, her gün değişen bir tuzla
// tek yönlü özetlenir (aynı kişi ertesi gün farklı sayılır, geriye dönük kimlik çıkarılamaz). Çerez onayı gerekmez.

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|facebookexternalhit|whatsapp|telegram|curl|wget|python|axios|node-fetch|monitor|uptime/i;
const KEEP_DAYS = 400;

export function deviceOf(userAgent: string): "mobile" | "tablet" | "desktop" {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(userAgent)) return "tablet";
  if (/mobi|iphone|android/i.test(userAgent)) return "mobile";
  return "desktop";
}

/** Yalnızca başka sitelerden gelen yönlendirmenin alan adı (ör. google.com). */
export function referrerHost(referrer: string | null | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    return host && host !== ownHost.replace(/^www\./, "") ? host.slice(0, 100) : null;
  } catch {
    return null;
  }
}

/** Kişisel veri içermeyen yol: sorgu parametreleri ve kimlik benzeri parçalar atılır. */
export function normalizePath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("/api/") || path.startsWith("/_next/")) return null;
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  // Kişiye özel sayfalar (ödeme, davet, şifre bağlantıları) sayılmaz
  if (/^\/(odeme|kurum-davet|sifre-sifirla|eposta-dogrula|ders)\//.test(clean)) return null;
  return clean.slice(0, 200);
}

export async function recordPageView(input: { path: string; referrer: string | null; userAgent: string; ip: string | null; ownHost: string }, now = new Date()) {
  if (!input.userAgent || BOT.test(input.userAgent)) return;
  const path = normalizePath(input.path);
  if (!path) return;
  const day = toLocalDateString(now);
  const visitor = createHash("sha256")
    .update(`${day}|${process.env.APP_SECRET ?? ""}|${input.ip ?? ""}|${input.userAgent}`)
    .digest("hex")
    .slice(0, 24);
  await db.pageView.create({
    data: { day: dateStringToDbDate(day), path, referrer: referrerHost(input.referrer, input.ownHost), device: deviceOf(input.userAgent), visitor },
  });
}

/** Yönetim istatistik ekranı için özet. */
export async function statsSummary(days: number, now = new Date()) {
  const today = toLocalDateString(now);
  const from = addDaysToDateString(today, -(days - 1));
  const where = { day: { gte: dateStringToDbDate(from) } };
  const [perDay, visitorsPerDay, pages, referrers, devices, totalVisitors] = await Promise.all([
    db.pageView.groupBy({ by: ["day"], where, _count: true, orderBy: { day: "asc" } }),
    db.$queryRaw<{ day: Date; visitors: bigint }[]>`SELECT "day", COUNT(DISTINCT "visitor") AS visitors FROM "PageView" WHERE "day" >= ${dateStringToDbDate(from)} GROUP BY "day"`,
    db.pageView.groupBy({ by: ["path"], where, _count: true, orderBy: { _count: { path: "desc" } }, take: 15 }),
    db.pageView.groupBy({ by: ["referrer"], where: { ...where, referrer: { not: null } }, _count: true, orderBy: { _count: { referrer: "desc" } }, take: 10 }),
    db.pageView.groupBy({ by: ["device"], where, _count: true }),
    db.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT ("day", "visitor")) AS n FROM "PageView" WHERE "day" >= ${dateStringToDbDate(from)}`,
  ]);
  const visitors = new Map(visitorsPerDay.map((r) => [toLocalDateString(r.day, "UTC"), Number(r.visitors)]));
  const views = new Map(perDay.map((r) => [toLocalDateString(r.day, "UTC"), r._count]));
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDaysToDateString(from, i);
    return { day, views: views.get(day) ?? 0, visitors: visitors.get(day) ?? 0 };
  });
  return {
    series,
    totalViews: series.reduce((t, d) => t + d.views, 0),
    totalVisitors: Number(totalVisitors[0]?.n ?? 0),
    pages: pages.map((p) => ({ path: p.path, views: p._count })),
    referrers: referrers.map((r) => ({ host: r.referrer!, views: r._count })),
    devices: devices.map((d) => ({ device: d.device, views: d._count })),
  };
}

/** Eski kayıtları siler (zamanlayıcı, günde bir kez yeterli; her turda ucuzdur). */
export async function pruneStats(now = new Date()): Promise<number> {
  const cutoff = dateStringToDbDate(addDaysToDateString(toLocalDateString(now), -KEEP_DAYS));
  return (await db.pageView.deleteMany({ where: { day: { lt: cutoff } } })).count;
}
