/** Dakikayı okunur süreye çevirir: 45 → "45 dk", 90 → "1 sa 30 dk". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} dk`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}
