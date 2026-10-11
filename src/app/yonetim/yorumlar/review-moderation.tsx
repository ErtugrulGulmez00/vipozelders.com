"use client";

import { setReviewStatusAction } from "@/actions/admin";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Input } from "@/components/ui/form";

export function ReviewModeration({ reviewId, status }: { reviewId: string; status: string }) {
  return (
    <ActionForm action={setReviewStatusAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="reviewId" value={reviewId} />
      <input type="hidden" name="status" value={status === "PUBLISHED" ? "HIDDEN" : "PUBLISHED"} />
      {status === "PUBLISHED" ? <Input name="reason" placeholder="Gizleme nedeni" className="h-8 w-48 text-xs" /> : null}
      <SubmitButton size="sm" variant={status === "PUBLISHED" ? "danger" : "outline"} pendingText="…">
        {status === "PUBLISHED" ? "Gizle" : "Yayınla"}
      </SubmitButton>
    </ActionForm>
  );
}
