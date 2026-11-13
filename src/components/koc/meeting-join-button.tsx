"use client";

import { Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Öğrencinin görüşme düğmesi: koç görüşmeyi başlatınca açılır; o zamana kadar 10 saniyede bir sorulur. */
export function MeetingJoinButton({ studentId, initialLive }: { studentId: string; initialLive: boolean }) {
  const [live, setLive] = useState(initialLive);
  useEffect(() => {
    let stop = false;
    const check = async () => {
      try {
        const res = await fetch(`/api/gorusme/${studentId}`, { cache: "no-store" });
        if (res.ok && !stop) setLive(Boolean((await res.json()).live));
      } catch {
        // Bağlantı hatasında düğme olduğu gibi kalır
      }
    };
    const id = window.setInterval(check, 10_000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [studentId]);
  if (live) {
    return (
      <Link href={`/gorusme/${studentId}`} className="inline-flex h-11 animate-pulse items-center gap-2 rounded-full bg-brand-600 px-5 text-sm font-bold text-white shadow-lg shadow-brand-900/30 hover:animate-none hover:bg-brand-700">
        <Video className="size-4" aria-hidden /> Görüşmeye katıl
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span aria-disabled className="inline-flex h-11 cursor-not-allowed items-center gap-2 rounded-full bg-white/10 px-5 text-sm font-bold text-ink-300 ring-1 ring-white/15">
        <Video className="size-4" aria-hidden /> Görüşmeye katıl
      </span>
      <span className="text-xs text-ink-300">Koçunuz görüşmeyi başlatınca açılır</span>
    </span>
  );
}
