import { afterAll, describe, expect, it } from "vitest";
import { consumeUserToken, issueUserToken, peekUserToken } from "@/server/auth/tokens";
import { db } from "@/server/db";
import { createStudent } from "./helpers";

afterAll(async () => {
  await db.$disconnect();
});

describe("e-posta bağlantıları", () => {
  it("art arda istenen şifre sıfırlama bağlantılarının hepsi geçerli; biri kullanılınca diğerleri kapanır", async () => {
    const user = await createStudent();
    const first = await issueUserToken(user.id, "PASSWORD_RESET");
    const second = await issueUserToken(user.id, "PASSWORD_RESET");
    expect(await peekUserToken(first, "PASSWORD_RESET")).toBe(true);
    expect(await peekUserToken(second, "PASSWORD_RESET")).toBe(true);
    expect(await consumeUserToken(first, "PASSWORD_RESET")).toBe(user.id);
    expect(await peekUserToken(second, "PASSWORD_RESET")).toBe(false);
    expect(await consumeUserToken(first, "PASSWORD_RESET")).toBeNull();
  });

  it("iki adımlı giriş kodunda yeni bağlantı eskisini iptal eder", async () => {
    const user = await createStudent();
    const first = await issueUserToken(user.id, "TWO_FACTOR_LOGIN");
    await issueUserToken(user.id, "TWO_FACTOR_LOGIN");
    expect(await peekUserToken(first, "TWO_FACTOR_LOGIN")).toBe(false);
  });
});
