import type { Metadata } from "next";
import { ThreadList } from "@/components/panel/thread-view";
import { PageHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { listThreads } from "@/server/messages";

export const metadata: Metadata = { title: "Mesajlar" };

export default async function TeacherMessagesPage() {
  const user = await requireRole("TEACHER");
  const threads = await listThreads(user.id, "teacher");
  return (
    <>
      <PageHeader title="Mesajlar" description="Velilerin ve öğrencilerin size yazdıkları. Hızlı cevap vermek ders talebine dönüşmeyi artırır. İletişim bilgileri gizlenir; ders ve ödeme site üzerinden yapılmalıdır." />
      <ThreadList threads={threads} viewer="teacher" basePath="/ogretmen-paneli/mesajlar" />
    </>
  );
}
