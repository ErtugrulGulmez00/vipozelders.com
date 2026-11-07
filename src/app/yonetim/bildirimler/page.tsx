import type { Metadata } from "next";
import { NotificationsPage } from "@/components/panel/notifications-list";
import { Card, CardHeader } from "@/components/ui/primitives";
import { requireRole } from "@/server/auth/current-user";
import { telegramConfigured } from "@/server/telegram";
import { TelegramTestForm } from "./telegram-test";

export const metadata: Metadata = { title: "Bildirimler" };

export default async function AdminNotificationsPage() {
  const user = await requireRole("ADMIN");
  const telegram = telegramConfigured();
  return (
    <>
      <NotificationsPage userId={user.id} />
      <Card className="mt-6">
        <CardHeader
          title="Telegram"
          description={
            telegram
              ? "Yönetici bildirimleri bir dakika içinde Telegram'a da gidiyor."
              : "Kapalı. Sunucuya TELEGRAM_BOT_TOKEN ve TELEGRAM_CHAT_ID girilince yönetici bildirimleri Telegram'a da gider."
          }
          action={telegram ? <TelegramTestForm /> : null}
        />
      </Card>
    </>
  );
}
