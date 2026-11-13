import type { Metadata } from "next";
import { connection } from "next/server";
import { LockedFeature } from "@/components/koc/locked-feature";
import { PlacementRobot } from "@/components/placement/robot";
import { PageHeader } from "@/components/ui/primitives";
import { coachFeatureOpen, COACH_FEATURES } from "@/lib/pi-koc";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "LGS tercih robotu" };

export default async function KocLGSRobotPage({ searchParams }: PageProps<"/koc/lgs-tercih">) {
  await connection();
  const ctx = await requireCenter("students.view");
  if (!coachFeatureOpen(ctx.coach, "lgsRobot")) {
    return (
      <>
        <PageHeader title="LGS tercih robotu" description={COACH_FEATURES.lgsRobot.text} />
        <LockedFeature feature="lgsRobot" className="max-w-xl" />
      </>
    );
  }
  return <PlacementRobot exam="LGS" centerId={ctx.center.id} sp={await searchParams} basePath="/koc/lgs-tercih" />;
}
