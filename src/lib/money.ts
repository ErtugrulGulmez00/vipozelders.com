// Para tutarları uygulama içinde kuruş cinsinden tam sayı olarak taşınır.

const wholeFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const centsFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 125000 → "₺1.250", 125050 → "₺1.250,50" */
export function formatMoney(kurus: number): string {
  return (kurus % 100 === 0 ? wholeFormatter : centsFormatter).format(kurus / 100);
}

/** Kullanıcının yazdığı tutarı kuruşa çevirir: "1.250", "1250", "1250,50", "1250.5" */
export function parseMoneyInput(value: string): number | null {
  const cleaned = value.trim().replace(/\s|₺|tl/gi, "");
  if (!cleaned) return null;

  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100);
}

/** 1500 baz puan → "%15" */
export function formatBps(bps: number): string {
  return `%${(bps / 100).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`;
}
