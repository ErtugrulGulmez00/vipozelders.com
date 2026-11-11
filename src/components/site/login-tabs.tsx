import { Building2, GraduationCap, HeartHandshake } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type LoginGate = "personal" | "center" | "koc";

/**
 * Üç giriş kapısı, tek hesap sistemi:
 *  - Özel ders girişi (/giris): özel ders tarafı (veli, öğrenci, öğretmen, yönetici)
 *  - Kurum girişi (/kurum-giris): kurum tarafı (personel, kurumun öğrencisi ve velisi)
 *  - Pi Koç girişi (/koc-giris): bireysel koç ve öğrencileri
 * Kişi hangi kapıdan girerse o tarafı görür; o tarafta hesabı yoksa kendi tarafına yönlenir (src/lib/sides.ts).
 */
export const LOGIN_GATES = [
  { key: "personal", href: "/giris", label: "Özel ders", hint: "Veli · öğrenci · öğretmen", Icon: GraduationCap },
  { key: "center", href: "/kurum-giris", label: "Kurum", hint: "Etüt merkezi", Icon: Building2 },
  { key: "koc", href: "/koc-giris", label: "Pi Koç", hint: "Koç · öğrenci", Icon: HeartHandshake },
] as const;

export function LoginTabs({ active }: { active: LoginGate }) {
  return (
    <nav className="mb-7 grid grid-cols-3 gap-1 rounded-2xl bg-ink-50 p-1.5 ring-1 ring-ink-100" aria-label="Giriş türü">
      {LOGIN_GATES.map(({ key, href, label, hint, Icon }) => {
        const on = active === key;
        return (
          <Link
            key={key}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn("flex flex-col items-center gap-1 rounded-xl px-1.5 py-2.5 text-center transition", on ? "bg-white shadow-sm ring-1 ring-ink-100" : "text-slate-500 hover:bg-white/70 hover:text-ink-900")}
          >
            <Icon className={cn("size-5", on ? "text-brand-600" : "text-slate-400")} aria-hidden />
            <span className={cn("text-sm font-bold leading-none", on ? "text-ink-900" : "")}>{label}</span>
            <span className="hidden text-[11px] leading-tight text-slate-500 sm:block">{hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
