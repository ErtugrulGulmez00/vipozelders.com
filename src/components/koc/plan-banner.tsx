import Link from "next/link";
import { Alert } from "@/components/ui/primitives";
import type { CoachPlan } from "@/lib/pi-koc";

/** Pi Koç panelinin tepesindeki paket uyarısı: sınır aşımı, biten ücretli paket, eski deneme. */
/** overLimitDaysLeft: sınır aşımında fazlaların kendiliğinden arşive alınmasına kalan gün */
export function CoachPlanBanner({ plan, active, overLimitDaysLeft }: { plan: CoachPlan; active: number; overLimitDaysLeft?: number | null }) {
  const link = (
    <Link href="/koc/abonelik" className="font-semibold underline">
      Paketler ve ödeme
    </Link>
  );
  if (!plan.paid && active > plan.studentLimit) {
    return (
      <Alert tone="error" title={`Ücretsiz pakette en fazla ${plan.studentLimit} öğrenci olur; ${active} aktif öğrenciniz var`} className="mb-6">
        Kayıtlarınızın hepsi duruyor, ancak yeni kayıt girilemiyor. Paketinizi yenileyin ya da Öğrencilerim sayfasından öğrencileri arşive alarak {plan.studentLimit} öğrenciye inin.
        {overLimitDaysLeft !== null && overLimitDaysLeft !== undefined ? ` ${overLimitDaysLeft} gün içinde inmezseniz en son eklenen ${active - plan.studentLimit} öğrenci kendiliğinden arşive alınır (kayıtları silinmez).` : null}{" "}
        {link}
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
  if (plan.state === "promo" && plan.daysLeft !== null && plan.daysLeft <= 5) {
    return (
      <Alert tone="info" title={`Deneme kodunuzun bitmesine ${plan.daysLeft} gün kaldı`} className="mb-6">
        Süre bitince ücretsiz pakete dönersiniz ve en fazla 3 öğrenci aktif kalabilir; kayıtlarınız silinmez. {link}
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
