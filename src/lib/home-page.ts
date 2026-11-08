// Ana sayfadaki, Site ayarlarından doldurulan alanlar. Boş bırakılan alan sayfada görünmez.

export type HomeTestimonial = { quote: string; name: string; center: string };

/** Her satır bir yorum: "Yorum | Kişi | Kurum, il". Kişi ve kurum isteğe bağlı. */
export function parseHomeTestimonials(raw: string): HomeTestimonial[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.split("|").map((part) => part.trim()))
    .filter(([quote]) => quote)
    .slice(0, 6)
    .map(([quote, name = "", center = ""]) => ({ quote, name, center }));
}

/** Teklif satırında iki noktadan önceki kısım kalın gösterilir ("Kurucu kurum teklifi: …"). */
export function splitOfferLead(text: string): { lead: string | null; rest: string } {
  const index = text.indexOf(":");
  if (index <= 0 || index > 60) return { lead: null, rest: text.trim() };
  return { lead: text.slice(0, index + 1).trim(), rest: text.slice(index + 1).trim() };
}
