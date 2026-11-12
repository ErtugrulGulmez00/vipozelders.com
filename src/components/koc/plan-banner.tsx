import Link from "next/link";
import { Alert } from "@/components/ui/primitives";
import type { CoachPlan } from "@/lib/pi-koc";

/** Pi Koç panelinin tepesindeki paket uyarısı: sınır aşımı, biten ücretli paket, eski deneme. */
export function CoachPlanBanner({ plan, active }: { plan: CoachPlan; active: number }) {
  const link = (
    <Link href="/koc/abonelik" className="font-semibold underline">
      Paketler ve ödeme
    </Link>
  );
  if (!plan.paid && active > plan.studentLimit) {
    return (
      <Alert tone="error" title={`Ücretsiz pakette en fazla ${plan.studentLimit} öğrenci olur; ${active} aktif öğrenciniz var`} className="mb-6">
        Kayıtlarınızın hepsi duruyor, ancak yeni kayıt girilemiyor. Paketinizi yenileyin ya da öğrencileri arşive alarak {plan.studentLimit} öğrenciye inin. {link}
      </Alert>
    );
  }
  if (plan.state === "paid" && plan.daysLeft !== null && plan.daysLeft <= 0) {
    return (
      <Alert tone="warning" title="Paket ödemeniz gecikti" className="mb-6">
        Birkaç gün içinde ödeme yapılmazsa hesabınız ücretsiz pakete döner; kayıtlarınız silinmez. {link}
      </Alert>
    );
  }
  if (plan.state === "paid" && plan.daysLeft !== null && plan.daysLeft <= 7) {
    return (
      <Alert tone="info" title={`Paketinizin bitmesine ${plan.daysLeft} gün kaldı`} className="mb-6">
        Yenilemezseniz hesabınız ücretsiz pakete döner; kayıtlarınız silinmez. {link}
      </Alert>
    );
  }
  if (plan.state === "trial" && plan.daysLeft !== null && plan.daysLeft <= 7) {
    return (
      <Alert tone="info" title={`Deneme sürenizin bitmesine ${plan.daysLeft} gün kaldı`} className="mb-6">
        Deneme bitince hesabınız ücretsiz pakete geçer; kayıtlarınız silinmez. {link}
      </Alert>
    );
  }
  return null;
}
