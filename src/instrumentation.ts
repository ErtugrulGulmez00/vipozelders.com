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
