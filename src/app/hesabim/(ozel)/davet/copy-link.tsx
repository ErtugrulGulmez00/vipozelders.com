"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";

export function CopyInviteLink({ url, text }: { url: string; text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input readOnly value={url} className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm" onFocus={(e) => e.target.select()} />
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />} {copied ? "Kopyalandı" : "Kopyala"}
        </button>
      </div>
      <a href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-[#25d366] px-3 py-2 text-sm font-semibold text-white">
        <Share2 className="size-4" aria-hidden /> WhatsApp ile paylaş
      </a>
    </div>
  );
}
