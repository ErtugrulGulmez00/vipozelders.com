import { formatMoney } from "@/lib/money";
import { COACH_FEATURES, COACH_FREE_NAME, parseCoachTiers } from "@/lib/pi-koc";
import { centerPlans } from "@/server/center/plans";
import { getSiteSettings } from "@/server/site";

// Yapay zekâ asistanları için site özeti (llmstxt.org biçimi). Fiyatlar site ayarlarından gelir.

export async function GET() {
  const settings = await getSiteSettings();
  const base = (process.env.APP_URL ?? "https://pikampus.com").replace(/\/$/, "");
  const tl = (n: number) => formatMoney(n * 100);
  const plans = centerPlans(settings);
  const tiers = parseCoachTiers(settings.piKocTiers);

  const lines = [
    `# ${settings.siteName}`,
    "",
    `> ${settings.siteName}, Türkiye'de etüt merkezleri için kurum yönetim paneli, öğrenci koçları ve özel ders öğretmenleri için Pi Koç öğrenci takip paneli ve velilerin özel ders öğretmeni bulduğu bir vitrin sunan eğitim yazılımıdır. LGS ve YKS hazırlığına odaklanır. Web sitesi: ${base}`,
    "",
    "## Ürünler",
    "",
    `- [Kurum paneli](${base}/kurumlar-icin): Etüt merkezleri ve dershaneler için öğrenci ve veli takibi, yoklama ve devamsızlık bildirimi, etüt planı, ödev, deneme analizi ve eksik konular, ödeme planı, tahsilat ve makbuz, veli portalı, LGS ve YKS tercih robotu, yapay zekâ asistanı.`,
    `- [Pi Koç](${base}/pi-koc): Öğrenci koçları ve özel ders öğretmenleri için öğrenci takip paneli. Haftalık program, soru ve deneme takibi, görüşme notları, görüntülü görüşme, haftalık veli raporu, hedef okul takibi ve tercih robotu. ${settings.piKocFreeStudents} öğrenciye kadar ücretsizdir.`,
    `- [Özel ders vitrini](${base}/ozel-ders): Veliler onaylı öğretmen profillerini inceler ve ücretsiz ders talebi gönderir. ${settings.siteName} ders ücretine aracılık etmez, komisyon almaz; ders ücreti doğrudan öğretmene ödenir.`,
    `- [Tercih robotu](${base}/tercih-robotu): LGS ve YKS için ücretsiz tercih robotu. Puan, başarı sırası ya da yüzdelik dilime göre okulları ve programları güvenli, uygun, riskli diye ayırır. YKS taban puanları ÖSYM'den alınır.`,
    "",
    "## Fiyatlar",
    "",
    "Kurum paneli (aylık, KDV hariç):",
    ...plans.map((p) => (p.quote || !p.priceTl ? `- ${p.name}: teklif ile` : `- ${p.name}: ${tl(p.priceTl)}/ay${p.yearlyPriceTl ? ` (yıllık peşin ${tl(p.yearlyPriceTl)})` : ""}`)),
    "",
    "Pi Koç (aylık, KDV dahil):",
    ...(settings.piKocFreeStudents > 0 ? [`- ${COACH_FREE_NAME}: ücretsiz, ${settings.piKocFreeStudents} öğrenciye kadar`] : []),
    ...tiers.map((t) => `- ${t.name}: ${tl(t.priceTl)}/ay, ${t.students} öğrenciye kadar`),
    "",
    `Pi Koç ücretli paketlerinde açılanlar: ${Object.values(COACH_FEATURES)
      .map((f) => f.title)
      .join(", ")}.`,
    "",
    "## Rehberler",
    "",
    `- [Nasıl çalışır: etüt merkezi](${base}/nasil-calisir/etut-merkezi)`,
    `- [Nasıl çalışır: özel ders](${base}/nasil-calisir/ozel-ders)`,
    `- [Rehber yazıları](${base}/rehber): LGS ve YKS tercihi, deneme sonuçlarını okuma, çalışma programı, etüt merkezi yönetimi`,
    `- [Sıkça sorulan sorular](${base}/sayfa/sss)`,
    "",
    "## İletişim ve şirket",
    "",
    `- E-posta: ${settings.contactEmail}`,
    `- Telefon: ${settings.contactPhone}`,
    `- Satıcı: ${settings.companyName || settings.siteName}, Süleymanpaşa / Tekirdağ`,
    `- [Kullanım şartları](${base}/sayfa/kullanim-sartlari) · [KVKK aydınlatma metni](${base}/sayfa/kvkk-aydinlatma-metni)`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
