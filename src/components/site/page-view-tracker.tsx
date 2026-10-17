"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Vitrin sayfalarında çerezsiz ziyaret sayacı: her sayfa geçişinde tek bir istek. */
export function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const payload = JSON.stringify({ path: pathname, referrer: document.referrer || null });
    try {
      if (!navigator.sendBeacon?.("/api/istatistik", new Blob([payload], { type: "application/json" }))) {
        void fetch("/api/istatistik", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true });
      }
    } catch {
      // Sayaç çalışmazsa sayfa etkilenmez.
    }
  }, [pathname]);
  return null;
}
