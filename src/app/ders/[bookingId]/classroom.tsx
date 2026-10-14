"use client";

import "@livekit/components-styles";
import {
  CarouselLayout,
  DisconnectButton,
  FocusLayout,
  GridLayout,
  isTrackReference,
  LiveKitRoom,
  ParticipantTile,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  useChat,
  useConnectionState,
  useTracks,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { LogOut, MessageSquare, PenLine, Send, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

// Beyaz tahta yalnızca tarayıcıda yüklenir (büyük bir paket; sınıf açılınca arka planda gelir).
const Whiteboard = dynamic(() => import("./whiteboard").then((m) => m.Whiteboard), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center bg-white text-sm text-slate-500">Beyaz tahta yükleniyor…</div>,
});

type Chat = ReturnType<typeof useChat>;

/** Kontrol düğmesi yazısı: telefonda gizli (yalnızca simge), geniş ekranda görünür. */
const LABEL = "sr-only sm:not-sr-only";

/** Ekran paylaşımı başlatılamadığında kullanıcıya gösterilecek açıklama. */
function screenShareError(error: Error): string {
  if (error.name === "NotAllowedError") return "Ekran paylaşımı başlatılmadı. Açılan pencerede paylaşmak istediğiniz ekranı, pencereyi ya da sekmeyi seçip “Paylaş”a basın. Daha önce engellediyseniz adres çubuğundaki kilit simgesinden izin verin.";
  if (error.name === "NotSupportedError" || error.name === "TypeError") return "Bu cihazda ekran paylaşımı desteklenmiyor. Telefon tarayıcıları ekran paylaşamaz; bilgisayardan Chrome, Edge ya da Firefox kullanın.";
  if (error.name === "NotReadableError") return "Ekran yakalanamadı. Başka bir program ekranı kullanıyor olabilir; kapatıp tekrar deneyin.";
  return `Ekran paylaşımı başlatılamadı (${error.message || error.name}).`;
}

const SMALL_SCREEN = "(max-width: 639px)";
const isSmallScreen = () => window.matchMedia(SMALL_SCREEN).matches;

function useSmallScreen(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(SMALL_SCREEN);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    isSmallScreen,
    () => false,
  );
}

function ChatPanel({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const { chatMessages, send, isSending } = chat;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages.length]);
  return (
    <aside className="absolute inset-0 z-20 flex flex-col bg-slate-900 sm:static sm:z-auto sm:w-80 sm:border-l sm:border-white/10">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <p className="text-sm font-semibold text-white">Sohbet</p>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white" aria-label="Sohbeti kapat">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {chatMessages.length === 0 ? <p className="text-xs text-slate-500">Bağlantı, formül veya not paylaşabilirsiniz. Mesajlar ders bitince silinir.</p> : null}
        {chatMessages.map((m) => (
          <div key={m.id ?? m.timestamp} className="text-sm">
            <p className="text-xs font-semibold text-brand-300">{m.from?.name ?? "Katılımcı"}</p>
            <p className="whitespace-pre-wrap break-words text-slate-100">{m.message}</p>
          </div>
        ))}
      </div>
      <form
        className="flex gap-2 border-t border-white/10 p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!text.trim()) return;
          await send(text.trim());
          setText("");
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mesaj yazın…" className="h-9 flex-1 rounded-lg bg-slate-800 px-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
        <button type="submit" disabled={isSending} className="inline-flex size-9 items-center justify-center rounded-lg bg-brand-600 text-white disabled:opacity-50" aria-label="Gönder">
          <Send className="size-4" aria-hidden />
        </button>
      </form>
    </aside>
  );
}

function Stage({ title, endsAt }: { title: string; endsAt: number }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );
  const state = useConnectionState();
  // Sohbet panel kapalıyken de dinlenir; aksi halde o sırada gelen mesajlar kaçırılır.
  const chat = useChat();
  const [chatOpen, setChatOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const smallScreen = useSmallScreen();
  // Telefonda sohbet ve tahta aynı alanı kullanır: biri açılınca diğeri kapanır.
  const openBoard = useCallback(() => {
    setBoardOpen(true);
    if (isSmallScreen()) setChatOpen(false);
  }, []);
  const toggleBoard = () => {
    if (!boardOpen && isSmallScreen()) setChatOpen(false);
    setBoardOpen(!boardOpen);
  };
  const toggleChat = () => {
    if (!chatOpen && isSmallScreen()) setBoardOpen(false);
    setChatOpen(!chatOpen);
  };
  const [seenCount, setSeenCount] = useState(0);
  const unread = chatOpen ? 0 : Math.max(0, chat.chatMessages.length - seenCount);
  useEffect(() => {
    // Panel açıkken gelen mesajlar okunmuş sayılır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (chatOpen) setSeenCount(chat.chatMessages.length);
  }, [chatOpen, chat.chatMessages.length]);
  const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare && isTrackReference(t));
  const cameras = tracks.filter((t) => t.source !== Track.Source.ScreenShare);
  const [shareError, setShareError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const minutesLeft = Math.round((endsAt - now) / 60_000);

  return (
    <div className="flex h-full flex-col bg-slate-950">
      <header className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-slate-400">
            {state === ConnectionState.Connected ? (minutesLeft > 0 ? `Dersin bitmesine ${minutesLeft} dakika` : "Ders süresi doldu") : state === ConnectionState.Reconnecting ? "Yeniden bağlanılıyor…" : "Bağlanılıyor…"}
          </p>
        </div>
        <StartAudio label="Sesi aç" className="rounded-lg bg-gold-400 px-3 py-1.5 text-xs font-semibold text-brand-950" />
      </header>
      <div className="relative flex min-h-0 flex-1 flex-col sm:flex-row">
        <div className="relative min-h-0 min-w-0 flex-1">
          {!boardOpen && screenShare && isTrackReference(screenShare) ? (
            // Paylaşılan ekran büyük, kameralar yanda (telefonda altta) şerit halinde.
            <div className="absolute inset-0 flex flex-col gap-2 p-2 sm:flex-row">
              <div className="min-h-0 min-w-0 flex-1">
                <FocusLayout trackRef={screenShare} className="h-full" />
              </div>
              <aside className="h-28 shrink-0 overflow-hidden sm:h-auto sm:w-56" aria-label="Kameralar">
                <CarouselLayout tracks={cameras} orientation={smallScreen ? "horizontal" : "vertical"} className="lk-carousel h-full">
                  <ParticipantTile />
                </CarouselLayout>
              </aside>
            </div>
          ) : !boardOpen ? (
            <div className="absolute inset-0 p-2">
              <GridLayout tracks={tracks} className="h-full">
                <ParticipantTile />
              </GridLayout>
            </div>
          ) : null}
          {shareError ? (
            <div role="alert" className="absolute inset-x-2 top-2 z-20 flex items-start gap-3 rounded-xl bg-amber-400 px-4 py-3 text-sm text-amber-950 shadow-lg">
              <p className="flex-1">{shareError}</p>
              <button type="button" onClick={() => setShareError(null)} className="shrink-0 rounded p-1 hover:bg-amber-300" aria-label="Uyarıyı kapat">
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : null}
          {/* Tahta kapalıyken de bağlı kalır; karşı taraf çizdikçe içerik güncel tutulur. */}
          <div className={cn("absolute inset-0", boardOpen ? "visible" : "pointer-events-none invisible")} aria-hidden={!boardOpen}>
            <Whiteboard open={boardOpen} onRemoteOpen={openBoard} />
          </div>
        </div>
        {boardOpen ? (
          // Telefonda tahtanın altında yatay şerit, geniş ekranda sağda dikey sütun.
          <aside className="h-28 shrink-0 overflow-hidden p-2 sm:h-auto sm:w-56" aria-label="Katılımcılar">
            {/* CarouselLayout verilen className ile kendi sınıfını ezdiği için lk-carousel elle eklenir. */}
            <CarouselLayout tracks={tracks} orientation={smallScreen ? "horizontal" : "vertical"} className="lk-carousel h-full">
              <ParticipantTile />
            </CarouselLayout>
          </aside>
        ) : null}
        {chatOpen ? <ChatPanel chat={chat} onClose={() => setChatOpen(false)} /> : null}
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-3 py-3 [&_button]:inline-flex [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold" aria-label="Ders kontrolleri">
        {/* Telefonda yalnızca simgeler görünür; yazılar ekran okuyucular için kalır. */}
        <TrackToggle source={Track.Source.Microphone} className="bg-slate-800 text-white hover:bg-slate-700">
          <span className={LABEL}>Mikrofon</span>
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera} className="bg-slate-800 text-white hover:bg-slate-700">
          <span className={LABEL}>Kamera</span>
        </TrackToggle>
        <TrackToggle
          source={Track.Source.ScreenShare}
          captureOptions={{ audio: true, selfBrowserSurface: "include" }}
          onChange={(enabled) => enabled && setShareError(null)}
          onDeviceError={(error) => setShareError(screenShareError(error))}
          className="bg-slate-800 text-white hover:bg-slate-700"
        >
          <span className={LABEL}>Ekran paylaş</span>
        </TrackToggle>
        <button type="button" onClick={toggleBoard} className={cn("text-white", boardOpen ? "bg-brand-600" : "bg-slate-800 hover:bg-slate-700")}>
          <PenLine className="size-4" aria-hidden /> <span className={LABEL}>Beyaz tahta</span>
        </button>
        <button type="button" onClick={toggleChat} className={cn("relative text-white", chatOpen ? "bg-brand-600" : "bg-slate-800 hover:bg-slate-700")}>
          <MessageSquare className="size-4" aria-hidden /> <span className={LABEL}>Sohbet</span>
          {unread ? <span className="rounded-full bg-gold-400 px-1.5 text-xs text-brand-950">{unread}</span> : null}
        </button>
        <DisconnectButton className="bg-rose-600 text-white hover:bg-rose-700">
          <LogOut className="size-4" aria-hidden /> <span className={LABEL}>Dersten çık</span>
        </DisconnectButton>
      </nav>
    </div>
  );
}

export function Classroom({ token, serverUrl, title, endsAt, backHref }: { token: string; serverUrl: string; title: string; endsAt: number; backHref: string }) {
  const router = useRouter();
  return (
    <div data-lk-theme="default" className="classroom-root">
      <LiveKitRoom token={token} serverUrl={serverUrl} connect video audio onDisconnected={() => router.push(backHref)} className="h-full">
        <Stage title={title} endsAt={endsAt} />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
