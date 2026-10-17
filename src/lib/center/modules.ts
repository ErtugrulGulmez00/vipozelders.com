// Kurumun açıp kapatabildiği modüller. Kapalı modül menüde görünmez, sayfaları açılmaz; kayıtlar silinmez.
// Öğrenciler, sınıflar, program, yoklama, duyurular, personel, ayarlar ve abonelik her zaman açıktır.

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
] as const;

export type CenterModuleKey = (typeof OPTIONAL_MODULES)[number]["key"];

const KEYS = new Set<string>(OPTIONAL_MODULES.map((m) => m.key));

export function isModuleKey(value: string): value is CenterModuleKey {
  return KEYS.has(value);
}

export function moduleEnabled(center: { disabledModules: string[] }, key: CenterModuleKey): boolean {
  return !center.disabledModules.includes(key);
}

/** /kurum/<modül>/... adresinin modülü (isteğe bağlı modül değilse null). */
export function moduleForPath(pathname: string): CenterModuleKey | null {
  const segment = pathname.split("/")[2] ?? "";
  return isModuleKey(segment) ? segment : null;
}
