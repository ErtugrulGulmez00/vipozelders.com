"use client";

import { replyReviewAction } from "@/actions/teacher";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Textarea } from "@/components/ui/form";

export function ReplyForm({ reviewId, initial }: { reviewId: string; initial: string | null }) {
  return (
    <ActionForm action={replyReviewAction} className="mt-3 space-y-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <Textarea name="reply" rows={2} maxLength={1000} defaultValue={initial ?? ""} placeholder="Herkese açık yanıtınız (isteğe bağlı)" />
      <SubmitButton size="sm" variant="secondary">
        {initial ? "Yanıtı güncelle" : "Yanıtla"}
      </SubmitButton>
    </ActionForm>
  );
}
