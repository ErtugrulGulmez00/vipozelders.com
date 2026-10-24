-- Kurum mesajları: SMS yerine WhatsApp (eski SMS kayıtları kalır)
ALTER TYPE "MessageChannel" ADD VALUE 'WHATSAPP';

ALTER TABLE "CenterGuardian" RENAME COLUMN "notifySms" TO "notifyWhatsapp";

ALTER TABLE "CenterAnnouncement" RENAME COLUMN "sendSms" TO "sendWhatsapp";
