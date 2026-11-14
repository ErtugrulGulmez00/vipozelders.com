import type { Metadata } from "next";
import { connection } from "next/server";
import { PlacementRobot } from "@/components/placement/robot";
import { coachFeatureOpen } from "@/lib/pi-koc";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "LGS tercih robotu" };

// Ücretsiz pakette arama açık; öğrenci listesi, not, yazdırma ve hedef okul ücretli pakette
export default async function KocLGSRobotPage({ searchParams }: PageProps<"/koc/lgs-tercih">) {
  await connection();
  const ctx = await requireCenter("students.view");
  const open = coachFeatureOpen(ctx.coach, "lgsRobot");
  return <PlacementRobot exam="LGS" centerId={ctx.center.id} sp={await searchParams} basePath="/koc/lgs-tercih" listLocked={!open} targets={open && coachFeatureOpen(ctx.coach, "targetSchool")} />;
}
