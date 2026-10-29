"use client";

import { Upload } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

// Sunucu tek istekte en fazla 30 MB kabul eder (next.config); daha büyük dosya hiç yüklenmeden reddedilir.
const DEFAULT_MAX_MB = 25;
// Telefon fotoğrafları (12-48 MP, iPhone'da JPEG'e çevrilince 10-20 MB) yüklemeden önce küçültülür.
const SHRINK_ABOVE = 2 * 1024 * 1024;
const MAX_SIDE = 2400;

/** Büyük fotoğrafı tarayıcıda en uzun kenarı 2400 px olan JPEG'e çevirir; olmazsa dosyayı olduğu gibi bırakır. */
async function shrinkImage(file: File): Promise<File> {
  if (file.size <= SHRINK_ABOVE || !/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Saydam PNG beyaz zemine oturur
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg", lastModified: file.lastModified });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function formatMb(bytes: number) {
  return (bytes / 1024 / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

/**
 * Türkçe dosya seçici: tarayıcının "No file chosen" yazısı yerine seçilen dosyanın adı görünür.
 * Büyük fotoğraflar gönderilmeden küçültülür; sınırı aşan dosya seçilmez ve uyarı gösterilir.
 */
export function FileInput({
  className,
  placeholder = "Dosya seçin",
  maxMb = DEFAULT_MAX_MB,
  onChange,
  ...props
}: Omit<ComponentProps<"input">, "type"> & { placeholder?: string; maxMb?: number }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null);
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 hover:border-brand-300 hover:bg-slate-50 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20",
        status?.error && "border-rose-300 bg-rose-50",
        className,
      )}
    >
      <Upload className="size-4 shrink-0 text-slate-400" aria-hidden />
      <span
        className={cn("min-w-0 flex-1 truncate", status?.error ? "font-medium text-rose-700" : fileName ? "font-medium text-slate-900" : "text-slate-500")}
        aria-live="polite"
      >
        {status?.text ?? fileName ?? placeholder}
      </span>
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Gözat</span>
      <input
        type="file"
        className="sr-only"
        onChange={async (event) => {
          const input = event.currentTarget;
          const picked = input.files?.[0];
          setFileName(picked?.name ?? null);
          setStatus(null);
          input.setCustomValidity("");
          onChange?.(event);
          if (!picked) return;

          let file = picked;
          if (picked.size > SHRINK_ABOVE && picked.type.startsWith("image/")) {
            // Küçültme bitmeden form gönderilmesin
            input.setCustomValidity("Fotoğraf hazırlanıyor, birkaç saniye bekleyin.");
            setStatus({ text: "Fotoğraf hazırlanıyor…" });
            file = await shrinkImage(picked);
            // Bu arada başka dosya seçildiyse onun işlemi geçerli
            if (input.files?.[0] !== picked) return;
            input.setCustomValidity("");
            setStatus(null);
            if (file !== picked) {
              try {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                input.files = transfer.files;
              } catch {
                file = picked;
              }
            }
          }
          if (file.size > maxMb * 1024 * 1024) {
            input.value = "";
            setFileName(null);
            setStatus({ text: `Dosya ${formatMb(file.size)} MB; en fazla ${maxMb} MB yükleyebilirsiniz.`, error: true });
          }
        }}
        {...props}
      />
    </label>
  );
}
