// Pi Koç öğrenci koltuğu kuralı: paket sınırı "arşive al, yenisini ekle, sonra eskisini geri aç" döngüsüyle aşılamaz.
// 1) Arşive alınan öğrenci 30 gün tekrar aktif edilemez (yanlışlıkla arşivleme ilk 24 saatte geri alınabilir).
// 2) Son 30 günde arşive alınanlar da sayılır: aktif + yakında arşivlenen, sınır + değişim payını geçemez
//    (ör. 5 öğrencilik pakette ayda 2 öğrenci değiştirilebilir; gerçekten ayrılan öğrencinin yerine yenisi gelir).
// Paket düşünce sistemin arşive aldığı öğrencilerin arşiv zamanı tutulmaz: kurala girmez, ödeme gelince geri açılır.

export const REACTIVATE_COOLDOWN_DAYS = 30;
export const UNDO_HOURS = 24;
export const SEAT_WINDOW_DAYS = 30;

/** Son 30 günde paket sınırının üstünde izin verilen öğrenci değişimi */
export function churnAllowance(limit: number): number {
  return Math.max(1, Math.ceil(limit * 0.4));
}

const DAY = 86_400_000;

export type SeatState = {
  limit: number;
  active: number;
  /** Son 30 günde arşive alınan (şu an aktif olmayan) öğrenciler; eklendikten sonraki 24 saatte arşivlenenler sayılmaz */
  recentlyArchived: number;
};

/**
 * Öğrenci aktif edilebilir mi? null: evet; metin: neden olmadığı.
 * reactivate: arşivden dönen öğrencinin arşiv zamanı (ve kendisi yakın arşiv sayısına dahilse true).
 */
export function seatProblem(state: SeatState, now: Date, reactivate?: { archivedAt: Date | null; countedInRecent: boolean }): string | null {
  if (reactivate?.archivedAt) {
    const age = now.getTime() - reactivate.archivedAt.getTime();
    if (age > UNDO_HOURS * 3_600_000 && age < REACTIVATE_COOLDOWN_DAYS * DAY) {
      const until = new Date(reactivate.archivedAt.getTime() + REACTIVATE_COOLDOWN_DAYS * DAY);
      const day = until.toLocaleDateString("tr-TR", { day: "numeric", month: "long", timeZone: "Europe/Istanbul" });
      return `Arşive alınan öğrenci ${REACTIVATE_COOLDOWN_DAYS} gün dolmadan tekrar aktif edilemez; ${day} tarihinden sonra aktif edebilirsiniz. Yanlışlıkla arşivlediyseniz ilk ${UNDO_HOURS} saat içinde geri alabilirsiniz.`;
    }
  }
  if (state.active >= state.limit) return `Paketinizin öğrenci sınırı ${state.limit}. Önce bir öğrenciyi arşive alın ya da paketinizi yükseltin.`;
  const recent = state.recentlyArchived - (reactivate?.countedInRecent ? 1 : 0);
  const cap = state.limit + churnAllowance(state.limit);
  if (state.active + recent >= cap) {
    return `Son ${SEAT_WINDOW_DAYS} günde paketinizde en fazla ${cap} farklı öğrenci takip edilebilir (${state.limit} öğrenci + ${cap - state.limit} değişim hakkı). Yakında arşive aldığınız öğrenciler bu sayıya dahil. Daha fazla öğrenci için paketinizi yükseltin.`;
  }
  return null;
}
