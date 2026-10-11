import { cacheLife, cacheTag } from "next/cache";
import { loadCatalog, loadCities } from "./catalog";
import { db } from "./db";
import { DEFAULT_SETTINGS, loadSettings } from "./settings";

// Vitrinde sık okunan, nadiren değişen veriler. Admin değişikliklerinde updateTag ile yenilenir.

export const CACHE_TAGS = {
  settings: "site-settings",
  catalog: "catalog",
  pages: "pages",
  cities: "cities",
} as const;

export async function getSiteSettings() {
  "use cache";
  cacheTag(CACHE_TAGS.settings);
  cacheLife("hours");
  try {
    return await loadSettings();
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getCatalog() {
  "use cache";
  cacheTag(CACHE_TAGS.catalog);
  cacheLife("hours");
  return loadCatalog();
}

export async function getFooterPages() {
  "use cache";
  cacheTag(CACHE_TAGS.pages);
  cacheLife("hours");
  return db.page.findMany({
    where: { isPublished: true, showInFooter: true },
    orderBy: [{ sortOrder: "asc" }, { title: "asc" }],
    select: { slug: true, title: true },
  });
}

export async function getCities() {
  "use cache";
  cacheTag(CACHE_TAGS.cities);
  cacheLife("days");
  return loadCities();
}
