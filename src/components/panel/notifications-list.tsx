import { BellOff, CheckCheck } from "lucide-react";
import Link from "next/link";
import { markNotificationsReadAction } from "@/actions/student";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/dates";
import { db } from "@/server/db";

/** Tüm panellerde ortak bildirim sayfası içeriği. */
export async function NotificationsPage({ userId }: { userId: string }) {
  const notifications = await db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Bildirimler"
        description={unread ? `${unread} okunmamış bildirim` : "Tüm bildirimleri okudunuz."}
        actions={
          unread ? (
            <form action={markNotificationsReadAction}>
              <Button type="submit" variant="outline" size="sm">
                <CheckCheck className="size-4" aria-hidden /> Tümünü okundu işaretle
              </Button>
            </form>
          ) : null
        }
      />
      {notifications.length === 0 ? (
        <EmptyState icon={<BellOff className="size-8" />} title="Henüz bildiriminiz yok" />
      ) : (
        <Card className="divide-y divide-slate-100">
          {notifications.map((n) => {
            const body = (
              <div className={cn("flex gap-3 px-5 py-4", !n.readAt && "bg-brand-50/40")}>
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                  <p className="mt-0.5 text-sm text-slate-600">{n.body}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatCompact(n.createdAt)}</p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} className="block hover:bg-slate-50">
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </Card>
      )}
    </>
  );
}
