import { randomUUID } from "node:crypto";
import { AccessToken, RoomServiceClient, WebhookReceiver } from "livekit-server-sdk";
import type { Booking } from "@/generated/prisma/client";
import { db } from "./db";
import { loadSettings } from "./settings";
import { videoConfigured } from "./video-config";

export { videoConfigured };

const CLOSE_AFTER_MINUTES = 15;

export type ClassroomAccess =
  | { ok: true; booking: Booking; role: "teacher" | "student"; opensAt: Date; closesAt: Date }
  | { ok: false; reason: string; booking?: Booking; opensAt?: Date };

/** Sanal sınıfa yalnızca o dersin öğretmeni ve öğrencisi, ders saatine yakın girebilir. */
export async function classroomAccess(bookingId: string, userId: string, now = new Date()): Promise<ClassroomAccess> {
  const booking = await db.booking.findUnique({ where: { id: bookingId } });
  if (!booking || (booking.teacherId !== userId && booking.studentId !== userId)) {
    return { ok: false, reason: "Bu derse erişim yetkiniz yok." };
  }
  if (booking.mode !== "ONLINE" || !booking.videoRoomName) {
    return { ok: false, reason: "Bu ders yüz yüze yapılıyor.", booking };
  }
  if (booking.status !== "CONFIRMED") {
    return { ok: false, reason: "Sanal sınıf yalnızca onaylanmış dersler için açılır.", booking };
  }
  const settings = await loadSettings();
  const opensAt = new Date(booking.startAt.getTime() - settings.classroomOpensMinutesBefore * 60_000);
  const closesAt = new Date(booking.endAt.getTime() + CLOSE_AFTER_MINUTES * 60_000);
  if (now < opensAt) return { ok: false, reason: "Sanal sınıf henüz açılmadı.", booking, opensAt };
  if (now > closesAt) return { ok: false, reason: "Bu dersin süresi doldu.", booking };
  return { ok: true, booking, role: booking.teacherId === userId ? "teacher" : "student", opensAt, closesAt };
}

/**
 * Sınıf anahtarı. observer: veli izleyici modu (öğrenci hesabının ikinci cihazı): kamera, mikrofon ve sohbet
 * yok, odada görünmez; yoklamaya sayılmaz (kimliği öğrencinin kimliğinden farklıdır).
 */
export async function createClassroomToken(
  access: Extract<ClassroomAccess, { ok: true }>,
  user: { id: string; firstName: string; lastName: string },
  now = new Date(),
  options: { observer?: boolean } = {},
): Promise<{ token: string; serverUrl: string }> {
  if (!videoConfigured()) throw new Error("Sanal sınıf yapılandırılmamış.");
  const observer = Boolean(options.observer) && access.role === "student";
  const ttlSeconds = Math.max(60, Math.round((access.closesAt.getTime() - now.getTime()) / 1000));
  const token = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: observer ? `${user.id}:izleyici:${randomUUID().slice(0, 8)}` : user.id,
    name: observer ? "Veli (izleyici)" : access.role === "teacher" ? `${user.firstName} ${user.lastName} (Öğretmen)` : `${user.firstName} ${user.lastName.charAt(0)}.`,
    ttl: ttlSeconds,
  });
  token.addGrant({
    roomJoin: true,
    room: access.booking.videoRoomName!,
    canPublish: !observer,
    canSubscribe: true,
    canPublishData: !observer,
    hidden: observer,
  });
  return { token: await token.toJwt(), serverUrl: process.env.LIVEKIT_URL! };
}

/** LiveKit webhook'u: katılım/ayrılma olaylarıyla yoklama tutar. */
export async function handleLiveKitWebhook(body: string, authorization: string | null): Promise<void> {
  if (!videoConfigured()) return;
  const receiver = new WebhookReceiver(process.env.LIVEKIT_API_KEY!, process.env.LIVEKIT_API_SECRET!);
  const event = await receiver.receive(body, authorization ?? undefined);
  const roomName = event.room?.name;
  const identity = event.participant?.identity;
  if (!roomName || !identity) return;

  const booking = await db.booking.findUnique({ where: { videoRoomName: roomName }, select: { id: true, teacherId: true, studentId: true } });
  if (!booking || (identity !== booking.teacherId && identity !== booking.studentId)) return;

  if (event.event === "participant_joined") {
    await db.lessonAttendance.create({ data: { bookingId: booking.id, userId: identity, joinedAt: new Date() } });
  } else if (event.event === "participant_left") {
    const open = await db.lessonAttendance.findFirst({
      where: { bookingId: booking.id, userId: identity, leftAt: null },
      orderBy: { joinedAt: "desc" },
    });
    if (open) await db.lessonAttendance.update({ where: { id: open.id }, data: { leftAt: new Date() } });
  }
}

/** Sanal sınıf sayfası açıldığında da katılım kaydı düşülür (webhook ulaşmazsa yedek). */
export async function recordClassroomVisit(bookingId: string, userId: string) {
  const recent = await db.lessonAttendance.findFirst({
    where: { bookingId, userId, joinedAt: { gte: new Date(Date.now() - 5 * 60_000) } },
  });
  if (!recent) await db.lessonAttendance.create({ data: { bookingId, userId, joinedAt: new Date() } });
}

/** Odayı kapatır: içerideki herkesin bağlantısı kesilir (uygunsuz durum bildirildiğinde). */
export async function closeClassroom(roomName: string): Promise<void> {
  if (!videoConfigured()) return;
  const host = process.env.LIVEKIT_URL!.replace(/^ws/, "http");
  await new RoomServiceClient(host, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET).deleteRoom(roomName).catch(() => {});
}
