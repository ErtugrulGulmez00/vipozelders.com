import Link from "next/link";
import { percent, shortDate } from "@/components/center/center-ui";
import { Badge, Card, CardBody, CardHeader } from "@/components/ui/primitives";
import { HOMEWORK_STATUS } from "@/lib/center/labels";
import { homeworkRate } from "@/server/center/homework";

export type HomeworkRow = {
  id: string;
  subject: string;
  title: string;
  description: string | null;
  dueDate: Date;
  status: "PENDING" | "DONE" | "PARTIAL" | "MISSING";
  note: string | null;
};

/** Öğrencinin ödevleri: kurum öğrenci kartında ve veli portalında aynı görünüm. */
export function HomeworkList({ rows, linkBase }: { rows: HomeworkRow[]; linkBase?: string }) {
  const summary = homeworkRate(rows);
  return (
    <Card>
      <CardHeader
        title="Ödevler"
        description={summary.rate !== null ? `Kontrol edilen ${summary.checked} ödevin ${percent(summary.rate)}’i yapıldı · ${summary.missing} yapılmadı` : "Henüz kontrol edilen ödev yok"}
      />
      {rows.length === 0 ? (
        <CardBody>
          <p className="text-sm text-slate-500">Ödev verilmemiş.</p>
        </CardBody>
      ) : (
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => {
            const body = (
              <div className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {r.subject}: {r.title}
                  </p>
                  <p className="text-xs text-slate-500">Teslim {shortDate(r.dueDate)}</p>
                  {r.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-600">{r.description}</p> : null}
                  {r.note ? <p className="mt-1 text-xs text-slate-600">Öğretmen notu: {r.note}</p> : null}
                </div>
                <Badge tone={HOMEWORK_STATUS[r.status].tone}>{HOMEWORK_STATUS[r.status].label}</Badge>
              </div>
            );
            return (
              <li key={r.id}>
                {linkBase ? (
                  <Link href={`${linkBase}/${r.id}`} className="block hover:bg-slate-50">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
