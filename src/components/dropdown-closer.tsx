"use client";

import { useEffect } from "react";

const MENU = "details[data-dropdown]";

/**
 * Açılır menüler (<details data-dropdown>) tarayıcıda kendiliğinden kapanmaz. Burada: dışarı dokununca, Esc'ye basınca
 * ya da menüden bir bağlantı/düğme seçilince kapanır (üst çubuk sayfa değişince yeniden çizilmediği için gerekli);
 * aynı anda tek menü açık kalır. Sık sorulanlar gibi açılır bölümler işaretlenmediği için etkilenmez.
 */
export function DropdownCloser() {
  useEffect(() => {
    const openMenus = () => [...document.querySelectorAll<HTMLDetailsElement>(`${MENU}[open]`)];
    const onPointerDown = (event: PointerEvent) => {
      for (const menu of openMenus()) if (!menu.contains(event.target as Node)) menu.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const menu of openMenus()) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };
    const onClick = (event: MouseEvent) => {
      const item = (event.target as Element).closest?.("a[href], button");
      const menu = item?.closest<HTMLDetailsElement>(MENU);
      // Gönderim ya da gezinme başladıktan sonra kapat
      if (menu && !item?.closest("summary")) setTimeout(() => (menu.open = false));
    };
    // toggle olayı kabarcıklanmaz; yakalama aşamasında dinlenir
    const onToggle = (event: Event) => {
      const opened = event.target as HTMLDetailsElement;
      if (!opened.matches?.(MENU) || !opened.open) return;
      for (const menu of openMenus()) if (menu !== opened) menu.open = false;
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("click", onClick);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
