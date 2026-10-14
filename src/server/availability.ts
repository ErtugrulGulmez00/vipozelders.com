import { addDaysToDateString, isoWeekday, toLocalDateString, zonedDateTime } from "@/lib/dates";

// Boş saat üretimi. Saf fonksiyonlar; veritabanı yükleyicisi booking servisinde.

export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number };

export type DayException = {
  date: string;
  type: "BLOCKED" | "EXTRA";
  startMinute: number | null;
  endMinute: number | null;
};

/** Mevcut randevu: [başlangıç, bitiş + tampon) */
export type BusyRange = { start: Date; end: Date };

export type SlotQuery = {
  rules: WeeklyRule[];
  exceptions: DayException[];
  busy: BusyRange[];
  durationMinutes: number;
  bufferMinutes: number;
  startDate: string;
  days: number;
  now: Date;
  minNoticeHours: number;
  maxAdvanceDays: number;
  stepMinutes?: number;
};

export type Slot = { start: Date; end: Date; available: boolean };
export type SlotDay = { date: string; slots: Slot[] };

type Interval = [number, number];

function mergeIntervals(intervals: Interval[]): Interval[] {
  const sorted = intervals.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
  const merged: Interval[] = [];
  for (const [start, end] of sorted) {
    const last = merged[merged.length - 1];
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return merged;
}

function subtractInterval(intervals: Interval[], [cutStart, cutEnd]: Interval): Interval[] {
  const result: Interval[] = [];
  for (const [start, end] of intervals) {
    if (cutEnd <= start || cutStart >= end) {
      result.push([start, end]);
      continue;
    }
    if (cutStart > start) result.push([start, cutStart]);
    if (cutEnd < end) result.push([cutEnd, end]);
  }
  return result;
}

/** Bir günün müsait aralıkları (dakika): haftalık şablon + ek saatler − izinler. */
export function dayIntervals(date: string, rules: WeeklyRule[], exceptions: DayException[]): Interval[] {
  const weekday = isoWeekday(date);
  const todays = exceptions.filter((e) => e.date === date);
  const wholeDayBlocked = todays.some((e) => e.type === "BLOCKED" && e.startMinute === null);

  let intervals: Interval[] = wholeDayBlocked
    ? []
    : rules.filter((r) => r.weekday === weekday).map((r) => [r.startMinute, r.endMinute] as Interval);

  for (const extra of todays) {
    if (extra.type === "EXTRA" && extra.startMinute !== null && extra.endMinute !== null) {
      intervals.push([extra.startMinute, extra.endMinute]);
    }
  }
  intervals = mergeIntervals(intervals);

  for (const block of todays) {
    if (block.type === "BLOCKED" && block.startMinute !== null && block.endMinute !== null) {
      intervals = subtractInterval(intervals, [block.startMinute, block.endMinute]);
    }
  }
  return intervals;
}

function overlaps(start: number, end: number, busy: BusyRange[]): boolean {
  return busy.some((b) => start < b.end.getTime() && b.start.getTime() < end);
}

/**
 * Seçilen süre için günlere göre saatleri üretir. Dersler yalnızca tam saatte başlar (17:00, 18:00…)
 * ve en fazla bir saat sürer; böylece farklı süreli dersler birbirinin saatini bölmez. Erken haber süresi içinde kalan ya da
 * en geç randevu sınırını aşan saatler hiç gösterilmez; dolu saatler available=false döner.
 */
export function generateSlots(query: SlotQuery): SlotDay[] {
  const step = query.stepMinutes ?? 60;
  const earliest = query.now.getTime() + query.minNoticeHours * 3_600_000;
  const latestDate = addDaysToDateString(toLocalDateString(query.now), query.maxAdvanceDays);
  const durationMs = query.durationMinutes * 60_000;
  // Saat başı düzende 45 dakikalık ders kendiliğinden mola bırakır; tampon süre artık kullanılmaz.
  const blockMs = durationMs;

  const result: SlotDay[] = [];
  for (let i = 0; i < query.days; i++) {
    const date = addDaysToDateString(query.startDate, i);
    if (date > latestDate) break;

    const slots: Slot[] = [];
    for (const [intervalStart, intervalEnd] of dayIntervals(date, query.rules, query.exceptions)) {
      const firstMinute = Math.ceil(intervalStart / step) * step;
      for (let minute = firstMinute; minute + query.durationMinutes <= intervalEnd; minute += step) {
        const start = zonedDateTime(date, minute);
        if (start.getTime() < earliest) continue;
        const available = !overlaps(start.getTime(), start.getTime() + blockMs, query.busy);
        slots.push({ start, end: new Date(start.getTime() + durationMs), available });
      }
    }
    result.push({ date, slots });
  }
  return result;
}

/** İstenen başlangıç saati gerçekten seçilebilir boş bir saat mi? */
export function isSlotAvailable(query: Omit<SlotQuery, "startDate" | "days">, start: Date): boolean {
  const date = toLocalDateString(start);
  const [day] = generateSlots({ ...query, startDate: date, days: 1 });
  return Boolean(day?.slots.some((slot) => slot.available && slot.start.getTime() === start.getTime()));
}
