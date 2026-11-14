import { ListChecks, Target } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PLACEMENT_EXAMS, type PlacementExamName } from "@/lib/placement";

/** Herkese açık tercih robotunda sağ sütun: öğrenciye liste hazırlamak için Pi Koç ve kurum paneli */
export function PublicRobotAside({ exam, freeStudents }: { exam: PlacementExamName; freeStudents: number }) {
  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-5">
        <p className="flex items-center gap-2 font-bold text-ink-900">
          <ListChecks className="size-5 text-brand-600" aria-hidden /> Öğrencinize tercih listesi hazırlayın
        </p>
        <p className="mt-2 text-sm text-slate-600">
          Koç ya da öğretmenseniz Pi Koç&apos;ta öğrenci başına {PLACEMENT_EXAMS[exam].listMax} tercihlik liste, not ve çıktı hazırlarsınız. Hedef okulu seçtiğinizde denemelerdeki puanla tabana ne kadar kaldığı da görünür.
        </p>
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-700">
          <Target className="size-3.5" aria-hidden /> {freeStudents > 0 ? `${freeStudents} öğrenciye kadar ücretsiz başlayın` : "Paketleri inceleyin"}
        </p>
        <Link href="/pi-koc" className={buttonClasses("primary", "md", "mt-4 w-full")}>
          Pi Koç&apos;u ücretsiz deneyin
        </Link>
      </div>
      <div className="rounded-3xl border border-slate-200 bg-white p-5">
        <p className="font-bold text-ink-900">Etüt merkezi misiniz?</p>
        <p className="mt-1 text-sm text-slate-600">Kurum panelinde bütün öğrencileriniz için tercih listesi, deneme analizi ve veli raporu tek yerde.</p>
        <Link href="/kurumlar-icin" className={buttonClasses("outline", "sm", "mt-3 w-full")}>
          Kurum panelini inceleyin
        </Link>
      </div>
    </div>
  );
}
