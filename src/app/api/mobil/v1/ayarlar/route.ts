import { COACH_FEATURES, COACH_FREE_NAME, parseCoachTiers } from "@/lib/pi-koc";
import { appUrl } from "@/server/email";
import { maintenanceState } from "@/server/maintenance";
import { json } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";
import { loadSettings } from "@/server/settings";
import { toWhatsAppNumber } from "@/server/whatsapp";

// Pi Kampüs uygulamasının açılış ayarları. Uygulama metin, fiyat ve sınırları koda gömmez, buradan okur:
// sitede (Yönetim → Ayarlar) bir değer değişince uygulama bir sonraki açılışta günceli gösterir (yeniden derleme gerekmez).
// Geriye dönük uyum: alan eklenebilir, var olan alan silinmez ya da anlamı değiştirilmez.

export const GET = publicRoute(async () => {
  const [settings, maintenance] = await Promise.all([loadSettings(), maintenanceState()]);
  const site = appUrl().replace(/\/$/, "");
  const tiers = parseCoachTiers(settings.piKocTiers);
  return json(
    {
      app: {
        name: settings.siteName,
        minVersion: settings.mobileMinVersion,
        latestVersion: settings.mobileLatestVersion,
        store: { android: settings.mobileAndroidUrl || null, ios: settings.mobileIosUrl || null },
      },
      site: { url: site, contactEmail: settings.contactEmail, contactPhone: settings.contactPhone, whatsapp: toWhatsAppNumber(settings.contactPhone) || null },
      announcement: settings.announcement.trim() || null,
      maintenance: { on: maintenance.on, message: maintenance.on ? maintenance.message : null },
      piKoc: {
        free: {
          name: COACH_FREE_NAME,
          students: settings.piKocFreeStudents,
          meetingMinutes: settings.piKocFreeMeetingMinutes,
          monthlyHours: settings.piKocFreeStudents * settings.piKocHoursPerStudent,
          aiPerMonth: settings.piKocFreeAiPerMonth,
        },
        hoursPerStudent: settings.piKocHoursPerStudent,
        // Fiyatlar KDV dahil, tam TL
        tiers: tiers.map((t) => ({ name: t.name, students: t.students, priceTl: t.priceTl })),
        features: Object.entries(COACH_FEATURES).map(([key, f]) => ({ key, title: f.title, text: f.text })),
      },
      // Uygulama içinde site sayfası olarak açılanlar (uygulama güncellemesi gerekmeden değişir)
      pages: [
        { key: "paketler", title: "Paketler", path: "/koc/abonelik", auth: true },
        { key: "tercih-lgs", title: "LGS tercih robotu", path: "/tercih-robotu/lgs", auth: false },
        { key: "tercih-yks", title: "YKS tercih robotu", path: "/tercih-robotu/yks", auth: false },
        { key: "rehber", title: "Rehber yazıları", path: "/rehber", auth: false },
        { key: "sss", title: "Sıkça sorulan sorular", path: "/sayfa/sss", auth: false },
        { key: "kvkk", title: "KVKK aydınlatma metni", path: "/sayfa/kvkk-aydinlatma-metni", auth: false },
        { key: "kullanim", title: "Kullanım şartları", path: "/sayfa/kullanim-sartlari", auth: false },
        { key: "gizlilik", title: "Gizlilik ve çerezler", path: "/sayfa/gizlilik-ve-cerez-politikasi", auth: false },
      ].map((p) => ({ ...p, url: `${site}${p.path}` })),
    },
    200,
  );
});
