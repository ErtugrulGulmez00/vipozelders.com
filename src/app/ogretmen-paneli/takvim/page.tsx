import type { Metadata } from "next";
import { ExceptionsEditor, WeeklyAvailabilityEditor } from "@/components/teacher/availability-editor";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/primitives";
import { toLocalDateString } from "@/lib/dates";
import { requireRole } from "@/server/auth/current-user";
import { loadSettings } from "@/server/settings";
import { loadTeacherEditorData } from "@/server/teacher-editor-data";

export const metadata: Metadata = { title: "Müsaitlik takvimi" };

export default async function AvailabilityPage() {
  const user = await requireRole("TEACHER");
  const [data, settings] = await Promise.all([loadTeacherEditorData(user.id), loadSettings()]);
  return (
    <>
      <PageHeader
        title="Müsaitlik takvimi"
        description={`Veliler yalnızca buradaki boş saatlerden randevu alabilir. Randevular en erken ${settings.minNoticeHours} saat sonrası, en geç ${settings.maxAdvanceDays} gün ilerisi için alınabilir.`}
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader title="Haftalık şablon" description="Her hafta tekrarlanan ders verebileceğiniz saatler." />
          <CardBody>
            <WeeklyAvailabilityEditor teacherId={user.id} initialRules={data.rules} bufferMinutes={data.teacher.bufferMinutes} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="İzin ve ek saatler" description="Tatil, sınav haftası veya tek seferlik ek müsaitlik." />
          <CardBody>
            <ExceptionsEditor teacherId={user.id} exceptions={data.exceptions} minDate={toLocalDateString(new Date())} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
