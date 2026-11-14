import Link from "next/link";
import type { ComponentProps } from "react";
import { needsFullLoad } from "@/lib/sides";

/** Panel geçiş bağlantısı: /panel-sec bir rotadır (çerez ayarlar), sayfa içi gezinmeyle değil tam yüklemeyle açılır. */
export function SwitchLink({ href, ...props }: ComponentProps<"a"> & { href: string }) {
  if (needsFullLoad(href)) return <a href={href} {...props} />;
  return <Link href={href} {...props} />;
}
