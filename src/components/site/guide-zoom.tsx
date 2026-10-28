"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

// Rehberde data-zoom'lu görüntüye tıklayınca tam boy açar; bir video başlayınca diğerlerini durdurur.
export function GuideZoom() {
  const [image, setImage] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const img = (e.target as HTMLElement).closest<HTMLImageElement>("img[data-zoom]");
      if (img) setImage({ src: img.dataset.zoom!, alt: img.alt });
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImage(null);
    };
    const onPlay = (e: Event) => {
      document.querySelectorAll("video").forEach((v) => {
        if (v !== e.target) v.pause();
      });
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("play", onPlay, true);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("play", onPlay, true);
    };
  }, []);

  if (!image) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={image.alt} className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center overflow-auto bg-ink-950/90 p-4" onClick={() => setImage(null)}>
      <button type="button" className="fixed top-4 right-4 inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-2 text-sm font-bold text-ink-900" onClick={() => setImage(null)}>
        Kapat <X className="size-4" aria-hidden />
      </button>
      {/* Büyütülmüş görüntü özgün boyutunda gösterilir */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={image.src} alt={image.alt} className="h-auto max-w-[min(1500px,100%)] rounded-lg shadow-2xl" />
    </div>
  );
}
