import { Bug } from "lucide-react";
import type { Metadata } from "next";
import { resolveErrorAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Hatalar" };

const SOURCE: Record<string, string> = { render: "Sayfa", route: "API", action: "Form işlemi", proxy: "Yönlendirme", scheduler: "Arka plan işi" };

function ResolveButton({ id, label }: { id?: string; label: string }) {
  return (
    <ActionForm action={resolveErrorAction} hideMessages>
      {id ? <input type="hidden" name="id" value={id} /> : null}
      <SubmitButton size="sm" variant="outline" pendingText="…">
        {label}
      </SubmitButton>
    </ActionForm>
  );
}

export default async function ErrorsPage() {
  const [open, resolved] = await Promise.all([
    db.errorEvent.findMany({ where: { resolvedAt: null }, orderBy: { lastSeenAt: "desc" }, take: 100 }),
    db.errorEvent.findMany({ where: { resolvedAt: { not: null } }, orderBy: { lastSeenAt: "desc" }, take: 20 }),
  ]);

  return (
    <>
      <PageHeader
        title="Hatalar"
        description="Sitede ve arka plan işlerinde oluşan sunucu hataları. Yeni bir hata oluşunca size bildirim ve e-posta gelir; aynı hata için en fazla 6 saatte bir."
        actions={open.length ? <ResolveButton label="Tümünü çözüldü işaretle" /> : null}
      />
      {open.length === 0 ? (
        <Card>
          <EmptyState icon={<Bug className="size-8" />} title="Açık hata yok" description="Her şey yolunda görünüyor." />
        </Card>
      ) : (
        <div className="space-y-3">
          {open.map((e) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Badge tone="rose">{SOURCE[e.source] ?? e.source}</Badge>
                    <span className="font-mono">{e.routePath ?? "—"}</span>
                    <span>
                      {e.count} kez · son {formatCompact(e.lastSeenAt)} · ilk {formatCompact(e.firstSeenAt)}
                    </span>
                  </p>
                  <p className="mt-2 break-words font-medium text-slate-900">{e.message}</p>
                  {e.lastPath ? (
                    <p className="mt-1 break-all text-xs text-slate-500">
                      {e.method} {e.lastPath}
                    </p>
                  ) : null}
                  {e.stack ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-brand-700">Teknik ayrıntı</summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-700">{e.stack}</pre>
                    </details>
                  ) : null}
                </div>
                <ResolveButton id={e.id} label="Çözüldü" />
              </div>
            </Card>
          ))}
        </div>
      )}
      {resolved.length ? (
        <Card className="mt-6 p-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">Son çözülenler</h2>
          <ul className="space-y-1 text-xs text-slate-500">
            {resolved.map((e) => (
              <li key={e.id} className="break-words">
                {formatCompact(e.lastSeenAt)} · {e.routePath ?? e.source} · {e.message.slice(0, 140)} ({e.count} kez)
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
