import { appUrl } from "@/server/email";
import { maintenanceState } from "@/server/maintenance";
import { paymentReturnPrefix } from "@/server/mobile/auth";
import { json } from "@/server/mobile/http";
import { publicRoute } from "@/server/mobile/route";
import { loadSettings } from "@/server/settings";
import { getCatalog, getCities, getFooterPages } from "@/server/site";
import { SORT_OPTIONS, TIME_OPTIONS } from "@/server/teachers";

/** Uygulama açılışında bir kez alınan sabit veriler: kategoriler, iller, kurallar, yasal sayfalar. */
export const GET = publicRoute(async () => {
  const [catalog, cities, pages, settings, maintenance] = await Promise.all([getCatalog(), getCities(), getFooterPages(), loadSettings(), maintenanceState()]);
  return json({
    site: { name: settings.siteName, tagline: settings.siteTagline, contactEmail: settings.contactEmail, contactPhone: settings.contactPhone, url: appUrl() },
    maintenance: { on: maintenance.on, message: maintenance.on ? maintenance.message : null },
    rules: {
      paymentHoldMinutes: settings.paymentHoldMinutes,
      approvalWindowHours: settings.approvalWindowHours,
      minNoticeHours: settings.minNoticeHours,
      maxAdvanceDays: settings.maxAdvanceDays,
      classroomOpensMinutesBefore: settings.classroomOpensMinutesBefore,
      fullRefundHours: settings.fullRefundHours,
      partialRefundHours: settings.partialRefundHours,
      partialRefundPercent: settings.partialRefundPercent,
      disputeWindowHours: settings.disputeWindowHours,
      reviewWindowDays: settings.reviewWindowDays,
      questionAnswerHours: settings.questionAnswerHours,
      // Paket ders, erteleme, soru aboneliği, grup dersi, arkadaşını getir
      packagesEnabled: settings.packagesEnabled,
      packageMaxLessons: settings.packageMaxLessons,
      packageValidityMonths: settings.packageValidityMonths,
      rescheduleMinHours: settings.rescheduleMinHours,
      rescheduleMaxPerBooking: settings.rescheduleMaxPerBooking,
      subscriptionsEnabled: settings.subscriptionsEnabled,
      subscriptionDays: settings.subscriptionDays,
      groupsEnabled: settings.groupsEnabled,
      referralEnabled: settings.referralEnabled,
      referralDiscountPercent: settings.referralDiscountPercent,
    },
    levels: catalog.levels.map((l) => ({ id: l.id, name: l.name, slug: l.slug, group: l.group, grades: l.grades, subjectIds: l.subjectIds })),
    subjects: catalog.subjects.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
    services: catalog.services.map((s) => ({ id: s.id, name: s.name, slug: s.slug, description: s.description })),
    cities,
    sortOptions: SORT_OPTIONS,
    timeOptions: TIME_OPTIONS,
    pages: pages.map((p) => ({ slug: p.slug, title: p.title, url: appUrl(`/sayfa/${p.slug}`) })),
    paymentReturnPrefix: paymentReturnPrefix(),
  });
});
