"use client";

import { X } from "lucide-react";
import { useRef } from "react";
import { Avatar } from "@/components/ui/primitives";

/** Profil fotoğrafı: tıklayınca büyük hâli açılır (Esc, dışarı tıklama ya da kapat düğmesiyle kapanır). */
export function PhotoZoom({ src, name, initials, size }: { src: string | null; name: string; initials: string; size: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  if (!src) return <Avatar src={null} name={name} initials={initials} size={size} />;
  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} className="shrink-0 cursor-zoom-in rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" aria-label={`${name} fotoğrafını büyüt`}>
        <Avatar src={src} name={name} initials={initials} size={size} />
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
        className="m-auto max-h-[90vh] max-w-[min(90vw,40rem)] overflow-visible bg-transparent p-0 backdrop:bg-slate-950/80"
        aria-label={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- yüklenen dosya, boyutu bilinmiyor */}
        <img src={src} alt={name} className="max-h-[85vh] w-auto rounded-2xl object-contain shadow-2xl" />
        <button type="button" onClick={() => dialog.current?.close()} className="absolute -top-3 -right-3 rounded-full bg-white p-2 text-slate-700 shadow-lg hover:bg-slate-100" aria-label="Kapat">
          <X className="size-5" aria-hidden />
        </button>
      </dialog>
    </>
  );
}
