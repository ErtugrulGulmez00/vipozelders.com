import Link from "next/link";
import { cn } from "@/lib/cn";
import { getSiteSettings } from "@/server/site";
import { PiMark } from "./pi-mark";

export async function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  const settings = await getSiteSettings();
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5 font-display font-extrabold tracking-tight", light ? "text-white" : "text-ink-900", className)}>
      <span className="inline-flex size-10 -rotate-6 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-sm">
        <PiMark className="size-6" />
      </span>
      <span className="whitespace-nowrap text-lg sm:text-xl">{settings.siteName}</span>
    </Link>
  );
}
