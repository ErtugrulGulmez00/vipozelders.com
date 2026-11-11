import { expect, type Page } from "@playwright/test";

// Kapı kuralı: kişi yalnızca hesabı olan tarafın kapısından girer; yanlış kapıda "tarafında kaydınız yok" uyarısı çıkar.
// Testler gerçek kullanıcı gibi önce özel ders, olmazsa kurum, olmazsa Pi Koç kapısını dener.
const GATES = ["/giris", "/kurum-giris", "/koc-giris"];
const ON_GATE = /\/(giris|kurum-giris|koc-giris)$/;

export async function gateLogin(page: Page, identifier: string, password: string, options: { keepCookies?: boolean } = {}) {
  if (!options.keepCookies) await page.context().clearCookies();
  for (const gate of GATES) {
    await page.goto(gate);
    await page.getByLabel("E-posta veya kullanıcı adı").fill(identifier);
    await page.getByLabel("Şifre", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Giriş yap" }).click();
    const rejected = page.getByText("tarafında kaydınız yok", { exact: false }).first();
    const outcome = await Promise.race([
      page.waitForURL((u) => !ON_GATE.test(u.pathname), { timeout: 30_000 }).then(() => "in" as const),
      rejected.waitFor({ timeout: 30_000 }).then(() => "wrong-gate" as const),
    ]);
    if (outcome === "in") return;
  }
  await expect(page, "Hiçbir kapıdan girilemedi").not.toHaveURL(ON_GATE);
}
