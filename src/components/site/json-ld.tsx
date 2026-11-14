// Arama motorları ve yapay zekâ tarayıcıları için yapısal veri (schema.org, JSON-LD).
// Sayfada görünmez; içerik sayfadaki bilgilerle aynı olmalıdır.

export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}

export function siteBase(): string {
  return (process.env.APP_URL ?? "https://pikampus.com").replace(/\/$/, "");
}

/** Soru-cevap listesi → FAQPage */
export function faqJsonLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({ "@type": "Question", name: i.q, acceptedAnswer: { "@type": "Answer", text: i.a } })),
  };
}

/** "## Soru" + cevap paragrafları biçimindeki metinden soru-cevap listesi (SSS sayfası) */
export function faqFromMarkdown(content: string): { q: string; a: string }[] {
  return content
    .split(/^## /m)
    .slice(1)
    .map((block) => {
      const [q, ...rest] = block.split("\n");
      return { q: q.trim(), a: rest.join(" ").replace(/\s+/g, " ").trim() };
    })
    .filter((x) => x.q.endsWith("?") && x.a);
}

/** Konum zinciri → BreadcrumbList */
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((i, index) => ({ "@type": "ListItem", position: index + 1, name: i.name, item: `${base}${i.path}` })),
  };
}

/** Yazılım ürünü ve fiyatları → SoftwareApplication (fiyatlar TL) */
export function softwareJsonLd({ name, description, path, offers, taxIncluded }: { name: string; description: string; path: string; offers: { name: string; priceTl: number }[]; taxIncluded: boolean }) {
  const base = siteBase();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name,
    description,
    url: `${base}${path}`,
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web, Android",
    inLanguage: "tr",
    publisher: { "@type": "Organization", name: "Pi Kampüs", url: base },
    offers: offers.map((o) => ({
      "@type": "Offer",
      name: o.name,
      price: o.priceTl,
      priceCurrency: "TRY",
      priceSpecification: { "@type": "UnitPriceSpecification", price: o.priceTl, priceCurrency: "TRY", unitText: "MONTH", valueAddedTaxIncluded: taxIncluded },
      url: `${base}${path}`,
    })),
  };
}
