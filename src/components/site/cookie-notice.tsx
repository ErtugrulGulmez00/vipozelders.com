"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const COOKIE = "vd_cookie_consent";

/** Yalnızca zorunlu çerez kullanıldığı için bilgilendirme amaçlı çerez bildirimi. */
export function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Çerez yalnızca tarayıcıda okunabilir; ilk çizimden sonra kontrol edilir.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisible(!document.cookie.split("; ").some((c) => c.startsWith(`${COOKIE}=`)));
  }, []);

  if (!visible) return null;
  return (
    <div className="pk-site-chrome fixed inset-x-3 bottom-3 z-50 mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:flex sm:items-center sm:gap-4">
      <p className="text-sm text-slate-600">
        Sitemizde yalnızca oturumunuzu açık tutmak ve güvenliği sağlamak için zorunlu çerezler kullanıyoruz. Ayrıntılar için{" "}
        <Link href="/sayfa/gizlilik-ve-cerez-politikasi" className="font-medium text-brand-700 underline">
          Çerez Politikası
        </Link>
        .
      </p>
      <button
        type="button"
        onClick={() => {
          document.cookie = `${COOKIE}=1; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax`;
          setVisible(false);
        }}
        className="mt-3 h-9 shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700 sm:mt-0"
      >
        Anladım
      </button>
    </div>
  );
}
