/**
 * Arka plan görevlerini ayrı bir süreçte çalıştırır (canlı ortam için önerilir).
 * Kullanım: npm run worker   (Next tarafında DISABLE_INTERNAL_SCHEDULER=true)
 * Tek seferlik çalıştırma: npm run worker -- --once
 */
import { runScheduledTasks, startScheduler } from "@/server/scheduler";

if (process.argv.includes("--once")) {
  const summary = await runScheduledTasks();
  console.log(summary ?? "Başka bir süreç görevleri çalıştırıyor.");
  process.exit(0);
} else {
  console.log("Zamanlayıcı başladı (dakikada bir). Durdurmak için Ctrl+C.");
  startScheduler();
}
