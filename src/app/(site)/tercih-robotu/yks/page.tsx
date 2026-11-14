import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PublicRobotAside } from "@/components/placement/public-aside";
import { PlacementRobot } from "@/components/placement/robot";
import { breadcrumbJsonLd, JsonLd } from "@/components/site/json-ld";
import { Skeleton } from "@/components/ui/primitives";
import { getSiteSettings } from "@/server/site";

export const metadata: Metadata = {
  title: "YKS tercih robotu: üniversite taban puanları ve başarı sıraları",
  description: "YKS puanınızı ya da başarı sıranızı girin; programlar ÖSYM'nin geçen yılki taban puanlarına ve başarı sıralarına göre güvenli, uygun ve riskli diye ayrılsın. Ücretsiz, üyelik gerektirmez.",
  alternates: { canonical: "/tercih-robotu/yks" },
};

// Herkese açık YKS tercih robotu: arama ücretsiz ve üyeliksiz; öğrenci listesi Pi Koç ve kurum panelinde
export default function PublicYKSRobotPage({ searchParams }: PageProps<"/tercih-robotu/yks">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <JsonLd data={breadcrumbJsonLd([{ name: "Tercih robotu", path: "/tercih-robotu" }, { name: "YKS tercih robotu", path: "/tercih-robotu/yks" }])} />
      <Link href="/tercih-robotu" className="text-sm text-brand-700 hover:underline">
        ← Tercih robotu
      </Link>
      <div className="mt-3">
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <Robot searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function Robot({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const settings = await getSiteSettings();
  return <PlacementRobot exam="YKS" centerId="" sp={await searchParams} basePath="/tercih-robotu/yks" listLocked aside={<PublicRobotAside exam="YKS" freeStudents={settings.piKocFreeStudents} />} />;
}
