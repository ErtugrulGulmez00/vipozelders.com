import "server-only";
import { coachPlan, formatHours, meetingAllowance, meetingMinutes, meetingPolicy, type MeetingAllowance, type MeetingPolicy } from "@/lib/pi-koc";
import { toLocalDateString, zonedDateTime } from "@/lib/dates";
import { db } from "./db";
import { notify, notifyRole } from "./notifications";
import { loadSettings } from "./settings";
import { closeClassroom } from "./video";

// Pi Koç görüntülü görüşme kullanımı: LiveKit olaylarından görüşme kaydı, aylık kullanım, giriş izni ve sınır denetimi.

const STUDENT_ROOM = /^koc-(.+)$/;
/** Olayı gelmeyen (kopan) görüşme en fazla bu kadar sayılır, sonra kapatılır */
const STALE_MINUTES = 180;
/**
 * Bu süreden kısa ara verilip yeniden girilen görüşme aynı görüşme sayılır: sayfa yenilemek ya da ikisinin birden çıkıp
 * girmesi ücretsiz paketin görüşme başına süresini sıfırlamaz.
 */
export const MEETING_RESUME_MINUTES = 10;

/** Odada süren ya da kısa süre önce biten (devam ettirilebilecek) görüşme. */
async function resumableMeeting(roomName: string, now: Date) {
  return db.coachMeeting.findFirst({
    where: { roomName, OR: [{ endedAt: null }, { endedAt: { gt: new Date(now.getTime() - MEETING_RESUME_MINUTES * 60_000) } }] },
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true, endedAt: true, free: true },
  });
}

/** İstanbul saatine göre ayın ilk anı. */
export function monthStartOf(now: Date): Date {
  return zonedDateTime(`${toLocalDateString(now).slice(0, 7)}-01`, 0);
}

async function centerPolicy(centerId: string) {
  const [center, settings] = await Promise.all([
    db.center.findUniqueOrThrow({ where: { id: centerId }, select: { status: true, trialEndsAt: true, paidUntil: true, studentLimit: true } }),
    loadSettings(),
  ]);
  const plan = coachPlan(center, settings.piKocFreeStudents);
  return { plan, policy: meetingPolicy(plan, settings) };
}

/** Bu ay kullanılan görüşme dakikası. */
export async function coachMeetingUsage(centerId: string, now = new Date()): Promise<number> {
  const monthStart = monthStartOf(now);
  const meetings = await db.coachMeeting.findMany({
    where: { centerId, OR: [{ endedAt: null }, { endedAt: { gt: monthStart } }] },
    select: { startedAt: true, endedAt: true },
  });
  return meetingMinutes(meetings, monthStart, now);
}

export type CoachMeetingStatus = { policy: MeetingPolicy; usedMinutes: number };

export async function coachMeetingStatus(centerId: string, now = new Date()): Promise<CoachMeetingStatus> {
  const [{ policy }, usedMinutes] = await Promise.all([centerPolicy(centerId), coachMeetingUsage(centerId, now)]);
  return { policy, usedMinutes };
}

/** Görüşme odasına giriş izni (koç ve öğrenci için aynı): ücretsiz pakette havuz dolduysa reddedilir. */
export async function coachMeetingAllowance(studentId: string, now = new Date()): Promise<MeetingAllowance> {
  const student = await db.centerStudent.findUnique({ where: { id: studentId }, select: { centerId: true } });
  if (!student) return { ok: false, reason: "Görüşme odası bulunamadı." };
  const [{ policy, usedMinutes }, current] = await Promise.all([coachMeetingStatus(student.centerId, now), resumableMeeting(`koc-${studentId}`, now)]);
  const allowance = meetingAllowance(policy, usedMinutes);
  // Ücretsiz pakette görüşme başına süre, görüşmenin başladığı andan sayılır (yeniden girişte sıfırlanmaz)
  if (!allowance.ok || !current?.free) return allowance;
  const perMeeting = policy.maxMeetingMinutes ?? (await loadSettings()).piKocFreeMeetingMinutes;
  const left = Math.floor(perMeeting - (now.getTime() - current.startedAt.getTime()) / 60_000);
  if (left < 1) {
    return { ok: false, reason: `Bu görüşmenin ücretsiz paketteki süresi (${perMeeting} dk) doldu. ${MEETING_RESUME_MINUTES} dakika sonra yeni görüşme başlatabilir ya da ücretli pakete geçerek süre sınırını kaldırabilirsiniz.` };
  }
  return { ...allowance, minutes: Math.min(allowance.minutes, left) };
}

/** LiveKit katılım olayı (koc-<öğrenci> odası). Veli izleyici sayılmaz. */
export async function handleCoachRoomEvent(roomName: string, identity: string, event: string | undefined, now = new Date()) {
  const studentId = STUDENT_ROOM.exec(roomName)?.[1];
  if (!studentId || identity.includes(":izleyici:")) return;
  if (event !== "participant_joined" && event !== "participant_left") return;
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`koc-meeting:${roomName}`}))`;
    const open = await tx.coachMeeting.findFirst({ where: { roomName, endedAt: null }, orderBy: { startedAt: "desc" } });
    if (event === "participant_joined") {
      // Kısa ara sonrası yeniden giriş: biten görüşme devam ettirilir (süre baştan başlamaz)
      if (!open) {
        const recent = await tx.coachMeeting.findFirst({ where: { roomName, endedAt: { gt: new Date(now.getTime() - MEETING_RESUME_MINUTES * 60_000) } }, orderBy: { startedAt: "desc" } });
        if (recent) {
          await tx.coachMeeting.update({ where: { id: recent.id }, data: { endedAt: null, activeCount: 1 } });
          return;
        }
      }
      if (open) {
        await tx.coachMeeting.update({ where: { id: open.id }, data: { activeCount: { increment: 1 }, peakCount: Math.max(open.peakCount, open.activeCount + 1) } });
        return;
      }
      const student = await tx.centerStudent.findUnique({ where: { id: studentId }, select: { centerId: true } });
      if (!student) return;
      const { plan } = await centerPolicy(student.centerId);
      await tx.coachMeeting.create({ data: { centerId: student.centerId, studentId, roomName, free: !plan.paid, activeCount: 1, startedAt: now } });
      return;
    }
    if (!open) return;
    const left = Math.max(0, open.activeCount - 1);
    await tx.coachMeeting.update({ where: { id: open.id }, data: { activeCount: left, endedAt: left === 0 ? now : null } });
  });
}

/**
 * Dakikada bir: ücretsiz pakette süresi (görüşme başına ya da aylık havuz) dolan görüşmenin odası kapatılır;
 * olayı gelmeyen eski görüşmeler kapatılır; ücretli pakette havuz aşılınca koça ve yönetime ayda bir kez haber verilir.
 */
export async function enforceCoachMeetings(now = new Date()): Promise<number> {
  let done = 0;
  const open = await db.coachMeeting.findMany({ where: { endedAt: null }, select: { id: true, centerId: true, roomName: true, free: true, startedAt: true } });
  const statusCache = new Map<string, CoachMeetingStatus>();
  for (const m of open) {
    const elapsed = (now.getTime() - m.startedAt.getTime()) / 60_000;
    if (elapsed > STALE_MINUTES) {
      await db.coachMeeting.update({ where: { id: m.id }, data: { endedAt: new Date(m.startedAt.getTime() + STALE_MINUTES * 60_000), activeCount: 0 } });
      done++;
      continue;
    }
    if (!m.free) continue;
    const status = statusCache.get(m.centerId) ?? (await coachMeetingStatus(m.centerId, now));
    statusCache.set(m.centerId, status);
    // Görüşme ücretsizde başladıysa, sonradan ödeme gelse bile o görüşmenin süresi ücretsiz kurala tabidir
    const perMeeting = status.policy.maxMeetingMinutes ?? (await loadSettings()).piKocFreeMeetingMinutes;
    const overMeeting = elapsed >= perMeeting;
    const overPool = status.policy.hard && status.usedMinutes >= status.policy.poolMinutes;
    if (overMeeting || overPool) {
      await closeClassroom(m.roomName);
      const end = overMeeting ? new Date(m.startedAt.getTime() + perMeeting * 60_000) : now;
      await db.coachMeeting.update({ where: { id: m.id }, data: { endedAt: end, activeCount: 0 } });
      done++;
    }
  }
  done += await notifyPaidOverPool(now);
  return done;
}

/** Ücretli pakette aylık havuzu aşan koça ve yönetime ayda bir kez bildirim (görüşme kesilmez). */
async function notifyPaidOverPool(now: Date): Promise<number> {
  const monthStart = monthStartOf(now);
  const centers = await db.coachMeeting.findMany({ where: { free: false, OR: [{ endedAt: null }, { endedAt: { gt: monthStart } }] }, distinct: ["centerId"], select: { centerId: true } });
  let sent = 0;
  for (const { centerId } of centers) {
    const { policy, usedMinutes } = await coachMeetingStatus(centerId, now);
    if (policy.hard || usedMinutes < policy.poolMinutes) continue;
    const owners = await db.centerMember.findMany({ where: { centerId, role: "OWNER", isActive: true }, select: { userId: true } });
    const already = await db.notification.count({ where: { type: "center.koc_meeting_pool", userId: { in: owners.map((o) => o.userId) }, createdAt: { gte: monthStart } } });
    if (already) continue;
    const center = await db.center.findUniqueOrThrow({ where: { id: centerId }, select: { name: true } });
    for (const o of owners) {
      await notify({
        userId: o.userId,
        type: "center.koc_meeting_pool",
        title: "Bu ayki görüşme süreniz doldu",
        body: `Paketinizin aylık görüntülü görüşme süresi (${formatHours(policy.poolMinutes)}) doldu. Görüşmeleriniz kesilmez; düzenli olarak aşıyorsanız bir üst pakete geçin.`,
        link: "/koc/abonelik",
      });
    }
    await notifyRole("ADMIN", { type: "center.koc_meeting_pool", title: `${center.name}: görüşme havuzu aşıldı`, body: `Bu ay ${formatHours(usedMinutes)} / ${formatHours(policy.poolMinutes)}. Üst pakete geçiş için arayın.`, link: `/yonetim/kurumlar/${centerId}`, email: false });
    sent++;
  }
  return sent;
}
