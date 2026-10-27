const TURKISH_FOLD: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  İ: "i",
  I: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
  â: "a",
  Â: "a",
  î: "i",
  Î: "i",
  û: "u",
  Û: "u",
};

/** Türkçe karakterleri ASCII karşılıklarına çevirir (ş → s, İ → i). */
export function foldTurkish(input: string): string {
  return input.replace(/[çÇğĞıİIöÖşŞüÜâÂîÎûÛ]/g, (ch) => TURKISH_FOLD[ch] ?? ch);
}

function stripMarks(input: string): string {
  return input.normalize("NFKD").replace(/[̀-ͯ]/g, "");
}

/** "Ayşe Yılmaz" → "ayse-yilmaz" */
export function slugify(input: string): string {
  return stripMarks(foldTurkish(input).toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Arama için sadeleştirilmiş metin: "İnkılap Tarihi" → "inkilap tarihi" */
export function normalizeSearch(input: string): string {
  return stripMarks(foldTurkish(input).toLowerCase())
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

/** Vitrinde öğretmen adını "Ayşe Y." biçiminde gösterir. */
export function shortName(person: { firstName: string; lastName: string }): string {
  const initial = person.lastName.trim().charAt(0).toLocaleUpperCase("tr-TR");
  return initial ? `${person.firstName} ${initial}.` : person.firstName;
}

export function initials(person: { firstName: string; lastName: string }): string {
  return `${person.firstName.charAt(0)}${person.lastName.charAt(0)}`.toLocaleUpperCase("tr-TR");
}

/** Türkiye cep telefonunu 05XXXXXXXXX biçimine getirir; geçersizse null. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  const national = digits.startsWith("90") ? digits.slice(2) : digits.startsWith("0") ? digits.slice(1) : digits;
  if (!/^5\d{9}$/.test(national)) return null;
  return `0${national}`;
}

/** IBAN'ı boşluksuz büyük harfe çevirir ve TR IBAN biçimini mod-97 ile doğrular. */
export function normalizeIban(input: string): string | null {
  const iban = input.replace(/\s/g, "").toUpperCase();
  if (!/^TR\d{24}$/.test(iban)) return null;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let remainder = 0;
  for (const digit of numeric) {
    remainder = (remainder * 10 + Number(digit)) % 97;
  }
  return remainder === 1 ? iban : null;
}

/** T.C. kimlik numarası algoritma kontrolü. */
export function isValidTckn(input: string): boolean {
  if (!/^[1-9]\d{10}$/.test(input)) return false;
  const d = input.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, n) => sum + n, 0) % 10;
  return d[9] === tenth && d[10] === eleventh;
}

/**
 * Platform dışına yönlendirmeyi önlemek için metindeki iletişim bilgilerini gizler: e-posta, telefon (araya boşluk,
 * nokta, tire konmuş hâlleri dahil), web adresi ve @kullanıcıadı.
 */
export function maskContacts(input: string): string {
  return input
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[iletişim bilgisi gizlendi]")
    .replace(/(https?:\/\/|www\.)\S+/gi, "[bağlantı gizlendi]")
    .replace(/\b[\w-]+\.(com|net|org|me|io|co|tr|app|link)(\.tr)?\b\S*/gi, "[bağlantı gizlendi]")
    // Rakamlar arasındaki boşluk/ayraçlar telefona dahil; sondaki boşluk metinde kalır
    .replace(/\+?\d(?:[\s.\-()]*\d){9,}/g, "[telefon gizlendi]")
    .replace(/(^|\s)@[a-z0-9_.]{3,}/gi, "$1[kullanıcı adı gizlendi]");
}