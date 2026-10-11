import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş yap" };

export default function LoginPage() {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Giriş yap</h1>
      <p className="mt-1 text-sm text-slate-500">Öğretmenler kendilerine verilen kullanıcı adıyla, veliler ve öğrenciler e-posta adresleriyle giriş yapar.</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-56" />}>
          <LoginForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        Hesabınız yok mu?{" "}
        <Link href="/kayit" className="font-semibold text-brand-700 hover:underline">
          Ücretsiz kayıt olun
        </Link>
      </p>
    </Card>
  );
}
