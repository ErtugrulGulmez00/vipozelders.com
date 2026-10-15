import type { Metadata } from "next";
import { NotFoundContent } from "@/components/site/not-found-content";

export const metadata: Metadata = { title: "Sayfa bulunamadı" };

export default function SiteNotFound() {
  return <NotFoundContent />;
}
