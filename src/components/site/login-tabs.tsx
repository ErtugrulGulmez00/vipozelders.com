import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * İki giriş kapısı, tek hesap sistemi:
 *  - Kişisel giriş (/giris): veli, öğrenci (kurumun açtığı öğrenci hesabı dahil), öğretmen, yönetici
 *  - Kurum girişi (/kurum-giris): etüt merkezi / dershane personeli (sahip, müdür, öğretmen, muhasebe)
 * Girişten sonra herkes rolüne göre kendi paneline gider.
 */
export function LoginTabs({ active }: { active: "personal" | "center" }) {
  const tabs = [
    { key: "personal", href: "/giris", label: "Kişisel giriş", hint: "Veli · öğrenci · öğretmen" },
    { key: "center", href: "/kurum-giris", label: "Kurum girişi", hint: "Etüt merkezi / dershane personeli" },
  ] as const;
  return (
    <nav className="mb-6 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1" aria-label="Giriş türü">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={active === tab.key ? "page" : undefined}
          className={cn("rounded-lg px-3 py-2 text-center", active === tab.key ? "bg-white shadow-sm" : "hover:bg-white/60")}
        >
          <span className={cn("block text-sm font-semibold", active === tab.key ? "text-brand-700" : "text-slate-700")}>{tab.label}</span>
          <span className="block text-[11px] text-slate-500">{tab.hint}</span>
        </Link>
      ))}
    </nav>
  );
}
