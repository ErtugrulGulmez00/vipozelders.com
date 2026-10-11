"use client";

import "@livekit/components-styles";
import {
  DisconnectButton,
  GridLayout,
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
import { LogOut, MessageSquare, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

type Chat = ReturnType<typeof useChat>;

function ChatPanel({ chat, onClose }: { chat: Chat; onClose: () => void }) {
  const { chatMessages, send, isSending } = chat;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [chatMessages.length]);
  return (
    <aside className="flex w-full flex-col border-l border-white/10 bg-slate-900 sm:w-80">
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
  const [seenCount, setSeenCount] = useState(0);
  const unread = chatOpen ? 0 : Math.max(0, chat.chatMessages.length - seenCount);
  useEffect(() => {
    // Panel açıkken gelen mesajlar okunmuş sayılır.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (chatOpen) setSeenCount(chat.chatMessages.length);
  }, [chatOpen, chat.chatMessages.length]);
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
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 p-2">
          <GridLayout tracks={tracks} className="h-full">
            <ParticipantTile />
          </GridLayout>
        </div>
        {chatOpen ? <ChatPanel chat={chat} onClose={() => setChatOpen(false)} /> : null}
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-3 py-3 [&_button]:inline-flex [&_button]:items-center [&_button]:gap-2 [&_button]:rounded-lg [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold" aria-label="Ders kontrolleri">
        <TrackToggle source={Track.Source.Microphone} className="bg-slate-800 text-white hover:bg-slate-700">
          Mikrofon
        </TrackToggle>
        <TrackToggle source={Track.Source.Camera} className="bg-slate-800 text-white hover:bg-slate-700">
          Kamera
        </TrackToggle>
        <TrackToggle source={Track.Source.ScreenShare} captureOptions={{ audio: true, selfBrowserSurface: "include" }} className="bg-slate-800 text-white hover:bg-slate-700">
          Ekran paylaş
        </TrackToggle>
        <button type="button" onClick={() => setChatOpen((v) => !v)} className={cn("text-white", chatOpen ? "bg-brand-600" : "bg-slate-800 hover:bg-slate-700")}>
          <MessageSquare className="size-4" aria-hidden /> Sohbet
          {unread ? <span className="rounded-full bg-gold-400 px-1.5 text-xs text-brand-950">{unread}</span> : null}
        </button>
        <DisconnectButton className="bg-rose-600 text-white hover:bg-rose-700">
          <LogOut className="size-4" aria-hidden /> Dersten çık
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
