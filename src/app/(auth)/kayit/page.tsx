import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@/components/ui/primitives";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Kayıt ol" };

export default function RegisterPage() {
  return (
    <Card className="p-6 sm:p-8">
      {/* Bu form veli/öğrenci hesabı açar; kurumlar başvuru formundan gelir. */}
      <Link href="/kurumlar-icin#basvuru" className="mb-6 flex items-center gap-3 rounded-2xl bg-ink-50 px-4 py-3 text-sm text-ink-700 hover:bg-ink-100">
        <span className="min-w-0 flex-1">
          <span className="font-bold text-ink-900">Kurum musunuz?</span> Etüt merkezleri için başvuru formu
        </span>
        <ArrowRight className="size-4 shrink-0" aria-hidden />
      </Link>
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
