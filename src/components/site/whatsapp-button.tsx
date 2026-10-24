// Sağ altta WhatsApp destek düğmesi (Site ayarları → WhatsApp destek numarası; boşsa gösterilmez).
export function WhatsAppButton({ number, siteName }: { number: string; siteName: string }) {
  const digits = number.replace(/\D/g, "").replace(/^0/, "90");
  if (digits.length < 10) return null;
  const text = encodeURIComponent(`Merhaba, ${siteName} hakkında bilgi almak istiyorum.`);
  return (
    <a
      href={`https://wa.me/${digits}?text=${text}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp ile destek"
      className="pk-site-chrome fixed right-4 bottom-20 z-40 inline-flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-lg ring-4 ring-white/60 transition hover:scale-105 lg:bottom-6"
    >
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden fill="currentColor">
        <path d="M16.04 3C8.86 3 3.02 8.82 3.02 15.98c0 2.29.6 4.52 1.75 6.49L3 29l6.7-1.75a13.04 13.04 0 0 0 6.34 1.62h.01c7.18 0 13.02-5.82 13.02-12.98C29.07 8.82 23.22 3 16.04 3Zm0 23.68h-.01c-1.95 0-3.86-.52-5.53-1.51l-.4-.24-3.98 1.04 1.06-3.87-.26-.4a10.7 10.7 0 0 1-1.65-5.72c0-5.95 4.85-10.79 10.79-10.79 2.88 0 5.59 1.12 7.62 3.16a10.7 10.7 0 0 1 3.16 7.63c0 5.95-4.85 10.7-10.8 10.7Zm5.92-8.03c-.32-.16-1.92-.95-2.22-1.05-.3-.11-.52-.16-.73.16-.22.32-.84 1.05-1.03 1.27-.19.21-.38.24-.7.08-.32-.16-1.37-.5-2.6-1.6-.96-.86-1.61-1.91-1.8-2.23-.19-.32-.02-.5.14-.65.15-.14.32-.38.49-.57.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.73-1.75-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.22 0-.57.08-.86.4-.3.32-1.13 1.1-1.13 2.69s1.16 3.12 1.32 3.33c.16.21 2.28 3.48 5.53 4.88.77.33 1.37.53 1.84.68.77.25 1.48.21 2.04.13.62-.09 1.92-.78 2.19-1.54.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z" />
      </svg>
    </a>
  );
}
