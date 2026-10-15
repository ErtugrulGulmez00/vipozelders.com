/**
 * WhatsApp bağlantı testi (sunucuda çalıştırılır): Meta'nın hazır "hello_world" şablonunu gönderir.
 * Kullanım: npm run whatsapp:test -- 05XXXXXXXXX
 * Test numarasıyla yalnızca Meta panelinde "To" listesine eklenmiş numaralara gönderilebilir.
 */
import { sendWhatsAppTemplate } from "@/server/whatsapp";

const phone = process.argv[2];
if (!phone) {
  console.error("Kullanım: npm run whatsapp:test -- 05XXXXXXXXX");
  process.exit(1);
}
const result = await sendWhatsAppTemplate(phone, "hello_world", "en_US");
console.log(result.ok ? `Gönderildi (mesaj no: ${result.messageId})` : `Gönderilemedi: ${result.error}`);
