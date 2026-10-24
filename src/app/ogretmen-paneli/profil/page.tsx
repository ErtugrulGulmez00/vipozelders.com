import type { Metadata } from "next";
import { ProfileForm } from "@/components/teacher/profile-form";
import { LinkButton } from "@/components/ui/button";
import { Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { getCities } from "@/server/site";
import { loadTeacherEditorData } from "@/server/teacher-editor-data";
import { SectionTabs, TEACHER_PROFILE_TABS } from "@/components/panel/section-tabs";

export const metadata: Metadata = { title: "Profilim" };

export default async function TeacherProfilePage() {
  const user = await requireRole("TEACHER");
  const [data, cities] = await Promise.all([loadTeacherEditorData(user.id), getCities()]);
  return (
    <>
      <SectionTabs tabs={TEACHER_PROFILE_TABS} active="/ogretmen-paneli/profil" />
      <PageHeader
        title="Profilim"
        description="Velilerin sizi tanıdığı sayfa. Eksiksiz ve özenli bir profil daha çok talep getirir."
        actions={<LinkButton href={`/ogretmen/${data.teacher.slug}`} variant="outline" target="_blank">Önizle</LinkButton>}
      />
      <Card>
        <CardBody className="p-6">
          <ProfileForm values={data.profile} cities={cities.map((c) => ({ id: c.id, name: c.name }))} initialDistricts={data.districts} />
        </CardBody>
      </Card>
    </>
  );
}
