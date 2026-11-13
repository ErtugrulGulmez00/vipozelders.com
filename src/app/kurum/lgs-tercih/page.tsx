import type { Metadata } from "next";
import { connection } from "next/server";
import { PlacementRobot } from "@/components/placement/robot";
import { requireCenter, requireCenterModule } from "@/server/center/context";

export const metadata: Metadata = { title: "LGS tercih robotu" };

export default async function KurumLGSRobotPage({ searchParams }: PageProps<"/kurum/lgs-tercih">) {
  await connection();
  await requireCenterModule("lgs-tercih");
  const ctx = await requireCenter("students.view");
  return <PlacementRobot exam="LGS" centerId={ctx.center.id} sp={await searchParams} basePath="/kurum/lgs-tercih" />;
}
