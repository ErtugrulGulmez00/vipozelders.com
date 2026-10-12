import { addDaysToDateString } from "@/lib/dates";

// Kurum muhasebesi: taksit planı, tahsilatın taksitlere dağıtılması, taksit durumu ve yazıyla tutar.
// Tutarlar kuruş cinsinden tam sayıdır.

export type PlannedInstallment = { order: number; dueDate: string; amount: number };

/** "2026-01-31" + 1 ay → "2026-02-28" (ay sonu taşmaz) */
export function addMonthsToDateString(dateString: string, months: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const targetMonth = month - 1 + months;
  const lastDay = new Date(Date.UTC(year, targetMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, targetMonth, Math.min(day, lastDay))).toISOString().slice(0, 10);
}

/**
 * Net tutarı taksitlere böler. Taksitler tam lira olur, artan kuruşlar ilk taksite eklenir.
 * Peşinat varsa ilk satır peşinattır ve kalan tutar aylık taksitlere bölünür.
 */
export function buildInstallments(input: {
  netAmount: number;
  count: number;
  firstDueDate: string;
  downPayment?: number;
  downPaymentDate?: string;
  intervalDays?: number;
}): PlannedInstallment[] {
  const { netAmount, count, firstDueDate } = input;
  const downPayment = Math.min(Math.max(input.downPayment ?? 0, 0), netAmount);
  const rows: PlannedInstallment[] = [];
  if (downPayment > 0) rows.push({ order: 1, dueDate: input.downPaymentDate ?? firstDueDate, amount: downPayment });
  const rest = netAmount - downPayment;
  if (rest > 0) {
    const n = Math.max(1, Math.floor(count));
    const base = Math.floor(rest / n / 100) * 100;
    const first = rest - base * (n - 1);
    for (let i = 0; i < n; i++) {
      const dueDate = input.intervalDays ? addDaysToDateString(firstDueDate, i * input.intervalDays) : addMonthsToDateString(firstDueDate, i);
      rows.push({ order: rows.length + 1, dueDate, amount: i === 0 ? first : base });
    }
  }
  return rows;
}

export type OpenInstallment = { id: string; order: number; dueDate: string; amount: number; paidAmount: number };

/** Tahsilatı en eski vadeli taksitten başlayarak dağıtır; borçtan fazlası "unallocated" kalır. */
export function allocatePayment(installments: OpenInstallment[], amount: number): { allocations: { installmentId: string; amount: number }[]; unallocated: number } {
  const ordered = [...installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.order - b.order);
  const allocations: { installmentId: string; amount: number }[] = [];
  let remaining = amount;
  for (const inst of ordered) {
    if (remaining <= 0) break;
    const open = inst.amount - inst.paidAmount;
    if (open <= 0) continue;
    const take = Math.min(open, remaining);
    allocations.push({ installmentId: inst.id, amount: take });
    remaining -= take;
  }
  return { allocations, unallocated: remaining };
}

export type InstallmentState = "paid" | "partial" | "overdue" | "due" | "upcoming";

/** Bugüne göre taksit durumu: ödendi / kısmen ödendi / gecikti / bugün / gelecek. */
export function installmentState(inst: { dueDate: string; amount: number; paidAmount: number }, today: string): InstallmentState {
  if (inst.paidAmount >= inst.amount) return "paid";
  if (inst.dueDate < today) return "overdue";
  if (inst.dueDate === today) return "due";
  return inst.paidAmount > 0 ? "partial" : "upcoming";
}

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const SCALES = ["", "bin", "milyon", "milyar", "trilyon"];

function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(hundreds === 1 ? "yüz" : `${ONES[hundreds]} yüz`);
  if (Math.floor(rest / 10)) parts.push(TENS[Math.floor(rest / 10)]);
  if (rest % 10) parts.push(ONES[rest % 10]);
  return parts.join(" ");
}

/** 1250 → "bin iki yüz elli" */
export function numberToTurkishWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "sıfır";
  const groups: string[] = [];
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk) {
      // "bir bin" denmez: 1000 → "bin"
      const words = scale === 1 && chunk === 1 ? "" : threeDigits(chunk);
      groups.unshift([words, SCALES[scale]].filter(Boolean).join(" "));
    }
    n = Math.floor(n / 1000);
    scale++;
  }
  return groups.join(" ");
}

/** Makbuz için: 250050 → "Yalnız iki bin beş yüz Türk lirası elli kuruş" */
export function amountInWords(kurus: number): string {
  const lira = Math.floor(kurus / 100);
  const cents = kurus % 100;
  return `Yalnız ${numberToTurkishWords(lira)} Türk lirası${cents ? ` ${numberToTurkishWords(cents)} kuruş` : ""}`;
}
