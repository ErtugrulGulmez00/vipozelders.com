"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Sunucu bileşenini aralıklarla yeniler (ör. ödeme bildirimi beklenirken). maxMs sonunda durur. */
export function AutoRefresh({ intervalMs = 4_000, maxMs = 180_000 }: { intervalMs?: number; maxMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => {
      if (Date.now() - started > maxMs) window.clearInterval(id);
      else router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs, maxMs]);
  return null;
}
