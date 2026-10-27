import { TZDate } from "@date-fns/tz";

/** Türkiye 2016'dan beri sabit UTC+3; yine de hesaplar saat dilimi kütüphanesiyle yapılır. */
export const TIME_ZONE = "Europe/Istanbul";

const pad = (n: number) => String(n).padStart(2, "0");

/** Bir anın İstanbul'daki takvim günü: "2026-10-12" */
export function toLocalDateString(date: Date, timeZone = TIME_ZONE): string {
  const z = new TZDate(date.getTime(), timeZone);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** Bir anın İstanbul'da günün kaçıncı dakikası olduğu. */
export function toLocalMinutes(date: Date, timeZone = TIME_ZONE): number {
  const z = new TZDate(date.getTime(), timeZone);
  return z.getHours() * 60 + z.getMinutes();
}

/** "2026-10-12" + 1080 dk (18:00) → o anın UTC karşılığı. */
export function zonedDateTime(dateString: string, minutes: number, timeZone = TIME_ZONE): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const z = new TZDate(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, timeZone);
  return new Date(z.getTime());
}

/** ISO hafta günü (1 = Pazartesi ... 7 = Pazar) */
export function isoWeekday(dateString: string): number {
  const [year, month, day] = dateString.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** @db.Date alanından gelen değeri "YYYY-MM-DD" biçimine çevirir. */
export function dbDateToString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function dateStringToDbDate(dateString: string): Date {
  return new Date(`${dateString}T00:00:00.000Z`);
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** 1080 → "18:00" */
export function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** "18:30" → 1110; geçersizse null */
export function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59 || (hours === 24 && minutes > 0)) return null;
  return hours * 60 + minutes;
}

export const WEEKDAY_NAMES = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
export const WEEKDAY_SHORT = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const dateTimeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
  weekday: "long",
  hour: "2-digit",
  minute: "2-digit",
});

const dateFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

const compactFormat = new Intl.DateTimeFormat("tr-TR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** "12 Ekim 2026 Pazartesi 18:00" */
export function formatDateTime(date: Date): string {
  return dateTimeFormat.format(date);
}

/** "12 Ekim 2026" */
export function formatDate(date: Date): string {
  return dateFormat.format(date);
}

/** "18:00" */
export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

/** "12.10.2026 18:00" */
export function formatCompact(date: Date): string {
  return compactFormat.format(date);
}

/** "12 Ekim 2026 Pazartesi, 18:00–19:00" */
export function formatLessonRange(start: Date, end: Date): string {
  return `${formatDateTime(start).replace(/\s(\d{2}:\d{2})$/, ", $1")}–${formatTime(end)}`;
}

/** Bir "YYYY-MM-DD" günü için başlık: "Pzt 12 Eki" */
export function formatDayLabel(dateString: string): { weekday: string; day: string } {
  const date = zonedDateTime(dateString, 12 * 60);
  const weekday = WEEKDAY_SHORT[isoWeekday(dateString) - 1];
  const day = new Intl.DateTimeFormat("tr-TR", { timeZone: TIME_ZONE, day: "numeric", month: "short" }).format(date);
  return { weekday, day };
}

/** "3 saat 20 dakika" gibi kalan süre metni */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} gün`);
  if (hours) parts.push(`${hours} saat`);
  if (minutes && !days) parts.push(`${minutes} dakika`);
  return parts.length ? parts.join(" ") : "1 dakikadan az";
}
