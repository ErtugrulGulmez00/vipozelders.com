"use client";

import { createContext, useContext, type ReactNode } from "react";
import { Checkbox } from "@/components/ui/form";
import { whatsappActive, type ChannelMode } from "@/lib/notification-channels";

// Bildirim kanalı arayüze: WhatsApp kapalıyken (Site ayarları → Bildirim kanalı = "Yalnızca e-posta") WhatsApp
// seçenekleri görünür ama kullanılamaz, yanında "Çok yakında" etiketi durur.

const ChannelContext = createContext<ChannelMode>("email");

export function NotificationChannelProvider({ mode, children }: { mode: ChannelMode; children: ReactNode }) {
  return <ChannelContext.Provider value={mode}>{children}</ChannelContext.Provider>;
}

export function useWhatsAppActive(): boolean {
  return whatsappActive(useContext(ChannelContext));
}

/** Veliye giden mesajın kanalı, metinlerde: "WhatsApp", "e-posta" ya da "WhatsApp ve e-posta". */
export function useMessageChannelLabel(): string {
  const mode = useContext(ChannelContext);
  return mode === "email" ? "e-posta" : mode === "hybrid" ? "WhatsApp ve e-posta" : "WhatsApp";
}

export function WhatsAppSoonBadge() {
  return <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 align-middle text-[11px] font-semibold text-amber-800">Çok yakında · Onay aşamasında</span>;
}

/**
 * WhatsApp onay kutusu. Kapalıyken devre dışı görünür; kayıtlı bir tercihi (veli "WhatsApp almasın" gibi) taşıyorsa
 * `preserve` ile mevcut değer gizli alanla korunur, böylece form kaydedilince tercih silinmez.
 */
export function WhatsAppCheckbox({ name, label, defaultChecked, preserve, active: activeProp }: { name: string; label: ReactNode; defaultChecked?: boolean; preserve?: boolean; active?: boolean }) {
  const contextActive = useWhatsAppActive();
  const active = activeProp ?? contextActive;
  if (active) return <Checkbox name={name} defaultChecked={defaultChecked} label={label} />;
  return (
    <>
      {preserve && defaultChecked ? <input type="hidden" name={name} value="on" /> : null}
      <Checkbox
        disabled
        defaultChecked={false}
        label={
          <span className="text-slate-400">
            {label}
            <WhatsAppSoonBadge />
          </span>
        }
      />
    </>
  );
}
