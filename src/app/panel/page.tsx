import { redirect } from "next/navigation";
import { sideHome } from "@/lib/sides";
import { getCurrentUser } from "@/server/auth/current-user";
import { sideFacts } from "@/server/sides";

export const instant = false;

/** Kişiyi istenen taraftaki paneline gönderir (?taraf=kurum, koc ya da özel ders); "Panelim" bağlantıları buraya gelir. */
export default async function PanelRedirectPage({ searchParams }: PageProps<"/panel">) {
  const taraf = (await searchParams).taraf;
  const side = taraf === "kurum" || taraf === "koc" ? taraf : "ozel";
  const user = await getCurrentUser();
  if (!user) redirect(side === "kurum" ? "/kurum-giris" : side === "koc" ? "/koc-giris" : "/giris");
  if (user.mustChangePassword) redirect("/sifre-degistir");
  redirect(sideHome(await sideFacts(user.id, user.role), side));
}
