import { Skeleton } from "@/components/ui/primitives";

/** Panel sayfaları arasında geçerken anında gösterilen iskelet. */
export function PanelLoading() {
  return (
    <div aria-busy="true" aria-label="Yükleniyor">
      <Skeleton className="mb-2 h-8 w-64" />
      <Skeleton className="mb-6 h-4 w-96 max-w-full" />
      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
      <Skeleton className="mt-6 h-72 rounded-2xl" />
    </div>
  );
}
