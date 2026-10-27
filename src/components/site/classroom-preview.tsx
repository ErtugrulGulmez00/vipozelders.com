import { MessageSquare, Mic, MonitorUp, PenLine, Video } from "lucide-react";
import { cn } from "@/lib/cn";

/** Ana sayfadaki çizim: site içi sanal sınıfın (görüntü + ortak beyaz tahta) küçük bir önizlemesi. */
export function ClassroomPreview({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)} aria-hidden>
      <div className="rotate-1 overflow-hidden rounded-3xl bg-ink-950 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between px-4 py-2.5 text-xs text-slate-300">
          <span className="inline-flex items-center gap-1.5 font-semibold text-white">
            <span className="size-2 animate-pulse rounded-full bg-rose-500" /> Canlı ders
          </span>
          <span>Lise · Matematik</span>
          <span className="tabular-nums">38 dk</span>
        </div>
        <div className="grid grid-cols-[1fr_96px] gap-2 px-2">
          <div className="rounded-lg bg-white p-2">
            <svg viewBox="0 0 200 120" className="h-36 w-full">
              <line x1="100" y1="8" x2="100" y2="112" stroke="#cbd5e1" strokeWidth="1" />
              <line x1="16" y1="60" x2="184" y2="60" stroke="#cbd5e1" strokeWidth="1" />
              <path d="M40 20 Q100 140 160 20" fill="none" stroke="#d63f1c" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="65" cy="60" r="3.5" fill="#f5b014" />
              <circle cx="135" cy="60" r="3.5" fill="#f5b014" />
              <text x="58" y="74" fontSize="9" fill="#64748b">−2</text>
              <text x="132" y="74" fontSize="9" fill="#64748b">2</text>
              <text x="124" y="106" fontSize="12" fontStyle="italic" fontWeight="600" fill="#0f172a">
                y = x² − 4
              </text>
              <path d="M18 104 q8 -6 16 0 t16 0" fill="none" stroke="#f5b014" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <div className="grid gap-2">
            <div className="flex flex-col items-center justify-center rounded-lg bg-brand-600 ring-2 ring-mint-400">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/20 text-xs font-bold text-white">AY</span>
              <span className="mt-1 text-[10px] text-white/90">Öğretmen</span>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg bg-ink-700">
              <span className="inline-flex size-8 items-center justify-center rounded-full bg-white/15 text-xs font-bold text-white">EA</span>
              <span className="mt-1 text-[10px] text-white/80">Öğrenci</span>
            </div>
          </div>
        </div>
        <div className="flex justify-center gap-2 px-4 py-3">
          {[Mic, Video, MonitorUp, PenLine, MessageSquare].map((Icon, index) => (
            <span key={index} className={cn("inline-flex size-8 items-center justify-center rounded-lg text-white", index === 3 ? "bg-brand-600" : "bg-ink-800")}>
              <Icon className="size-4" />
            </span>
          ))}
        </div>
      </div>
      <div className="absolute -bottom-5 -left-6 rounded-2xl bg-white px-3 py-2 text-xs font-semibold text-ink-900 shadow-lg ring-1 ring-ink-100">
        Görüntü · Ekran paylaşımı · <span className="text-brand-700">Ortak beyaz tahta</span>
      </div>
    </div>
  );
}
