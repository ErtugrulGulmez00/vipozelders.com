import { ChevronDown, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Öğretmen kuralları. Özel derste ödemeye aracılık edilmez: velinin telefonu ders talebi kabul edilince görünür,
 * ücreti öğretmen veliyle konuşup kendisi alır. Kabulden önce mesajda iletişim bilgisi paylaşılmaz.
 */
export const PLATFORM_RULES_TITLE = "Öğretmen kuralları";
export const PLATFORM_RULES = [
  "Velinin telefon numarası, ders talebini kabul ettiğinizde görünür. Kabulden önce mesajlarda telefon, e-posta, sosyal medya hesabı ya da adres istenemez ve verilemez.",
  "Ders ücretini veliyle siz konuşur ve kendiniz alırsınız; Pi Kampüs ücrete karışmaz, komisyon almaz. Profilinizdeki fiyatlar veliye bilgi içindir; onlarla tutarlı olun.",
  "Veliye ve öğrenciye saygılı davranın, profilinizdeki bilgiler doğru olsun. Şikâyet ve kurala aykırılık hâlinde hesabınız uyarı yapılmadan kapatılabilir.",
];

/**
 * Panelde ve ders öncesinde gösterilen uyarı kutusu. compact: sanal sınıf üst şeridi gibi dar alanlar.
 * collapsible: her gün açılan özet ekranında tek satır; ayrıntı tıklayınca açılır.
 */
export function PlatformRules({ compact = false, collapsible = false, className }: { compact?: boolean; collapsible?: boolean; className?: string }) {
  if (collapsible) {
    return (
      <details className={cn("group rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900", className)}>
        <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
          <ShieldAlert className="size-4 shrink-0 text-amber-600" aria-hidden />
          <span className="flex-1">
            <strong>Kurallar:</strong> Telefon, talep kabul edilince paylaşılır; ücreti veliyle siz konuşursunuz.
          </span>
          <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          {PLATFORM_RULES.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
      </details>
    );
  }
  if (compact) {
    return (
      <p className={cn("flex items-start gap-2 bg-rose-700 px-4 py-2 text-xs text-white", className)}>
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong>Hatırlatma:</strong> Ders sırasında öğrenciden kişisel bilgi istemek ve uygunsuz davranış yasaktır; şikâyet hâlinde hesabınız kalıcı olarak kapatılır.
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
