import type { Instrumentation } from "next";

// Sunucu açılışında arka plan görevlerini başlatır.
// Ayrı bir işçi süreci (`npm run worker`) kullanılacaksa DISABLE_INTERNAL_SCHEDULER=true yapın.
export async function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.DISABLE_INTERNAL_SCHEDULER !== "true"
  ) {
    const { startScheduler } = await import("./server/scheduler");
    startScheduler();
  }
}

// Sayfa, API ve form işlemlerinde oluşan sunucu hataları kaydedilir (Yönetim → Hatalar).
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordError } = await import("./server/errors");
  await recordError({ error, source: context.routeType, routePath: context.routePath, path: request.path.split("?")[0], method: request.method });
};
