"use client";

import { Tag } from "lucide-react";
import { useState, useTransition } from "react";
import { checkCouponAction, type CouponCheck } from "@/actions/discounts";
import type { DiscountTarget } from "@/server/discounts";

/**
 * Ödeme formlarında indirim kodu alanı. Kod "couponCode" adıyla forma eklenir; "Uygula" yalnızca önizlemedir,
 * indirim ödemede yeniden doğrulanır. Davetle gelen yeni üyenin indirimi kod gerekmeden kendiliğinden uygulanır.
 */
export function CouponField({ target, refId, duration, credits }: { target: DiscountTarget; refId?: string; duration?: number; credits?: number }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState<CouponCheck | null>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
        <Tag className="size-4" aria-hidden /> İndirim kodum var
      </button>
    );
  }
  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          name="couponCode"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toLocaleUpperCase("tr-TR"));
            setResult(null);
          }}
          placeholder="İndirim kodu"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          disabled={pending || !code.trim()}
          onClick={() => start(async () => setResult(await checkCouponAction({ target, code, ref: refId ?? "", duration, credits })))}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "…" : "Uygula"}
        </button>
      </div>
      {result ? <p className={result.ok ? "text-sm font-medium text-emerald-700" : "text-sm text-rose-600"}>{result.ok ? `${result.label}: ${result.text}` : result.error}</p> : null}
    </div>
  );
}
