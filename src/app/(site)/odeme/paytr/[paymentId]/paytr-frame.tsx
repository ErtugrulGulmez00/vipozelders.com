"use client";

import Script from "next/script";

declare global {
  interface Window {
    iFrameResize?: (options: object, selector: string) => void;
  }
}

/** PayTR'nin güvenli ödeme formu. iframeResizer formun yüksekliğini içeriğe göre ayarlar. */
export function PaytrFrame({ token }: { token: string }) {
  return (
    <>
      <iframe
        id="paytriframe"
        title="PayTR güvenli ödeme formu"
        src={`https://www.paytr.com/odeme/guvenli/${encodeURIComponent(token)}`}
        className="block min-h-[640px] w-full border-0"
        scrolling="no"
        allow="payment"
      />
      <Script src="https://www.paytr.com/js/iframeResizer.min.js" strategy="afterInteractive" onReady={() => window.iFrameResize?.({}, "#paytriframe")} />
    </>
  );
}
