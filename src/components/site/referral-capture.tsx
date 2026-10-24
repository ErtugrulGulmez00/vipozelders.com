"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

/** Davet bağlantısıyla (?davet=KOD) gelen ziyaretçinin kodu 30 gün saklanır; kayıtta davet edene bağlanır. */
export function ReferralCapture() {
  const code = useSearchParams().get("davet");
  useEffect(() => {
    if (!code || !/^[A-Za-z0-9]{4,12}$/.test(code)) return;
    document.cookie = `vd_davet=${encodeURIComponent(code.toUpperCase())}; path=/; max-age=${30 * 24 * 3600}; samesite=lax`;
  }, [code]);
  return null;
}
