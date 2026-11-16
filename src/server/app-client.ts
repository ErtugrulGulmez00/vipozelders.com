import "server-only";
import { headers } from "next/headers";

/**
 * İstek Pi Kampüs mobil uygulamasının WebView'ından mı geliyor (user-agent'ta "PiKampusApp")? Uygulama içinde dijital
 * paket satışı ve satışa yönlendirme (fiyat, "satın al", havale bilgisi) gösterilmez: Google Play ödeme politikası.
 */
export async function isAppRequest(): Promise<boolean> {
  return /PiKampusApp/.test((await headers()).get("user-agent") ?? "");
}
