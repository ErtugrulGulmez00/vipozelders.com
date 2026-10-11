import { SearchX } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export function NotFoundContent() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-4 py-24 text-center">
      <SearchX className="size-12 text-brand-400" aria-hidden />
      <h1 className="mt-4 text-2xl font-bold text-slate-900">Aradığınız sayfa bulunamadı</h1>
      <p className="mt-2 text-slate-600">Bağlantı eski olabilir ya da sayfa kaldırılmış olabilir. Öğretmen listemizden yeniden arayabilirsiniz.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/ogretmenler" className={buttonClasses("primary", "md")}>
          Öğretmen bul
        </Link>
        <Link href="/" className={buttonClasses("outline", "md")}>
          Ana sayfa
        </Link>
      </div>
    </div>
  );
}
