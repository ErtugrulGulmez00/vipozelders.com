import { createVerify, generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { consumeUserToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { authenticate, isWebLoginTarget, issueMobileSession, paymentLink, webLoginLink } from "@/server/mobile/auth";
import { ApiError } from "@/server/mobile/http";
import { notificationTarget } from "@/server/mobile/serialize";
import { notify } from "@/server/notifications";
import { pushMessage, sendPendingPushes, serviceAccountJwt } from "@/server/push";
import { createFixture, createStudent } from "./helpers";

const request = (token?: string) => new Request("http://localhost/api/mobil/v1/ben", { headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), "user-agent": "VitestApp/1.0" } });

async function expectApiError(promise: Promise<unknown>, status: number, code: string) {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(status);
  expect((error as ApiError).code).toBe(code);
}

afterAll(async () => {
  vi.unstubAllGlobals();
  await db.$disconnect();
});

describe("mobil oturum", () => {
  it("Bearer anahtarıyla kullanıcıyı doğrular; süresi dolan, yönetici ve şifre değiştirmesi gereken hesapları ayırır", async () => {
    const student = await createStudent();
    const token = await issueMobileSession(student.id, request(), "Pixel 8");
    const session = await db.session.findFirstOrThrow({ where: { userId: student.id } });
    expect(session.userAgent).toBe("mobil: Pixel 8");
    expect(session.id).not.toBe(token); // yalnızca özeti saklanır

    const user = await authenticate(request(token));
    expect(user).toMatchObject({ id: student.id, role: "STUDENT", sessionId: session.id });

    await expectApiError(authenticate(request()), 401, "UNAUTHENTICATED");
    await expectApiError(authenticate(request("yanlis-anahtar")), 401, "UNAUTHENTICATED");

    await db.user.update({ where: { id: student.id }, data: { mustChangePassword: true } });
    await expectApiError(authenticate(request(token)), 403, "PASSWORD_CHANGE_REQUIRED");
    expect((await authenticate(request(token), { allowPasswordChange: true })).id).toBe(student.id);

    await db.session.update({ where: { id: session.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectApiError(authenticate(request(token)), 401, "UNAUTHENTICATED");
    expect(await db.session.count({ where: { id: session.id } })).toBe(0);

    await db.user.update({ where: { id: student.id }, data: { role: "ADMIN", mustChangePassword: false } });
    await expectApiError(authenticate(request(await issueMobileSession(student.id, request()))), 403, "ADMIN_NOT_SUPPORTED");
  });

  it("WebView için tek kullanımlık giriş bağlantısı yalnızca izinli sayfalara gider", async () => {
    const student = await createStudent();
    expect(isWebLoginTarget("/ders/abc123")).toBe(true);
    expect(isWebLoginTarget("/odeme/paytr/abc123")).toBe(true);
    expect(isWebLoginTarget("/odeme/test/abc123")).toBe(true);
    expect(isWebLoginTarget("/yonetim")).toBe(false);
    expect(isWebLoginTarget("https://kotu.example/ders/abc")).toBe(false);
    await expect(webLoginLink(student.id, "/yonetim")).rejects.toThrow();

    const link = new URL(await webLoginLink(student.id, "/ders/abc123"));
    expect(link.pathname).toBe("/api/mobil/v1/web-giris");
    expect(link.searchParams.get("next")).toBe("/ders/abc123");
    const token = link.searchParams.get("t")!;
    expect(await consumeUserToken(token, "MOBILE_WEB_LOGIN")).toBe(student.id);
    expect(await consumeUserToken(token, "MOBILE_WEB_LOGIN")).toBeNull(); // ikinci kez kullanılamaz

    // Dış ödeme sayfaları (ör. iyzico) olduğu gibi açılır
    expect(await paymentLink(student.id, "https://sandbox-cpp.iyzipay.com/?token=x")).toBe("https://sandbox-cpp.iyzipay.com/?token=x");
  });

  it("bildirim bağlantısı uygulama ekranına çevrilir", () => {
    expect(notificationTarget("/hesabim/derslerim/abc123")).toEqual({ screen: "booking", id: "abc123" });
    expect(notificationTarget("/ogretmen-paneli/dersler/xyz?durum=onaylandi")).toEqual({ screen: "booking", id: "xyz" });
    expect(notificationTarget("/ogretmen-paneli/talepler")).toEqual({ screen: "requests" });
    expect(notificationTarget("/ogretmen-paneli/kazanclar")).toEqual({ screen: "earnings" });
    expect(notificationTarget("/ogretmen/ayse-yilmaz")).toEqual({ screen: "teacher", id: "ayse-yilmaz" });
    expect(notificationTarget(null)).toBeNull();
  });
});

describe("push bildirimleri (FCM)", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const sa = { project_id: "vipozelders-test", client_email: "push@vipozelders-test.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };
  const calls: { url: string; body: string }[] = [];

  beforeAll(() => {
    const dir = mkdtempSync(join(tmpdir(), "fcm-"));
    const file = join(dir, "servis-hesabi.json");
    writeFileSync(file, JSON.stringify(sa));
    process.env.FCM_SERVICE_ACCOUNT_FILE = file;
    vi.stubGlobal("fetch", async (url: string, init: { body: URLSearchParams | string }) => {
      calls.push({ url, body: String(init.body) });
      if (url === "https://oauth2.googleapis.com/token") return Response.json({ access_token: "ya29.test", expires_in: 3600 });
      const message = JSON.parse(String(init.body)).message;
      if (message.token === "olu-cihaz-anahtari-000000000") return Response.json({ error: { status: "NOT_FOUND", message: "UNREGISTERED" } }, { status: 404 });
      return Response.json({ name: `projects/${sa.project_id}/messages/1` });
    });
  });

  it("servis hesabı JWT'si RS256 ile imzalanır", () => {
    const jwt = serviceAccountJwt(sa, 1_700_000_000);
    const [header, claims, signature] = jwt.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({ iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    expect(createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url"))).toBe(true);
  });

  it("yeni bildirimler cihazlara gider, ölü cihaz silinir, aynı bildirim ikinci kez gönderilmez", async () => {
    const fixture = await createFixture();
    const teacherId = fixture.teacher.id;
    await db.device.createMany({
      data: [
        { userId: teacherId, token: "canli-cihaz-anahtari-0000000", platform: "android" },
        { userId: teacherId, token: "olu-cihaz-anahtari-000000000", platform: "ios" },
      ],
    });
    await notify({ userId: teacherId, type: "booking.request", title: "Yeni ders talebi", body: "Ali için Lise Matematik", link: "/ogretmen-paneli/talepler", email: false });

    expect(await sendPendingPushes()).toBe(1);
    const sends = calls.filter((c) => c.url.endsWith(`/projects/${sa.project_id}/messages:send`));
    expect(sends).toHaveLength(2);
    const live = JSON.parse(sends.find((c) => c.body.includes("canli-cihaz"))!.body).message;
    expect(live.notification).toEqual({ title: "Yeni ders talebi", body: "Ali için Lise Matematik" });
    expect(live.data).toMatchObject({ type: "booking.request", screen: "requests", link: "/ogretmen-paneli/talepler" });
    expect(await db.device.count({ where: { userId: teacherId } })).toBe(1);
    expect(await db.notification.count({ where: { userId: teacherId, pushedAt: null } })).toBe(0);

    expect(await sendPendingPushes()).toBe(0);
  });

  it("mesaj alanları FCM'nin beklediği gibi metin", () => {
    const message = pushMessage("cihaz", { id: "n1", type: "booking.confirmed", title: "Ders onaylandı", body: "x".repeat(500), link: "/hesabim/derslerim/b1" }).message;
    expect(message.notification.body).toHaveLength(240);
    expect(Object.values(message.data).every((v) => typeof v === "string")).toBe(true);
    expect(message.data).toMatchObject({ screen: "booking", targetId: "b1" });
  });
});
