import type { Metadata } from "next";
import { Suspense } from "react";
import { verifyEmailAction } from "@/actions/auth";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Card, Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "E-posta doğrulama" };

export default function VerifyEmailPage({ params }: PageProps<"/eposta-dogrula/[token]">) {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">E-posta adresinizi doğrulayın</h1>
      <p className="mt-1 text-sm text-slate-500">Doğrulamayı tamamlamak için aşağıdaki butona tıklayın.</p>
      <Suspense fallback={<Skeleton className="mt-6 h-12" />}>
        <VerifyForm params={params} />
      </Suspense>
    </Card>
  );
}

async function VerifyForm({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    // Bağlantı tarayıcılar/e-posta tarayıcıları tarafından açılınca kendiliğinden tüketilmesin diye butonla onaylanır.
    <ActionForm action={verifyEmailAction} className="mt-6">
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="w-full" size="lg" pendingText="Doğrulanıyor…">
        E-postamı doğrula
      </SubmitButton>
    </ActionForm>
  );
}
