import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GateLoginShell } from "@/components/auth/gate-login";
import { LoginForm } from "@/components/auth/login-form";
import { kurumHome, sideHome } from "@/lib/sides";
import { getCurrentUser } from "@/server/auth/current-user";
import { getCenterBranding } from "@/server/center/public";
import { sideFacts } from "@/server/sides";
import { uploadUrl } from "@/server/storage";

export const metadata: Metadata = {
  title: "Kurum paneli girişi",
  description: "Etüt merkezi personeli, öğrencileri ve velileri için Pi Kampüs kurum girişi.",
  robots: { index: false },
};

/** Kurum kapısı: aynı hesaplar; girişten sonra kişi kurum tarafını görür (personel /kurum, öğrenci ve veli /hesabim/kurum). */
export default function CenterLoginPage({ searchParams }: PageProps<"/kurum-giris">) {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#f6f5fb]" />}>
      <CenterLogin searchParams={searchParams} />
    </Suspense>
  );
}

async function CenterLogin({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const slug = typeof sp.kurum === "string" ? sp.kurum.slice(0, 120) : "";
  const [user, branding] = await Promise.all([getCurrentUser(), slug ? getCenterBranding(slug) : Promise.resolve(null)]);
  // Zaten oturum açmış ve kurum tarafı olan kişi doğrudan oraya geçer.
  if (user && !user.mustChangePassword) {
    const facts = await sideFacts(user.id, user.role);
    if (kurumHome(facts)) redirect(sideHome(facts, "kurum"));
  }
  const logo = branding ? uploadUrl(branding.logoKey) : null;
  return (
    <GateLoginShell
      gate="center"
      title={branding ? branding.name : "Kurum girişi"}
      subtitle={branding ? "Personel, öğrenci ve veli girişi" : "Etüt merkezi personeli, öğrencisi ve velisi"}
      brand={logo ? <Image src={logo} alt="" width={48} height={48} unoptimized className="size-12 shrink-0 rounded-xl border border-slate-100 object-contain" /> : undefined}
      footer={
        <>
          <p>Personel ve öğrenci giriş bilgilerini kurum verir; ilk girişte kendi şifrenizi belirlersiniz. Veliler, kurumun davetiyle açtıkları hesapla girer.</p>
          <p>
            Kurumunuz henüz Pi Kampüs kullanmıyor mu?{" "}
            <Link href="/kurumlar-icin" className="font-semibold text-brand-700 hover:underline">
              Başvurun
            </Link>
          </p>
        </>
      }
    >
      <LoginForm gate="kurum" />
    </GateLoginShell>
  );
}
