import { Bell, CheckCheck, ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { markNotificationsReadAction } from "@/actions/student";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { formatCompact } from "@/lib/dates";
import { ROLE_LABEL } from "@/lib/labels";
import { notificationScope, notificationScopeWhere, sideHome, sideOfPath } from "@/lib/sides";
import { initials } from "@/lib/text";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";
import { sideFacts } from "@/server/sides";

/** Üst menüdeki kullanıcı alanı. Oturum okuduğu için Suspense içinde çizilir. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/giris" className={buttonClasses("ghost", "sm")}>
          <span className="sm:hidden">Giriş</span>
          <span className="hidden sm:inline">Giriş yap</span>
        </Link>
        <Link href="/kayit" className={buttonClasses("ink", "sm")}>
          Kayıt ol
        </Link>
      </div>
    );
  }

  // Vitrin özel ders tarafıdır: "Panelim" ve zil o tarafı gösterir (yalnızca kurum tarafı olan hesapta kurumu)
  const facts = await sideFacts(user.id, user.role);
  const home = sideHome(facts, "ozel");
  const scope = notificationScope(facts, sideOfPath(home));
  const [unread, latest] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null, ...notificationScopeWhere(scope) } }),
    db.notification.findMany({ where: { userId: user.id, ...notificationScopeWhere(scope) }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const notificationsHref = `${home}/bildirimler`;

  return (
    <div className="flex items-center gap-1">
      {/* Zil: son bildirimler açılır pencerede; tümü için bildirim sayfasına gidilir. */}
      <details className="relative">
        <summary className="relative inline-flex size-10 cursor-pointer list-none items-center justify-center rounded-full text-ink-700 hover:bg-ink-50 [&::-webkit-details-marker]:hidden" aria-label={`Bildirimler (${unread} okunmamış)`}>
          <Bell className="size-5" aria-hidden />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </summary>
        <div className="fixed inset-x-2 top-20 z-40 rounded-2xl border border-ink-100 bg-white shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">Bildirimler</p>
            {unread ? (
              <form action={markNotificationsReadAction}>
                <input type="hidden" name="scope" value={scope} />
                <button type="submit" className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline">
                  <CheckCheck className="size-3.5" aria-hidden /> Tümünü okundu yap
                </button>
              </form>
            ) : null}
          </div>
          {latest.length ? (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {latest.map((n) => {
                const body = (
                  <div className={cn("flex gap-3 px-4 py-3", !n.readAt && "bg-brand-50/40")}>
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-brand-500")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-slate-600">{n.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatCompact(n.createdAt)}</p>
                    </div>
                  </div>
                );
                return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-slate-50">{body}</Link> : body}</li>;
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Henüz bildiriminiz yok.</p>
          )}
          <Link href={notificationsHref} className="block border-t border-slate-100 px-4 py-2.5 text-center text-sm font-medium text-brand-700 hover:bg-slate-50">
            Tüm bildirimleri gör
          </Link>
        </div>
      </details>
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{initials(user)}</span>
          <span className="hidden text-sm font-semibold text-slate-800 sm:inline">{user.firstName}</span>
          <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="absolute right-0 z-40 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <div className="px-3 py-2">
            <p className="text-sm font-semibold text-slate-900">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-slate-500">{ROLE_LABEL[user.role]}</p>
          </div>
          <Link href={home} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <LayoutDashboard className="size-4" aria-hidden /> Panelim
          </Link>
          {user.role === "STUDENT" ? (
            <Link href={facts.privateSide ? "/hesabim/profil" : "/hesabim/kurum/hesap"} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <UserRound className="size-4" aria-hidden /> Hesap ayarları
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              <LogOut className="size-4" aria-hidden /> Çıkış yap
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

export function UserMenuFallback() {
  return <div className="h-9 w-40 animate-pulse rounded-xl bg-slate-100" />;
}
