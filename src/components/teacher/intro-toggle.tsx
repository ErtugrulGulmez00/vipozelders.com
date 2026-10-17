"use client";

import { setOffersIntroAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Checkbox } from "@/components/ui/form";

/** Öğretmenin ücretsiz 15 dakikalık tanışma görüşmesi sunma tercihi. */
export function IntroToggle({ on }: { on: boolean }) {
  return (
    <ActionForm action={setOffersIntroAction} className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Checkbox name="offersIntro" defaultChecked={on} label="Ücretsiz 15 dakikalık tanışma görüşmesi sunuyorum" />
        <p className="mt-1 pl-6.5 text-xs text-slate-500">
          Veliler sizi tanımak için ödeme yapmadan 15 dakikalık online görüşme ister; siz onaylarsınız. Profilinizde “Ücretsiz tanışma” rozeti görünür. Tanışmayı deneyen veliler ders almaya çok daha yatkındır.
        </p>
      </div>
      <SubmitButton size="sm" variant="secondary">
        Kaydet
      </SubmitButton>
    </ActionForm>
  );
}
