import type { Metadata } from "next";
import { connection } from "next/server";
import { PlacementRobot } from "@/components/placement/robot";
import { requireCenter, requireCenterModule } from "@/server/center/context";

export const metadata: Metadata = { title: "YKS tercih robotu" };

export default async function KurumYKSRobotPage({ searchParams }: PageProps<"/kurum/yks-tercih">) {
  await connection();
  await requireCenterModule("yks-tercih");
  const ctx = await requireCenter("students.view");
  return <PlacementRobot exam="YKS" centerId={ctx.center.id} sp={await searchParams} basePath="/kurum/yks-tercih" />;
}
