import { Camera, Clock, MessageCircleQuestion, Repeat, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/button";
import { Alert, Card } from "@/components/ui/primitives";
import { formatMoney } from "@/lib/money";
import { getCurrentUser } from "@/server/auth/current-user";
import { creditBalance, parsePackages, singleQuestionPrice } from "@/server/credits";
import { db } from "@/server/db";
import { salesOpen } from "@/server/payments/service";
import { poolSubjects } from "@/server/question-pool";
import { loadSettings } from "@/server/settings";
import { AskQuestionForm, BuyCreditsForm } from "./forms";

export const metadata: Metadata = {
  title: "Soru sor: fotoğrafını çek, öğretmen çözsün",
  description: "Takıldığın sorunun fotoğrafını yükle; branş öğretmeni adım adım çözsün. Çözülmezse kredin iade edilir.",
};
export const instant = false;

export default async function AskQuestionPage() {
  const [settings, user, subjects] = await Promise.all([loadSettings(), getCurrentUser(), poolSubjects()]);
  const packages = parsePackages(settings.questionPackages);
  const single = singleQuestionPrice(packages);
  const offers = packages.map((p) => {
    const unit = Math.round(p.price / p.credits);
    return { ...p, unit, saving: single > 0 ? Math.max(0, Math.round((1 - unit / single) * 100)) : 0 };
  });
  const student = user?.role === "STUDENT" ? user : null;
  const now = new Date();
  const [balance, subscriptions] = student
    ? await Promise.all([
        creditBalance(student.id),
        db.questionSubscription.findMany({ where: { studentId: student.id, status: "ACTIVE", startsAt: { lte: now }, endsAt: { gt: now } }, include: { teacher: { select: { user: { select: { firstName: true, lastName: true } } } } } }),
      ])
    : [0, []];
  const open = salesOpen();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="max-w-2xl">
        <p className="text-sm font-semibold text-brand-700">Soru çözüm</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Takıldığın sorunun fotoğrafını çek, öğretmen çözsün</h1>
        <p className="mt-3 text-slate-600">
          Kredi al, soruyu gönder. Sorun, o kademe ve derste ders veren öğretmenlerimize düşer; ilk üstlenen öğretmen adım adım çözer. Her soru 1 kredi.
        </p>
      </div>

      <ul className="mt-8 grid gap-3 sm:grid-cols-3">
        {[
          { Icon: Camera, title: "Fotoğrafla gönder", text: "Tek soru, net fotoğraf. İstersen nerede takıldığını yaz." },
          { Icon: Clock, title: `En geç ${settings.questionAnswerHours} saat`, text: "Süresinde çözülmezse kredin otomatik iade edilir." },
          { Icon: ShieldCheck, title: "Anlamadıysan sor", text: `Çözüme bir kez ek soru sorabilir, ${settings.disputeWindowHours} saat içinde sorun bildirebilirsin.` },
        ].map(({ Icon, title, text }) => (
          <li key={title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <Icon className="size-5 text-brand-600" aria-hidden />
            <p className="mt-2 font-semibold text-slate-900">{title}</p>
            <p className="mt-1 text-sm text-slate-600">{text}</p>
          </li>
        ))}
      </ul>

      {subscriptions.length ? (
        <Card className="mt-10 border-violet-200 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <Repeat className="size-5 text-violet-600" aria-hidden /> Soru aboneliğiniz var
          </h2>
          <p className="mt-1 text-sm text-slate-600">Abonelik sorularınız kredi harcamaz; doğrudan öğretmeninize gider.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {subscriptions.map((sub) => (
              <LinkButton key={sub.id} href={`/hesabim/abonelikler/${sub.id}`} variant="outline">
                {sub.teacher.user.firstName} {sub.teacher.user.lastName.charAt(0)}. · {sub.levelName} {sub.subjectName}
              </LinkButton>
            ))}
          </div>
        </Card>
      ) : null}

      {student && balance > 0 ? (
        <Card className="mt-10 p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Soru gönder</h2>
            <Link href="/hesabim/krediler" className="text-sm font-medium text-brand-700 hover:underline">
              Kalan kredi: {balance}
            </Link>
          </div>
          {subjects.length ? (
            <AskQuestionForm subjects={subjects} balance={balance} />
          ) : (
            <Alert tone="info">Şu an soru çözen öğretmenimiz yok. Çok yakında burada olacak; krediniz güvende.</Alert>
          )}
        </Card>
      ) : null}

      <section className="mt-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Kredi paketleri</h2>
            <p className="text-sm text-slate-500">
              Fiyatlara KDV dahildir. Krediler {settings.creditValidityMonths} ay geçerlidir; {settings.creditRefundDays} gün içinde kullanılmayan kredilerin iadesini isteyebilirsin
              (kullanılan krediler tek soru fiyatından, {formatMoney(single)}, düşülür).
            </p>
          </div>
          {student ? (
            <Link href="/hesabim/sorularim" className="text-sm font-medium text-brand-700 hover:underline">
              Sorularım
            </Link>
          ) : null}
        </div>
        {!open ? (
          <Alert tone="info" className="mb-4" title="Çok yakında">
            Online ödeme altyapımız çok yakında açılıyor; kredi satışı o zaman başlayacak.
          </Alert>
        ) : null}
        {student ? (
          <BuyCreditsForm packages={offers} disabled={!open} />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {offers.map((p) => (
                <div key={p.credits} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <span className="text-sm font-medium text-slate-500">{p.credits === 1 ? "Tek soru" : `${p.credits} soru`}</span>
                  <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(p.price)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Soru başı {formatMoney(p.unit)}
                    {p.saving > 0 ? ` · %${p.saving} avantajlı` : ""}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {user ? (
                <p className="text-sm text-slate-600">Kredi almak ve soru sormak için veli/öğrenci hesabıyla giriş yapın.</p>
              ) : (
                <>
                  <LinkButton href="/kayit" size="lg">
                    <MessageCircleQuestion className="size-4" aria-hidden /> Ücretsiz üye ol
                  </LinkButton>
                  <LinkButton href="/giris?next=/soru-sor" variant="outline" size="lg">
                    Giriş yap
                  </LinkButton>
                </>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
