import type { Metadata } from "next";
import { connection } from "next/server";
import { PlacementRobot } from "@/components/placement/robot";
import { coachFeatureOpen } from "@/lib/pi-koc";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "YKS tercih robotu" };

// Ücretsiz pakette arama açık; öğrenci listesi, not, yazdırma ve hedef okul ücretli pakette
export default async function KocYKSRobotPage({ searchParams }: PageProps<"/koc/yks-tercih">) {
  await connection();
  const ctx = await requireCenter("students.view");
  const open = coachFeatureOpen(ctx.coach, "yksRobot");
  return <PlacementRobot exam="YKS" centerId={ctx.center.id} sp={await searchParams} basePath="/koc/yks-tercih" listLocked={!open} targets={open && coachFeatureOpen(ctx.coach, "targetSchool")} />;
}
