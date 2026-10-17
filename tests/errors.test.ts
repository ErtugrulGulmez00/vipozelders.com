import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { recordError } from "@/server/errors";
import { hoursAfter, NOW } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("hata takibi", () => {
  it("aynı hata tek kayıtta sayılır, yöneticiye en fazla 6 saatte bir bildirilir, çözülünce tekrar bildirilir", async () => {
    const admin = await db.user.create({ data: { role: "ADMIN", username: `admin.${randomUUID().slice(0, 8)}`, firstName: "A", lastName: "B", passwordHash: "x" } });
    const route = `/test/${randomUUID()}`;
    const report = (id: number) => ({ error: new Error(`Kayıt bulunamadı: ${id}`), source: "render", routePath: route, path: `${route}?x=${id}`, method: "GET" });
    const notes = () => db.notification.count({ where: { userId: admin.id, type: "admin.error", body: { contains: route } } });

    await recordError(report(1), NOW);
    await recordError(report(2), hoursAfter(NOW, 1));
    const events = await db.errorEvent.findMany({ where: { routePath: route } });
    expect(events).toHaveLength(1);
    expect(events[0].count).toBe(2);
    expect(await notes()).toBe(1);

    await recordError(report(3), hoursAfter(NOW, 7));
    expect(await notes()).toBe(2);

    await db.errorEvent.update({ where: { id: events[0].id }, data: { resolvedAt: hoursAfter(NOW, 8) } });
    await recordError(report(4), hoursAfter(NOW, 9));
    expect(await notes()).toBe(3);
    expect((await db.errorEvent.findUniqueOrThrow({ where: { id: events[0].id } })).resolvedAt).toBeNull();
  });

  it("yönlendirme ve 404 kaydedilmez", async () => {
    const route = `/test/${randomUUID()}`;
    await recordError({ error: Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/giris;307;" }), source: "render", routePath: route });
    await recordError({ error: Object.assign(new Error("x"), { digest: "NEXT_HTTP_ERROR_FALLBACK;404" }), source: "render", routePath: route });
    expect(await db.errorEvent.count({ where: { routePath: route } })).toBe(0);
  });
});
