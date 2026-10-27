// Kurum paketleri. Etüt Merkezi: birebir takip, etüt, ödev ve odaklı çalışma. Dershane: Etüt Merkezi'ndeki her şey
// + sınıf bazlı toplu program ve yoklama, sınıf defteri, deneme/optik analiz, derslik yönetimi, kurum raporları.
// Pakette olmayan bölüm menüde görünmez, sayfası açılmaz (kayıtlar silinmez; paket yükseltilince geri gelir).

export type CenterEditionName = "ETUT" | "DERSHANE";
export const CENTER_EDITIONS: CenterEditionName[] = ["ETUT", "DERSHANE"];

/** Yalnızca Dershane paketinde açık bölümler (/kurum/<bölüm>) */
export const DERSHANE_SECTIONS = ["program", "yoklama", "sinif-defteri", "denemeler", "derslikler", "raporlar"] as const;
export type DershaneSection = (typeof DERSHANE_SECTIONS)[number];

const DERSHANE_ONLY = new Set<string>(DERSHANE_SECTIONS);

export const EDITIONS: Record<CenterEditionName, { name: string; tagline: string; features: string[] }> = {
  ETUT: {
    name: "Etüt Merkezi",
    tagline: "Birebir takip ve odaklı çalışma",
    features: [
      "Öğrenci ve veli kayıtları, Excel'den aktarım",
      "Birebir öğrenci takibi, koçluk görüşmeleri",
      "Etüt planlama, etüt yoklaması ve devamsızlık bildirimi",
      "Ödev verme ve teslim kontrolü",
      "Çalışma salonu (odaklı çalışma) yoklaması",
      "Kaynak, kitap ve haftalık çalışma programı",
      "Fotoğrafla soru, veli ve öğrenci portalı",
      "Ödeme planı, tahsilat, makbuz, gider takibi",
      "Sınırsız personel hesabı",
    ],
  },
  DERSHANE: {
    name: "Dershane",
    tagline: "Sınıf bazlı, kapsayıcı yönetim",
    features: [
      "Etüt Merkezi paketindeki her şey",
      "Sınıflar ve haftalık toplu ders programı",
      "Sınıf bazlı yoklama ve sınıf defteri",
      "Deneme sınavları, optik okuma, konu bazında eksik analizi",
      "Derslik yönetimi: doluluk ve çakışma kontrolü",
      "Kurum → sınıf → öğrenci hiyerarşik raporlar",
    ],
  },
};

/** /kurum/<bölüm> adresinin bölümü bu pakette açık mı. */
export function editionAllows(edition: CenterEditionName, section: string): boolean {
  return edition === "DERSHANE" || !DERSHANE_ONLY.has(section);
}

/** Adresteki bölüm Dershane'ye özelse adı (paket kontrolü için), değilse null. */
export function dershaneSectionForPath(pathname: string): DershaneSection | null {
  const segment = pathname.split("/")[2] ?? "";
  return DERSHANE_ONLY.has(segment) ? (segment as DershaneSection) : null;
}
