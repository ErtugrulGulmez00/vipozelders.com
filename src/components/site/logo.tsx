import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { getSiteSettings } from "@/server/site";

export async function Logo({ className, light = false }: { className?: string; light?: boolean }) {
  const settings = await getSiteSettings();
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2 font-bold tracking-tight", light ? "text-white" : "text-brand-950", className)}>
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 text-gold-300 shadow-sm">
        <GraduationCap className="size-5" aria-hidden />
      </span>
      <span className="whitespace-nowrap text-base sm:text-lg">{settings.siteName}</span>
    </Link>
  );
}
