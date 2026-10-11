import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function RegisterPage() {
  return (
    <Card className="p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-slate-900">Ücretsiz kayıt olun</h1>
      <p className="mt-1 text-sm text-slate-500">Randevu almak, ödeme yapmak ve derslerinizi takip etmek için bir hesap oluşturun.</p>
      <div className="mt-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <RegisterForm />
        </Suspense>
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        Zaten hesabınız var mı?{" "}
        <Link href="/giris" className="font-semibold text-brand-700 hover:underline">
          Giriş yapın
        </Link>
      </p>
    </Card>
  );
}
