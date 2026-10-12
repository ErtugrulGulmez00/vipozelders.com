/** Pi Kampüs logosundaki π işareti (yazı tipinden bağımsız, her boyutta net). */
export function PiMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M4.2 9.2c.6-1.7 1.8-2.6 3.6-2.6h12" />
      <path d="M9.6 6.6c0 5-.5 8.6-2.4 11.6" />
      <path d="M15.4 6.6v8.6c0 1.8.9 2.8 2.3 2.8 1 0 1.7-.5 2.1-1.4" />
    </svg>
  );
}
