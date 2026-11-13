import type { Metadata } from "next";
import { connection } from "next/server";
import { LockedFeature } from "@/components/koc/locked-feature";
import { PlacementRobot } from "@/components/placement/robot";
import { PageHeader } from "@/components/ui/primitives";
import { coachFeatureOpen, COACH_FEATURES } from "@/lib/pi-koc";
import { requireCenter } from "@/server/center/context";

export const metadata: Metadata = { title: "YKS tercih robotu" };

export default async function KocYKSRobotPage({ searchParams }: PageProps<"/koc/yks-tercih">) {
  await connection();
  const ctx = await requireCenter("students.view");
  if (!coachFeatureOpen(ctx.coach, "yksRobot")) {
    return (
      <>
        <PageHeader title="YKS tercih robotu" description={COACH_FEATURES.yksRobot.text} />
        <LockedFeature feature="yksRobot" className="max-w-xl" />
      </>
    );
  }
  return <PlacementRobot exam="YKS" centerId={ctx.center.id} sp={await searchParams} basePath="/koc/yks-tercih" />;
}
