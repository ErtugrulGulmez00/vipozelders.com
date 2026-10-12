import { twMerge } from "tailwind-merge";

/** Koşullu sınıf adlarını birleştirir; çakışan Tailwind sınıflarında sonradan verilen kazanır (ör. w-full + w-56 → w-56). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
