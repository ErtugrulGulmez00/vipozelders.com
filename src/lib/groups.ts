import { formatDate, formatTime, isoWeekday, toLocalDateString, WEEKDAY_NAMES } from "./dates";

/** Grup dersi programının kısa özeti: "8 oturum · Salı ve Perşembe 19:00 · 60 dk · başlangıç 14 Ocak 2030". */
export function scheduleSummary(sessions: { startAt: Date; endAt: Date }[]): string {
  if (!sessions.length) return "Program yok";
  const first = sessions[0];
  const days = [...new Set(sessions.map((s) => isoWeekday(toLocalDateString(s.startAt))))].sort();
  const names = days.map((d) => WEEKDAY_NAMES[d - 1]);
  const dayText = names.length > 1 ? `${names.slice(0, -1).join(", ")} ve ${names[names.length - 1]}` : names[0];
  const minutes = Math.round((first.endAt.getTime() - first.startAt.getTime()) / 60_000);
  return `${sessions.length} oturum · ${dayText} ${formatTime(first.startAt)} · ${minutes} dk · başlangıç ${formatDate(first.startAt)}`;
}
