import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Üç giriş kapısı, tek hesap sistemi:
 *  - Özel ders girişi (/giris): özel ders tarafı (veli, öğrenci, öğretmen, yönetici)
 *  - Kurum girişi (/kurum-giris): kurum tarafı (personel, kurumun öğrencisi ve velisi)
 *  - Pi Koç girişi (/koc-giris): bireysel koç ve öğrencileri
 * Kişi hangi kapıdan girerse o tarafı görür; o tarafta hesabı yoksa kendi tarafına yönlenir (src/lib/sides.ts).
 */
export function LoginTabs({ active }: { active: "personal" | "center" | "koc" }) {
  const tabs = [
    { key: "personal", href: "/giris", label: "Özel ders", hint: "Veli · öğrenci · öğretmen" },
    { key: "center", href: "/kurum-giris", label: "Kurum", hint: "Etüt merkezi · veli" },
    { key: "koc", href: "/koc-giris", label: "Pi Koç", hint: "Koç · öğrenci" },
  ] as const;
  return (
    <nav className="mb-6 grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Giriş türü">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn("rounded-xl px-2 py-2 text-center", active === tab.key ? "bg-white shadow-sm" : "hover:bg-white/60")}
        >
          <span className={cn("block text-sm font-semibold", active === tab.key ? "text-brand-700" : "text-slate-700")}>{tab.label}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{tab.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
