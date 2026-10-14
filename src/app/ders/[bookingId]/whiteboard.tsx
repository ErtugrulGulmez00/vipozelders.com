"use client";

import "@excalidraw/excalidraw/index.css";
import { CaptureUpdateAction, Excalidraw, reconcileElements } from "@excalidraw/excalidraw";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useRoomContext } from "@livekit/components-react";
import { useCallback, useEffect, useRef } from "react";

// Yazı tipleri önce kendi sitemizden (public/excalidraw), bulunamazsa paketin CDN'inden yüklenir.
if (typeof window !== "undefined") {
  (window as unknown as { EXCALIDRAW_ASSET_PATH: string[] }).EXCALIDRAW_ASSET_PATH = [
    "/excalidraw/",
    "https://unpkg.com/@excalidraw/excalidraw@0.18.1/dist/prod/",
  ];
}

const TOPIC = "vd-whiteboard";
const BROADCAST_DELAY_MS = 80;

// Sabit nesneler: Excalidraw her çizim hareketinde yeniden çizilmesin.
const UI_OPTIONS = {
  canvasActions: { loadScene: false, export: false, saveToActiveFile: false, toggleTheme: false },
  tools: { image: false },
} as const;
const INITIAL_DATA = { appState: { viewBackgroundColor: "#ffffff" } };

type Message =
  | { type: "update" | "full"; elements: OrderedExcalidrawElement[] }
  | { type: "sync-request" }
  | { type: "open" };

/**
 * İki kişilik ortak beyaz tahta. Değişen çizimler LiveKit metin akışıyla (büyük veride
 * parçalanarak) gönderilir; gelen çizimler Excalidraw'ın reconcileElements'i ile birleştirilir.
 * Bileşen sınıf boyunca açık tutulur ki tahta kapalıyken gelen çizimler kaybolmasın.
 */
export function Whiteboard({ open, onRemoteOpen }: { open: boolean; onRemoteOpen: () => void }) {
  const room = useRoomContext();
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const knownVersions = useRef(new Map<string, number>());
  const queued = useRef<OrderedExcalidrawElement[][]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announcedOpen = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const send = useCallback(
    (message: Message) => {
      if (room.state !== "connected") return;
      room.localParticipant.sendText(JSON.stringify(message), { topic: TOPIC }).catch(() => {});
    },
    [room],
  );

  const applyRemote = useCallback((elements: OrderedExcalidrawElement[]) => {
    const api = apiRef.current;
    if (!api) {
      queued.current.push(elements);
      return;
    }
    for (const element of elements) {
      knownVersions.current.set(element.id, Math.max(knownVersions.current.get(element.id) ?? 0, element.version));
    }
    const merged = reconcileElements(api.getSceneElementsIncludingDeleted(), elements as never, api.getAppState());
    api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
  }, []);

  useEffect(() => {
    room.registerTextStreamHandler(TOPIC, async (reader) => {
      let message: Message;
      try {
        message = JSON.parse(await reader.readAll()) as Message;
      } catch {
        return;
      }
      if (message.type === "update" || message.type === "full") applyRemote(message.elements);
      else if (message.type === "open") onRemoteOpen();
      else if (message.type === "sync-request" && apiRef.current) {
        send({ type: "full", elements: [...apiRef.current.getSceneElementsIncludingDeleted()] });
      }
    });
    return () => room.unregisterTextStreamHandler(TOPIC);
  }, [room, applyRemote, onRemoteOpen, send]);

  // Tahtayı ilk açan taraf karşı tarafın tahtasını da açtırır.
  useEffect(() => {
    if (open && !announcedOpen.current) {
      announcedOpen.current = true;
      send({ type: "open" });
    }
    if (!open) announcedOpen.current = false;
  }, [open, send]);

  const broadcastChanges = useCallback((elements: readonly OrderedExcalidrawElement[]) => {
    // Görünür çizim sayısı (testler ve hata ayıklama için).
    wrapperRef.current?.setAttribute("data-elements", String(elements.filter((el) => !el.isDeleted).length));
    if (timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      const api = apiRef.current;
      if (!api) return;
      const changed = api.getSceneElementsIncludingDeleted().filter((el) => (knownVersions.current.get(el.id) ?? -1) < el.version);
      if (!changed.length) return;
      for (const el of changed) knownVersions.current.set(el.id, el.version);
      send({ type: "update", elements: changed });
    }, BROADCAST_DELAY_MS);
  }, [send]);

  const onApiReady = useCallback(
    (api: ExcalidrawImperativeAPI) => {
      apiRef.current = api;
      for (const batch of queued.current.splice(0)) applyRemote(batch);
      send({ type: "sync-request" });
    },
    [applyRemote, send],
  );

  return (
    <div ref={wrapperRef} className="pk-whiteboard h-full w-full" data-testid="whiteboard" data-elements="0">
      <Excalidraw
        excalidrawAPI={onApiReady}
        onChange={broadcastChanges}
        langCode="tr-TR"
        isCollaborating
        UIOptions={UI_OPTIONS}
        initialData={INITIAL_DATA}
      />
    </div>
  );
}
