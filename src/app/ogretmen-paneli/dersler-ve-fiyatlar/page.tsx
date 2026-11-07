import type { Metadata } from "next";
import Link from "next/link";
import { IntroToggle } from "@/components/teacher/intro-toggle";
import { OfferingsEditor } from "@/components/teacher/offerings-editor";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { GROUP_COURSE_STATUS } from "@/lib/labels";
import { formatBps } from "@/lib/money";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { getCatalog } from "@/server/site";
import { loadTeacherEditorData } from "@/server/teacher-editor-data";
import { SectionTabs, TEACHER_PROFILE_TABS } from "@/components/panel/section-tabs";
import { PackageDiscountsForm } from "@/components/packages/forms";
import { parsePackageDiscounts } from "@/server/packages";
import { loadSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Dersler ve fiyatlar" };

export default async function OfferingsPage() {
  const user = await requireRole("TEACHER");
  const [data, catalog, profile, settings, groups] = await Promise.all([
    loadTeacherEditorData(user.id),
    getCatalog(),
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { offersIntro: true, packageDiscounts: true } }),
    loadSettings(),
    db.groupCourse.findMany({ where: { teacherId: user.id, status: { in: ["OPEN", "CONFIRMED"] } }, orderBy: { enrollDeadline: "asc" }, select: { id: true, title: true, status: true } }),
  ]);
  return (
    <>
      <SectionTabs tabs={TEACHER_PROFILE_TABS} active="/ogretmen-paneli/dersler-ve-fiyatlar" />
      <PageHeader title="Dersler ve fiyatlar" description="Verdiğiniz her kademe, ders ve hizmet için ayrı saatlik ücret belirleyebilirsiniz." />
      <Alert tone="info" className="mb-6">
        Girdiğiniz ücret velinin ödeyeceği, KDV dahil saatlik tutardır. Platform hizmet bedeli {formatBps(data.commissionBps)}; kalan tutar ders tamamlandıktan sonra hakedişinize eklenir. Süreye göre ücret otomatik hesaplanır (ör. 90 dk = 1,5 saat).
      </Alert>
      <Card className="mb-6">
        <CardBody>
          <IntroToggle on={profile.offersIntro} />
        </CardBody>
      </Card>
      <Card>
        <CardBody className="p-6">
          <OfferingsEditor teacherId={user.id} catalog={catalog} offerings={data.offerings} commissionBps={data.commissionBps} />
        </CardBody>
      </Card>
      {settings.groupsEnabled || groups.length ? (
        <Card className="mt-6">
          <CardHeader
            title="Grup dersleri"
            description="Grup dersleri ayrı bir sayfada yönetilir: program açın, öğrenci davet edin, kayıtları görün ya da dersi iptal edin."
            action={
              <Link href="/ogretmen-paneli/grup-dersleri" className={buttonClasses("outline", "sm")}>
                Grup derslerim
              </Link>
            }
          />
          {groups.length ? (
            <ul className="divide-y divide-slate-100">
              {groups.map((g) => (
                <li key={g.id}>
                  <Link href={`/ogretmen-paneli/grup-dersleri/${g.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-slate-50">
                    <span className="min-w-0 truncate font-medium text-slate-900">{g.title}</span>
                    <Badge tone={GROUP_COURSE_STATUS[g.status]?.tone}>{GROUP_COURSE_STATUS[g.status]?.label}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}
      {settings.packagesEnabled ? (
        <Card className="mt-6">
          <CardHeader title="Paket indirimleri" description="Veliler birden fazla dersi peşin ve indirimli alabilir; dersleri sizin takviminizden seçer. İndirim sizin ücretinizden yapılır; düzenli öğrenci kazanmanın en kolay yolu." />
          <CardBody>
            <PackageDiscountsForm rows={parsePackageDiscounts(profile.packageDiscounts, settings.packageMaxLessons, settings.packageMaxDiscountPercent)} maxLessons={settings.packageMaxLessons} maxPercent={settings.packageMaxDiscountPercent} />
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}
