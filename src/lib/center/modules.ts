// Kurumun açıp kapatabildiği modüller. Kapalı modül menüde görünmez, sayfaları açılmaz; kayıtlar silinmez.
// Öğrenciler, sınıflar, duyurular, personel, ayarlar ve abonelik her zaman açıktır.

export const OPTIONAL_MODULES = [
  { key: "etutler", label: "Etütler", hint: "Birebir / küçük grup etüt planı" },
  { key: "odevler", label: "Ödevler", hint: "Ödev verme ve teslim kontrolü" },
  { key: "kaynaklar", label: "Kaynaklar ve kitaplar", hint: "Kaynak, konu ilerlemesi ve haftalık çalışma programı" },
  { key: "kocluk", label: "Koçluk", hint: "Haftalık koç görüşmeleri" },
  { key: "calisma-salonu", label: "Çalışma salonu", hint: "Kütüphane / salon periyot yoklaması" },
  { key: "sinif-defteri", label: "Sınıf defteri", hint: "Derste işlenen konular" },
  { key: "sorular", label: "Öğrenci soruları", hint: "Öğrencinin fotoğrafla soru göndermesi" },
  { key: "denemeler", label: "Denemeler", hint: "Deneme sınavları, optik, karne, kelebek" },
  { key: "muhasebe", label: "Muhasebe", hint: "Ödeme planı, tahsilat, makbuz, gider" },
  { key: "on-kayit", label: "Ön kayıtlar", hint: "Vitrin formundan gelen adaylar" },
  { key: "lgs-tercih", label: "LGS tercih robotu", hint: "Puan / yüzdelik dilime göre lise önerisi ve öğrencinin tercih listesi" },
  { key: "yks-tercih", label: "YKS tercih robotu", hint: "Puan / başarı sırasına göre program önerisi ve öğrencinin tercih listesi" },
  { key: "asistan", label: "Yapay zekâ asistanı", hint: "Öğrenci sayfasında haftalık yorum, özet ve yol haritası önerisi (yalnızca öğretmen görür)" },
] as const;

export type CenterModuleKey = (typeof OPTIONAL_MODULES)[number]["key"];

const KEYS = new Set<string>(OPTIONAL_MODULES.map((m) => m.key));

export function isModuleKey(value: string): value is CenterModuleKey {
  return KEYS.has(value);
}

export function moduleEnabled(center: { disabledModules: string[] }, key: CenterModuleKey): boolean {
  return !center.disabledModules.includes(key);
}

// Dershane bölümleri (sınıf programı, sınıf yoklaması, sınıf defteri, derslik, sınıf raporları) şimdilik yalnızca
// türü Dershane olan kurumda açılır; etüt merkezinde yoklama etütten ve çalışma salonundan alınır.
export const DERSHANE_SECTIONS = new Set(["program", "yoklama", "sinif-defteri", "derslikler", "raporlar"]);

// Pi Koç: bireysel koç hesabı kurum paneli yerine kendi paneli /koc'u kullanır; bu modüller koçta kapalı tutulur.
const COACH_HIDDEN_SECTIONS = new Set(["siniflar", "program", "yoklama", "etutler", "calisma-salonu", "sinif-defteri", "derslikler", "raporlar", "on-kayit", "personel"]);
/** Koç hesabı açılırken kapatılan isteğe bağlı modüller */
export const COACH_DISABLED_MODULES: CenterModuleKey[] = OPTIONAL_MODULES.filter((m) => COACH_HIDDEN_SECTIONS.has(m.key)).map((m) => m.key);
/** Yönetici öğrenci sınırını kurum sayfasından değiştirir. */
export const COACH_DEFAULT_STUDENT_LIMIT = 10;

export function coachAllows(section: string): boolean {
  return !COACH_HIDDEN_SECTIONS.has(section);
}

/** Kurum panelindeki bölüm (/kurum/<bölüm>) bu kurum türünde açık mı? */
export function sectionAllowed(center: { kind: string }, section: string): boolean {
  if (center.kind === "COACH") return coachAllows(section);
  return center.kind === "DERSHANE" || !DERSHANE_SECTIONS.has(section);
}

/** /kurum/<modül>/... adresinin modülü (isteğe bağlı modül değilse null). */
export function moduleForPath(pathname: string): CenterModuleKey | null {
  const segment = pathname.split("/")[2] ?? "";
  return isModuleKey(segment) ? segment : null;
}
