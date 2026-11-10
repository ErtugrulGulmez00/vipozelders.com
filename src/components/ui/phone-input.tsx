"use client";

import type { ComponentProps } from "react";
import { Input } from "./form";

/** Yazılanı rakama indirir, 11 haneyle sınırlar ve 0XXX XXX XX XX biçiminde gösterir (+90 ve baştaki 0 eksikse tamamlanır). */
export function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("90") && digits.length > 10) digits = `0${digits.slice(2)}`;
  if (digits && digits[0] !== "0") digits = `0${digits}`;
  digits = digits.slice(0, 11);
  const parts = [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 9), digits.slice(9, 11)].filter(Boolean);
  return parts.join(" ");
}

export function PhoneInput({ onInput, defaultValue, ...props }: Omit<ComponentProps<"input">, "type">) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="numeric"
      maxLength={14}
      defaultValue={typeof defaultValue === "string" ? formatPhoneInput(defaultValue) : defaultValue}
      onInput={(e) => {
        const el = e.currentTarget;
        const next = formatPhoneInput(el.value);
        if (next !== el.value) el.value = next;
        onInput?.(e);
      }}
    />
  );
}
