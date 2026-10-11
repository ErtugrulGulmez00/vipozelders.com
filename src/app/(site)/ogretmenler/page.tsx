import type { Metadata } from "next";
import { Suspense } from "react";
import { TeacherListing, TeacherListingSkeleton } from "@/components/site/teacher-listing";

export const metadata: Metadata = {
  title: "Öğretmenler",
  description: "Kademe, ders, hizmet türü, konum ve fiyata göre özel ders öğretmeni bulun.",
};

export default function TeachersPage({ searchParams }: PageProps<"/ogretmenler">) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<TeacherListingSkeleton />}>
        <TeacherListing searchParams={searchParams} basePath="/ogretmenler" />
      </Suspense>
    </div>
  );
}
