import { describe, expect, it } from "vitest";
import { parseHomeTestimonials, splitOfferLead } from "@/lib/home-page";

describe("ana sayfa ayar alanları", () => {
  it("yorumlar satır satır okunur; kişi ve kurum isteğe bağlı, boş satır atlanır", () => {
    expect(parseHomeTestimonials("Çok iyi | Ayşe Y. | Örnek Etüt, Bitlis\r\n\r\nYalnız yorum")).toEqual([
      { quote: "Çok iyi", name: "Ayşe Y.", center: "Örnek Etüt, Bitlis" },
      { quote: "Yalnız yorum", name: "", center: "" },
    ]);
    expect(parseHomeTestimonials("")).toEqual([]);
  });

  it("teklif satırında iki noktadan önceki kısım ayrılır", () => {
    expect(splitOfferLead("Kurucu kurum teklifi: ilk yıl %40 indirim")).toEqual({ lead: "Kurucu kurum teklifi:", rest: "ilk yıl %40 indirim" });
    expect(splitOfferLead("İlk yıl %40 indirim")).toEqual({ lead: null, rest: "İlk yıl %40 indirim" });
  });
});
