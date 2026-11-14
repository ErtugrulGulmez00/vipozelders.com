import "server-only";
import { SEAT_WINDOW_DAYS, seatProblem, UNDO_HOURS, type SeatState } from "@/lib/koc-seats";
import { CenterError } from "./center/errors";
import { db, type DbTransaction } from "./db";

type Tx = DbTransaction | typeof db;

/** Pi Koç hesabının koltuk durumu: aktif öğrenci ve son 30 günde arşive alınan (eklendikten 24 saat sonra) öğrenci sayısı */
export async function loadSeatState(centerId: string, limit: number, now = new Date(), tx: Tx = db): Promise<SeatState> {
  const since = new Date(now.getTime() - SEAT_WINDOW_DAYS * 86_400_000);
  const [active, rows] = await Promise.all([
    tx.centerStudent.count({ where: { centerId, status: "ACTIVE" } }),
    tx.$queryRaw<{ n: bigint }[]>`
      SELECT count(*)::bigint AS n FROM "CenterStudent"
      WHERE "centerId" = ${centerId} AND status <> 'ACTIVE' AND "archivedAt" >= ${since}
        AND "archivedAt" - "createdAt" > make_interval(hours => ${UNDO_HOURS})`,
  ]);
  return { limit, active, recentlyArchived: Number(rows[0]?.n ?? 0) };
}

/**
 * Pi Koç'ta öğrenci aktif edilmeden (yeni öğrenci, arşivden dönüş, ders talebi kabulü) önce çağrılır; kurala uymuyorsa
 * CenterError fırlatır. reactivate: arşivden dönen öğrenci.
 */
export async function assertCoachSeat(
  centerId: string,
  limit: number,
  options: { reactivate?: { archivedAt: Date | null; createdAt: Date }; now?: Date; tx?: Tx } = {},
): Promise<void> {
  const problem = await coachSeatProblem(centerId, limit, options);
  if (problem) throw new CenterError(problem);
}

export async function coachSeatProblem(
  centerId: string,
  limit: number,
  { reactivate, now = new Date(), tx = db }: { reactivate?: { archivedAt: Date | null; createdAt: Date }; now?: Date; tx?: Tx } = {},
): Promise<string | null> {
  const state = await loadSeatState(centerId, limit, now, tx);
  const since = now.getTime() - SEAT_WINDOW_DAYS * 86_400_000;
  const countedInRecent = Boolean(
    reactivate?.archivedAt && reactivate.archivedAt.getTime() >= since && reactivate.archivedAt.getTime() - reactivate.createdAt.getTime() > UNDO_HOURS * 3_600_000,
  );
  return seatProblem(state, now, reactivate ? { archivedAt: reactivate.archivedAt, countedInRecent } : undefined);
}
