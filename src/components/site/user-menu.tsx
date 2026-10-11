import { Bell, ChevronDown, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { buttonClasses } from "@/components/ui/button";
import { roleHome } from "@/lib/auth-constants";
import { ROLE_LABEL } from "@/lib/labels";
import { initials } from "@/lib/text";
import { getCurrentUser } from "@/server/auth/current-user";
import { db } from "@/server/db";

/** Üst menüdeki kullanıcı alanı. Oturum okuduğu için Suspense içinde çizilir. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/giris" className={buttonClasses("ghost", "sm")}>
          Giriş yap
        </Link>
        <Link href="/kayit" className={buttonClasses("primary", "sm")}>
          Kayıt ol
        </Link>
      </div>
    );
  }

  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });
  const home = roleHome(user.role);
  const notificationsHref = user.role === "ADMIN" ? "/yonetim" : `${home}/bildirimler`;

  return (
    <div className="flex items-center gap-1">
      <Link href={notificationsHref} className="relative inline-flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label={`Bildirimler (${unread} okunmamış)`}>
        <Bell className="size-5" aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
      <details className="group relative">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
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
          <Link href={home} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <LayoutDashboard className="size-4" aria-hidden /> Panelim
          </Link>
          {user.role === "STUDENT" ? (
            <Link href="/hesabim/profil" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <UserRound className="size-4" aria-hidden /> Hesap ayarları
            </Link>
          ) : null}
          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
              <LogOut className="size-4" aria-hidden /> Çıkış yap
            </button>
          </form>
        </div>
      </details>
    </div>
  );
}

export function UserMenuFallback() {
  return <div className="h-9 w-40 animate-pulse rounded-lg bg-slate-100" />;
}
