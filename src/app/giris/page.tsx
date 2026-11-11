import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GateLoginShell } from "@/components/auth/gate-login";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Giriş yap" };

/** Özel ders kapısı: veli, öğrenci, öğretmen ve yönetici. */
export default function LoginPage() {
  return (
    <GateLoginShell
      gate="personal"
      title="Giriş yap"
      subtitle="E-posta adresiniz ya da size verilen kullanıcı adıyla"
      footer={
        <p>
          Hesabınız yok mu?{" "}
          <Link href="/kayit" className="font-semibold text-brand-700 hover:underline">
            Ücretsiz kayıt olun
          </Link>
        </p>
      }
    >
      <Suspense fallback={<Skeleton className="h-56" />}>
        <LoginForm />
      </Suspense>
    </GateLoginShell>
  );
}
