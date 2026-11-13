"use client";

import "@excalidraw/excalidraw/index.css";
import { CaptureUpdateAction, convertToExcalidrawElements, Excalidraw, reconcileElements } from "@excalidraw/excalidraw";
import type { FileId, OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { useRoomContext } from "@livekit/components-react";
import { FileUp, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { blobToDataUrl, boardImages, fetchBoardImage, MAX_PDF_PAGES, uploadBoardImage } from "./board-files";

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
  const fileInput = useRef<HTMLInputElement>(null);
  const fetching = useRef(new Set<string>());
  const [adding, setAdding] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // Karşı tarafın eklediği görseller (fotoğraf, PDF sayfası) sunucudan çekilip tahtaya yüklenir
  const loadMissingFiles = useCallback(async (api: ExcalidrawImperativeAPI) => {
    const files = api.getFiles();
    const missing = api
      .getSceneElements()
      .filter((el) => el.type === "image" && el.fileId && !files[el.fileId] && !fetching.current.has(el.fileId))
      .map((el) => (el as { fileId: string }).fileId);
    for (const key of new Set(missing)) {
      fetching.current.add(key);
      try {
        const dataURL = await fetchBoardImage(key);
        api.addFiles([{ id: key as FileId, dataURL: dataURL as BinaryFileData["dataURL"], mimeType: "image/jpeg", created: Date.now() }]);
      } catch {
        fetching.current.delete(key);
      }
    }
  }, []);

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
    // Karşı tarafın yeni eklediği görsel (PDF sayfası, fotoğraf): ekran ona kaydırılır ki öğrenci soruyu hemen görsün
    const newImages = elements.filter((el) => el.type === "image" && !el.isDeleted && !knownVersions.current.has(el.id));
    for (const element of elements) {
      knownVersions.current.set(element.id, Math.max(knownVersions.current.get(element.id) ?? 0, element.version));
    }
    const merged = reconcileElements(api.getSceneElementsIncludingDeleted(), elements as never, api.getAppState());
    api.updateScene({ elements: merged, captureUpdate: CaptureUpdateAction.NEVER });
    if (elements.some((el) => el.type === "image")) void loadMissingFiles(api);
    if (newImages.length) api.scrollToContent(newImages[0] as never, { fitToContent: true, animate: true });
  }, [loadMissingFiles]);

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
      void loadMissingFiles(api);
      send({ type: "sync-request" });
    },
    [applyRemote, send, loadMissingFiles],
  );

  // Fotoğraf ya da PDF: her görsel (PDF'in her sayfası) yüklenir ve tahtada mevcut çizimlerin altına eklenir
  const addFiles = useCallback(async (list: FileList | null) => {
    const api = apiRef.current;
    if (!api || !list?.length) return;
    setFileError(null);
    let added = 0;
    try {
      const existing = api.getSceneElements();
      let y = existing.length ? Math.max(...existing.map((el) => el.y + el.height)) + 60 : 0;
      for await (const image of boardImages([...list])) {
        added++;
        setAdding(`${added}. sayfa ekleniyor…`);
        const key = await uploadBoardImage(image);
        const dataURL = await blobToDataUrl(image.blob);
        api.addFiles([{ id: key as FileId, dataURL: dataURL as BinaryFileData["dataURL"], mimeType: "image/jpeg", created: Date.now() }]);
        const width = 900;
        const height = Math.round((image.height / image.width) * width);
        const [element] = convertToExcalidrawElements([{ type: "image", fileId: key as FileId, x: 0, y, width, height }]);
        api.updateScene({ elements: [...api.getSceneElementsIncludingDeleted(), { ...element, status: "saved", locked: true } as never], captureUpdate: CaptureUpdateAction.IMMEDIATELY });
        y += height + 40;
        if (added === 1) api.scrollToContent(element, { fitToContent: true });
      }
      if (!added) setFileError("Yalnızca fotoğraf (JPG, PNG) ya da PDF ekleyebilirsiniz.");
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Dosya eklenemedi.");
    } finally {
      setAdding(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }, []);

  return (
    <div ref={wrapperRef} className="pk-whiteboard relative h-full w-full" data-testid="whiteboard" data-elements="0">
      <div className="absolute bottom-16 left-3 z-10 flex flex-col items-start gap-1 sm:bottom-4 sm:left-auto sm:right-4 sm:items-end">
        <input ref={fileInput} type="file" accept="image/*,application/pdf" multiple className="sr-only" onChange={(e) => void addFiles(e.target.files)} data-testid="board-file" />
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={Boolean(adding)}
          title={`Fotoğraf ya da PDF ekle (PDF'in ilk ${MAX_PDF_PAGES} sayfası)`}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white shadow-lg hover:bg-brand-700 disabled:opacity-70"
        >
          {adding ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <FileUp className="size-4" aria-hidden />}
          {adding ?? "PDF / fotoğraf ekle"}
        </button>
        {fileError ? <p className="max-w-64 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">{fileError}</p> : null}
      </div>
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
