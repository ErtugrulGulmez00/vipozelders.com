import { CenterFileUploadForm } from "@/components/center/center-files";
import { CenterFilesManageList } from "@/components/center/center-files-list";
import { Card, CardBody, CardHeader } from "@/components/ui/primitives";
import type { CenterContext } from "@/server/center/context";
import { listCenterFiles } from "@/server/center/files";
import { db } from "@/server/db";

/** Kaynaklar sayfasındaki "Dosyalar" sekmesi (kurum ve Pi Koç). */
export async function CenterFilesTab({ ctx }: { ctx: CenterContext }) {
  const [files, groups, students] = await Promise.all([
    listCenterFiles(ctx.center.id),
    db.centerGroup.findMany({ where: { centerId: ctx.center.id, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.centerStudent.findMany({ where: { centerId: ctx.center.id, status: "ACTIVE" }, orderBy: [{ firstName: "asc" }, { lastName: "asc" }], select: { id: true, firstName: true, lastName: true } }),
  ]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
      <div>
        <p className="mb-3 text-sm text-slate-600">
          {files.length ? `${files.length} dosya · ` : ""}Öğrenciler ve veliler kendi hesaplarındaki <b>Dosyalar</b> bölümünden indirir.
        </p>
        <CenterFilesManageList files={files} canDelete />
      </div>
      <Card>
        <CardHeader title="Dosya ekle" />
        <CardBody>
          <CenterFileUploadForm groups={groups} students={students.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }))} />
        </CardBody>
      </Card>
    </div>
  );
}
