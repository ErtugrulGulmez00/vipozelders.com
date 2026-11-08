import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/primitives";
import { requireCenter } from "@/server/center/context";
import { loadDistricts } from "@/server/catalog";
import { db } from "@/server/db";
import { appUrl } from "@/server/email";
import { getCities } from "@/server/site";
import { uploadUrl } from "@/server/storage";
import { CenterSettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Kurum ayarları" };

export default async function CenterSettingsPage() {
  const ctx = await requireCenter("settings.manage");
  const center = await db.center.findUniqueOrThrow({ where: { id: ctx.center.id } });
  const [cities, districts] = await Promise.all([getCities(), center.cityId ? loadDistricts(center.cityId) : Promise.resolve([])]);
  return (
    <>
      <PageHeader title="Kurum ayarları" />
      <CenterSettingsForm
        cities={cities.map((c) => ({ id: c.id, name: c.name }))}
        initialDistricts={districts.map((d) => ({ id: d.id, name: d.name }))}
        values={{
          name: center.name,
          kind: center.kind,
          phone: center.phone,
          email: center.email,
          address: center.address,
          cityId: center.cityId,
          districtId: center.districtId,
          taxOffice: center.taxOffice,
          taxNumber: center.taxNumber,
          description: center.description,
          isPublic: center.isPublic,
          academicYear: center.academicYear,
          notifyAbsence: center.notifyAbsence,
          remindPayments: center.remindPayments,
          reminderDaysBefore: center.reminderDaysBefore,
          showTeacherSuggestions: center.showTeacherSuggestions,
          disabledModules: center.disabledModules,
          loginUrl: appUrl(`/kurum-giris?kurum=${center.slug}`),
          logoUrl: uploadUrl(center.logoKey),
          slug: center.slug,
        }}
      />
    </>
  );
}
