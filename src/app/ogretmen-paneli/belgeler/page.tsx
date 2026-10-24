import { FileText, ShieldCheck, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { deleteDocumentAction } from "@/actions/teacher";
import { Alert, Badge, Card, CardBody, CardHeader, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { DOCUMENT_STATUS, DOCUMENT_TYPE_LABEL, VERIFICATION_STATUS } from "@/lib/labels";
import { requireRole } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { uploadUrl } from "@/server/storage";
import { DocumentUploadForm } from "./document-upload-form";
import { SectionTabs, TEACHER_PROFILE_TABS } from "@/components/panel/section-tabs";

export const metadata: Metadata = { title: "Belgelerim" };

export default async function TeacherDocumentsPage() {
  const user = await requireRole("TEACHER");
  const [teacher, documents] = await Promise.all([
    db.teacherProfile.findUniqueOrThrow({ where: { userId: user.id }, select: { verificationStatus: true, offersInPerson: true } }),
    db.teacherDocument.findMany({ where: { teacherId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);
  const verification = VERIFICATION_STATUS[teacher.verificationStatus];

  return (
    <>
      <SectionTabs tabs={TEACHER_PROFILE_TABS} active="/ogretmen-paneli/belgeler" />
      <PageHeader title="Belgelerim" description="Kimlik ve diplomanızı yükleyin; yönetici doğruladığında profilinizde “Onaylı öğretmen” rozeti görünür." />
      <div className="space-y-6">
        <Alert tone="info" title="Hangi belgeler isteniyor?">
          Kimlik (ön yüz), diploma veya öğretmenlik belgesi
          {teacher.offersInPerson ? " ve yüz yüze ders verdiğiniz için e-Devlet'ten alınmış barkodlu adli sicil kaydı" : "; yüz yüze ders verecekseniz e-Devlet'ten alınmış barkodlu adli sicil kaydı"}. Belgeleriniz yalnızca yöneticiler tarafından görülür, profilinizde yayınlanmaz.
        </Alert>

        <Card>
          <CardHeader
            title="Yeni belge yükle"
            action={
              <Badge tone={verification.tone}>
                <ShieldCheck className="size-3.5" aria-hidden /> {verification.label}
              </Badge>
            }
          />
          <CardBody>
            <DocumentUploadForm />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Yüklediğim belgeler" />
          <CardBody>
            {documents.length === 0 ? (
              <EmptyState icon={<FileText className="size-8" />} title="Henüz belge yüklemediniz" description="Yüklediğiniz belgeler ve inceleme durumları burada görünür." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {documents.map((doc) => {
                  const status = DOCUMENT_STATUS[doc.status];
                  return (
                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                          {DOCUMENT_TYPE_LABEL[doc.type]} <Badge tone={status.tone}>{status.label}</Badge>
                        </p>
                        <a href={uploadUrl(doc.fileKey) ?? "#"} target="_blank" rel="noopener noreferrer" className="block truncate text-sm text-brand-700 hover:underline">
                          {doc.fileName}
                        </a>
                        <p className="text-xs text-slate-400">Yüklendi: {formatCompact(doc.createdAt)}{doc.reviewedAt ? ` · İncelendi: ${formatCompact(doc.reviewedAt)}` : ""}</p>
                        {doc.note ? <p className="mt-1 text-sm text-slate-600">Yönetici notu: {doc.note}</p> : null}
                      </div>
                      {doc.status !== "APPROVED" ? (
                        <form action={deleteDocumentAction}>
                          <input type="hidden" name="documentId" value={doc.id} />
                          <button type="submit" className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                            <Trash2 className="size-4" aria-hidden /> Sil
                          </button>
                        </form>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
