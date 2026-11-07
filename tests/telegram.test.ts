import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { sendPendingTelegrams, sendTelegram, telegramConfigured } from "@/server/telegram";
import { createStudent } from "./helpers";

type Sent = { url: string; chat_id: string; text: string };
let sent: Sent[] = [];

beforeEach(() => {
  sent = [];
  vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
    sent.push({ url, ...(JSON.parse(init.body) as { chat_id: string; text: string }) });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

afterAll(async () => {
  await db.$disconnect();
});

async function admin(prefix: string) {
  const user = await createStudent(prefix);
  return db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
}

describe("Telegram yönetici bildirimleri", () => {
  it("anahtar girilmemişse hiçbir şey göndermez", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    expect(telegramConfigured()).toBe(false);
    expect(await sendPendingTelegrams()).toBe(0);
    expect(sent).toHaveLength(0);
  });

  it("yöneticilere düşen yeni bildirim her sohbete bir kez gider; öğrenci bildirimi ve eski bildirim gitmez", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test");
    vi.stubEnv("TELEGRAM_CHAT_ID", "111, 222");
    const id = randomUUID().slice(0, 8);
    const [first, second] = [await admin(`adm1${id}`), await admin(`adm2${id}`)];
    await db.notification.createMany({
      data: [first, second].map((u) => ({ userId: u.id, type: "teacher.publish", title: `Yayın onayı ${id}`, body: "Profilini tamamladı", link: "/yonetim/ogretmenler/x" })),
    });
    const student = await createStudent(`ogr${id}`);
    await db.notification.create({ data: { userId: student.id, type: "booking.confirmed", title: `Öğrenci ${id}`, body: "-" } });
    await db.notification.create({ data: { userId: first.id, type: "x", title: `Eski ${id}`, body: "-", createdAt: new Date(Date.now() - 2 * 3_600_000) } });

    await sendPendingTelegrams(new Date(), 1000);
    const mine = () => sent.filter((m) => m.text.includes(id));
    expect(mine().map((m) => m.chat_id).sort()).toEqual(["111", "222"]);
    expect(mine()[0].text.split("\n")[0]).toBe(`🔔 Yayın onayı ${id}`);
    expect(mine()[0].text).toContain("/yonetim/ogretmenler/x");
    expect(mine()[0].url).toBe("https://api.telegram.org/bot123:test/sendMessage");

    // İkinci çalıştırmada aynı bildirim tekrar gitmez
    await sendPendingTelegrams(new Date(), 1000);
    expect(mine()).toHaveLength(2);
  });

  it("grup süper gruba yükseltildiyse Telegram'ın bildirdiği yeni kimliğe gönderir", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "123:test");
    vi.stubEnv("TELEGRAM_CHAT_ID", "-111");
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      const body = JSON.parse(init.body) as { chat_id: string; text: string };
      sent.push({ url, ...body });
      if (body.chat_id === "-111") {
        return new Response(JSON.stringify({ ok: false, description: "Bad Request: group chat was upgraded to a supergroup chat", parameters: { migrate_to_chat_id: -100222 } }), { status: 400 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await sendTelegram("deneme")).toEqual({ ok: true });
    expect(sent.map((m) => m.chat_id)).toEqual(["-111", "-100222"]);
  });
});
