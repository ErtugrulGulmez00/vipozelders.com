import type { Metadata } from "next";
import { ThreadList } from "@/components/panel/thread-view";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { listThreads } from "@/server/messages";

export const metadata: Metadata = { title: "Mesajlar" };

export default async function StudentMessagesPage() {
  const user = await requireRole("STUDENT");
  const threads = await listThreads(user.id, "student");
  return (
    <>
      <PageHeader title="Mesajlar" description="Öğretmenlerle yazışmalarınız. Güvenliğiniz için iletişim bilgileri gizlenir; öğretmen ders talebinizi kabul edince telefonunuzu görür." />
      <ThreadList threads={threads} viewer="student" basePath="/hesabim/mesajlar" />
    </>
  );
}
