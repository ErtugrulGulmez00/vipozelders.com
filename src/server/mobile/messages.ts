import { db } from "../db";
import { listThreads, loadThread } from "../messages";
import { notFound } from "./http";
import { absoluteUpload } from "./serialize";

// Veli/öğrenci ↔ öğretmen mesajlaşmasının mobil biçimleri. Öğretmen velinin soyadını yalnızca baş harfle görür.

type Person = { firstName: string; lastName: string };
const fullName = (p: Person) => `${p.firstName} ${p.lastName}`;
const shortName = (p: Person) => `${p.firstName} ${p.lastName.charAt(0)}.`;

export async function threadsJson(userId: string, as: "student" | "teacher") {
  const threads = await listThreads(userId, as);
  const teacherIds = as === "student" ? threads.map((t) => t.teacherId) : [];
  const profiles = teacherIds.length
    ? await db.teacherProfile.findMany({ where: { userId: { in: teacherIds } }, select: { userId: true, slug: true, photoKey: true } })
    : [];
  const byTeacher = new Map(profiles.map((p) => [p.userId, p]));
  return {
    items: threads.map((t) => {
      const profile = byTeacher.get(t.teacherId);
      return {
        id: t.id,
        counterpart:
          as === "student"
            ? { name: fullName(t.teacher), photoUrl: absoluteUpload(profile?.photoKey), teacherSlug: profile?.slug ?? null }
            : { name: shortName(t.student), photoUrl: null, teacherSlug: null },
        last: t.last ? { body: t.last.body, mine: t.last.authorId === userId, createdAt: t.last.createdAt } : null,
        unread: t.unread,
        lastMessageAt: t.lastMessageAt,
      };
    }),
    unread: threads.filter((t) => t.unread).length,
  };
}

/** Konuşma (açınca okundu işaretlenir). */
export async function threadJson(userId: string, id: string) {
  const thread = await loadThread(id, userId);
  if (!thread) throw notFound("Konuşma bulunamadı.");
  const asStudent = thread.studentId === userId;
  return {
    id: thread.id,
    counterpart: asStudent
      ? { name: fullName(thread.teacher), photoUrl: absoluteUpload(thread.teacher.teacherProfile?.photoKey), teacherSlug: thread.teacher.teacherProfile?.slug ?? null }
      : { name: shortName(thread.student), photoUrl: null, teacherSlug: null },
    messages: thread.messages.map((m) => ({ id: m.id, mine: m.authorId === userId, body: m.body, masked: m.masked, createdAt: m.createdAt })),
  };
}
