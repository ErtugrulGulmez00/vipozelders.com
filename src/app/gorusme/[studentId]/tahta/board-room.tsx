"use client";

import { LiveKitRoom } from "@livekit/components-react";
import dynamic from "next/dynamic";
import { useState } from "react";

const Whiteboard = dynamic(() => import("@/app/ders/[bookingId]/whiteboard").then((m) => m.Whiteboard), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">Beyaz tahta yükleniyor…</div>,
});

const CONNECT_OPTIONS = { autoSubscribe: false };
const noop = () => {};

/**
 * Yalnızca beyaz tahta: mobil uygulama görüşme ekranında bu sayfayı açar. Odaya görünmez bir katılımcı olarak bağlanır
 * (kamera, mikrofon yok; görüntü abonesi olmaz); çizimler sitedeki sınıfın tahtasıyla aynı kanaldan eşleşir.
 */
export function BoardRoom({ token, serverUrl }: { token: string; serverUrl: string }) {
  const [ended, setEnded] = useState(false);
  if (ended) {
    return (
      <div className="flex h-dvh items-center justify-center bg-white px-6 text-center text-sm text-slate-600" data-testid="board-ended">
        Tahta bağlantısı kapandı. Görüşme sürüyorsa tahtayı kapatıp yeniden açın.
      </div>
    );
  }
  return (
    <div className="h-dvh bg-white">
      <LiveKitRoom token={token} serverUrl={serverUrl} connect video={false} audio={false} connectOptions={CONNECT_OPTIONS} onDisconnected={() => setEnded(true)} className="h-full">
        <Whiteboard open onRemoteOpen={noop} />
      </LiveKitRoom>
    </div>
  );
}
