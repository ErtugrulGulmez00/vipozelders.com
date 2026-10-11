"use client";

import { Play } from "lucide-react";
import { runSchedulerAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";

export function SchedulerButton() {
  return (
    <ActionForm action={runSchedulerAction} className="max-w-xl">
      <SubmitButton variant="outline" size="sm" pendingText="Çalışıyor…">
        <Play className="size-4" aria-hidden /> Zamanlanmış görevleri şimdi çalıştır
      </SubmitButton>
    </ActionForm>
  );
}
