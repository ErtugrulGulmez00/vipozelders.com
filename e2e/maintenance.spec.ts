import { expect, test, type Browser, type Page } from "@playwright/test";

/** Bakım modu: ziyaretçi bakım sayfasını görür; yönetici siteyi ve paneli kullanmaya devam eder. */

async function loginAsAdmin(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/giris");
  await page.getByLabel("E-posta veya kullanıcı adı").fill("admin");
  await page.getByLabel("Şifre", { exact: true }).fill("Yonetici123");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page).toHaveURL(/\/yonetim$/);
  return page;
}

async function setMaintenance(admin: Page, on: boolean) {
  await admin.goto("/yonetim/ayarlar");
  const box = admin.getByLabel(/Vitrini bakım moduna al/);
  if (on) await box.check();
  else await box.uncheck();
  await admin.getByRole("button", { name: "Ayarları kaydet" }).click();
  await expect(admin.getByText("Ayarlar kaydedildi.")).toBeVisible();
}

test("bakım modu ziyaretçiyi bekletir, yöneticiyi engellemez", async ({ browser }) => {
  const admin = await loginAsAdmin(browser);
  const visitor = await (await browser.newContext()).newPage();
  try {
    await setMaintenance(admin, true);

    // Ziyaretçi: bakım sayfası ve yönetici girişi bağlantısı
    // Proxy ayarı birkaç saniyelik önbellekle okur; bakım sayfası en geç birkaç saniyede gelir.
    for (const path of ["/", "/ogretmenler", "/ogretmen/ayse-yilmaz"]) {
      await expect(async () => {
        const response = await visitor.goto(path);
        expect(response?.status()).toBe(503);
        await expect(visitor.getByRole("heading", { name: "Bakımdayız" })).toBeVisible({ timeout: 1000 });
      }).toPass({ timeout: 20_000 });
    }
    await visitor.getByRole("link", { name: "Yönetici girişi" }).click();
    await expect(visitor).toHaveURL(/\/giris/);

    // Yönetici: site açık, bakım uyarısı görünür, panel çalışır
    await admin.goto("/");
    await expect(admin.getByText(/Site bakım modunda/)).toBeVisible();
    await expect(admin.getByRole("heading", { name: "Bakımdayız" })).toHaveCount(0);
    await admin.goto("/yonetim");
    await expect(admin.getByRole("heading", { name: "Özet" })).toBeVisible();
  } finally {
    await setMaintenance(admin, false);
  }

  await expect(async () => {
    const response = await visitor.goto("/");
    expect(response?.status()).toBe(200);
    await expect(visitor.getByRole("heading", { name: /Doğru öğretmen/ })).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
});
