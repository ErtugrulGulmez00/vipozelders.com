import { Download, Eye, File, FileImage, FileSpreadsheet, FileText, FolderOpen, Presentation } from "lucide-react";
import type { ReactNode } from "react";
import { DeleteCenterFileButton } from "@/components/center/center-files";
import { EmptyState } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { formatFileSize } from "@/server/center/files";

// Kurum dosyalarının listesi: kurum/koç tarafında (silme, indirme sayısı) ve öğrenci/veli tarafında (indir).

const KIND: Record<string, { label: string; icon: ReactNode; tone: string }> = {
  pdf: { label: "PDF", icon: <FileText className="size-5" aria-hidden />, tone: "bg-rose-50 text-rose-600" },
  docx: { label: "Word", icon: <File className="size-5" aria-hidden />, tone: "bg-sky-50 text-sky-700" },
  xlsx: { label: "Excel", icon: <FileSpreadsheet className="size-5" aria-hidden />, tone: "bg-emerald-50 text-emerald-700" },
  pptx: { label: "PowerPoint", icon: <Presentation className="size-5" aria-hidden />, tone: "bg-orange-50 text-orange-700" },
  jpg: { label: "Görsel", icon: <FileImage className="size-5" aria-hidden />, tone: "bg-violet-50 text-violet-700" },
  png: { label: "Görsel", icon: <FileImage className="size-5" aria-hidden />, tone: "bg-violet-50 text-violet-700" },
  webp: { label: "Görsel", icon: <FileImage className="size-5" aria-hidden />, tone: "bg-violet-50 text-violet-700" },
};

const kindOf = (fileName: string) => KIND[fileName.split(".").pop()?.toLowerCase() ?? ""] ?? KIND.pdf;
const canPreview = (fileName: string) => /\.(pdf|jpe?g|png|webp)$/i.test(fileName);

type BaseFile = { id: string; title: string; subject: string | null; note: string | null; fileName: string; size: number; createdAt: Date };

function FileRow({ file, meta, actions }: { file: BaseFile; meta?: ReactNode; actions: ReactNode }) {
  const kind = kindOf(file.fileName);
  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className={cn("inline-flex size-11 shrink-0 items-center justify-center rounded-2xl", kind.tone)}>{kind.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 font-semibold text-slate-900">{file.title}</p>
        <p className="text-xs text-slate-500">
          {[file.subject, kind.label, formatFileSize(file.size), formatDate(file.createdAt)].filter(Boolean).join(" · ")}
          {meta}
        </p>
        {file.note ? <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{file.note}</p> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </li>
  );
}

function DownloadLinks({ file }: { file: BaseFile }) {
  return (
    <>
      {canPreview(file.fileName) ? (
        <a href={`/api/kurum/dosya/${file.id}?goster=1`} target="_blank" rel="noopener" className="inline-flex size-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100" aria-label={`${file.title} dosyasını aç`} title="Aç">
          <Eye className="size-4" aria-hidden />
        </a>
      ) : null}
      <a href={`/api/kurum/dosya/${file.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700" aria-label={`${file.title} dosyasını indir`}>
        <Download className="size-4" aria-hidden />
        <span className="hidden sm:inline">İndir</span>
      </a>
    </>
  );
}

/** Kurum/koç tarafı: kime paylaşıldığı, indirme sayısı, silme. */
export function CenterFilesManageList({ files, canDelete }: { files: (BaseFile & { downloads: number; group: { name: string } | null; student: { firstName: string; lastName: string } | null })[]; canDelete: boolean }) {
  if (!files.length) return <EmptyState icon={<FolderOpen className="size-8" />} title="Henüz dosya yok" description="Çalışma kâğıdı, konu özeti, deneme PDF'i… Yüklediğiniz dosyaları öğrenciler kendi hesaplarından indirir." />;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {files.map((f) => (
        <FileRow
          key={f.id}
          file={f}
          meta={
            <>
              {" · "}
              <span className="font-medium text-slate-700">{f.group ? f.group.name : f.student ? `${f.student.firstName} ${f.student.lastName}` : "Tüm öğrenciler"}</span>
              {` · ${f.downloads} indirme`}
            </>
          }
          actions={
            <>
              <DownloadLinks file={f} />
              {canDelete ? <DeleteCenterFileButton fileId={f.id} title={f.title} /> : null}
            </>
          }
        />
      ))}
    </ul>
  );
}

/** Öğrenci/veli tarafı: paylaşılan dosyalar, aç ve indir. */
export function StudentFilesList({ files, emptyText = "Kurumunuz henüz dosya paylaşmadı." }: { files: BaseFile[]; emptyText?: string }) {
  if (!files.length) return <EmptyState icon={<FolderOpen className="size-8" />} title="Dosya yok" description={emptyText} />;
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {files.map((f) => (
        <FileRow key={f.id} file={f} actions={<DownloadLinks file={f} />} />
      ))}
    </ul>
  );
}
