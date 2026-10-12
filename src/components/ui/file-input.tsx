"use client";

import { Upload } from "lucide-react";
import { useState, type ComponentProps } from "react";
import { cn } from "@/lib/cn";

/** Türkçe dosya seçici: tarayıcının "No file chosen" yazısı yerine seçilen dosyanın adı görünür. */
export function FileInput({ className, placeholder = "Dosya seçin", onChange, ...props }: Omit<ComponentProps<"input">, "type"> & { placeholder?: string }) {
  const [fileName, setFileName] = useState<string | null>(null);
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 hover:border-brand-300 hover:bg-slate-50 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20",
        className,
      )}
    >
      <Upload className="size-4 shrink-0 text-slate-400" aria-hidden />
      <span className={cn("min-w-0 flex-1 truncate", fileName ? "font-medium text-slate-900" : "text-slate-500")}>{fileName ?? placeholder}</span>
      <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">Gözat</span>
      <input
        type="file"
        className="sr-only"
        onChange={(event) => {
          setFileName(event.target.files?.[0]?.name ?? null);
          onChange?.(event);
        }}
        {...props}
      />
    </label>
  );
}
