/**
 * WhatsApp bağlantı testi (sunucuda çalıştırılır): LetsBot ile deneme mesajı gönderir.
 * Kullanım: npm run whatsapp:test -- 05XXXXXXXXX
 */
import { sendWhatsAppText } from "@/server/whatsapp";

const phone = process.argv[2];
if (!phone) {
  console.error("Kullanım: npm run whatsapp:test -- 05XXXXXXXXX");
  process.exit(1);
}
const result = await sendWhatsAppText(phone, "Pi Kampüs WhatsApp bağlantı denemesi");
console.log(result.ok ? `Gönderildi (mesaj no: ${result.messageId})` : `Gönderilemedi: ${result.error}`);
