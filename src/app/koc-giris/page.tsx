import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GateLoginShell } from "@/components/auth/gate-login";
import { LoginForm } from "@/components/auth/login-form";
import { kocHome, sideHome } from "@/lib/sides";
import { getCurrentUser } from "@/server/auth/current-user";
import { sideFacts } from "@/server/sides";

export const metadata: Metadata = {
  title: "Pi Koç girişi",
  description: "Bireysel koçlar ve öğrencileri için Pi Koç girişi.",
  robots: { index: false },
};

/** Pi Koç kapısı: koç /koc paneline, öğrencisi ve velisi /kocum ekranına girer (aynı hesap sistemi). */
export default function KocLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f5fb]" />}>
      <KocLogin />
    </Suspense>
  );
}

async function KocLogin() {
  const user = await getCurrentUser();
  // Zaten oturum açmış ve Pi Koç tarafı olan kişi doğrudan oraya geçer
  if (user && !user.mustChangePassword) {
    const facts = await sideFacts(user.id, user.role);
    if (kocHome(facts)) redirect(sideHome(facts, "koc"));
  }
  return (
    <GateLoginShell
      gate="koc"
      title="Pi Koç girişi"
      subtitle="Koç ve öğrenci girişi"
      footer={
        <>
          <p>Öğrenci giriş bilgilerini koçu verir; ilk girişte kendi şifrenizi belirlersiniz.</p>
          <p>
            Koç musunuz?{" "}
            <Link href="/pi-koc/kayit" className="font-semibold text-brand-700 hover:underline">
              Hemen ücretsiz deneyin
            </Link>
          </p>
        </>
      }
    >
      <LoginForm gate="koc" />
    </GateLoginShell>
  );
}
