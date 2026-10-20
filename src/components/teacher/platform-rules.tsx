import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/** Öğretmenler için platform kuralı: kişisel bilgi paylaşımı ve öğrenciyi platform dışına yönlendirme yasaktır. */
export const PLATFORM_RULES_TITLE = "Öğrenciyle kişisel iletişim ve platform dışı anlaşma yasaktır";
export const PLATFORM_RULES = [
  "Öğrenciye ya da veliye telefon numarası, e-posta, sosyal medya hesabı, adres veya IBAN gibi kişisel/iletişim bilgisi verilemez ve istenemez.",
  "Dersler, ödemeler ve yazışmalar yalnızca Pi Kampüs üzerinden yapılır; öğrenciyi platform dışında ders almaya ya da ödeme yapmaya yönlendirmek yasaktır.",
  "Bu kurallara uymayan öğretmenin hesabı uyarı yapılmadan kalıcı olarak kapatılır (platformdan çıkarılır) ve bekleyen hakedişleri incelemeye alınır.",
];

/** Panelde ve ders öncesinde gösterilen uyarı kutusu. compact: sanal sınıf üst şeridi gibi dar alanlar. */
export function PlatformRules({ compact = false, className }: { compact?: boolean; className?: string }) {
  if (compact) {
    return (
      <p className={cn("flex items-start gap-2 bg-rose-700 px-4 py-2 text-xs text-white", className)}>
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>Hatırlatma:</strong> Öğrenciye/veliye telefon, e-posta, sosyal medya ya da IBAN vermek ve öğrenciyi platform dışına yönlendirmek yasaktır; tespit edilirse hesabınız kalıcı olarak kapatılır.
        </span>
      </p>
    );
  }
  return (
    <div role="note" className={cn("rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900", className)}>
      <p className="flex items-center gap-2 font-semibold">
        <ShieldAlert className="size-5 shrink-0 text-rose-600" aria-hidden /> {PLATFORM_RULES_TITLE}
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        {PLATFORM_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ul>
    </div>
  );
}
