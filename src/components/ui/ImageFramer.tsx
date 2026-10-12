"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { MAX_ZOOM, MIN_ZOOM, coverSize, cropRect, needsPadding, outputSize, panBy, startState, zoomTo, type FrameState } from "@/lib/imageFrame";

const MAX_BYTES = 4.8 * 1024 * 1024; // the server accepts 5MB

/**
 * Lets the person place a picture before it is uploaded: drag it to move, zoom with the slider (or the buttons), or fit the whole
 * picture in. The frame has the shape the picture will be shown in (a wide banner, a square or round profile picture, a 16:9 flyer),
 * so what they see here is what visitors see. The kept part is cut out in the browser and that is what gets uploaded.
 */
export default function ImageFramer({ file, aspect, round = false, title, onCancel, onDone, onUnreadable }: {
  file: File | null;
  aspect: number;
  round?: boolean;
  title: string;
  onCancel: () => void;
  onDone: (cropped: File) => void;
  /** The browser could not read the picture to show it; the caller may upload the original instead. */
  onUnreadable?: (original: File) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [state, setState] = useState<FrameState | null>(null);
  const [width, setWidth] = useState(320);
  const [busy, setBusy] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!file) { setImg(null); setSrc(null); setState(null); return; }
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => { setImg(el); setSrc(url); setState(startState(el.naturalWidth, el.naturalHeight)); };
    el.onerror = () => { URL.revokeObjectURL(url); onUnreadable ? onUnreadable(file) : onCancel(); };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]); // eslint-disable-line react-hooks/exhaustive-deps

  const measure = useCallback(() => { if (frame.current) setWidth(frame.current.clientWidth || 320); }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, img]);

  if (!file) return null;
  const W = img?.naturalWidth ?? 1, H = img?.naturalHeight ?? 1;
  const crop = state ? cropRect(W, H, aspect, state) : null;
  const scale = crop ? width / crop.w : 1;
  const height = width / aspect;

  const move = (dx: number, dy: number) => setState((s) => (s ? panBy(W, H, aspect, s, dx, dy, width) : s));
  const zoom = (z: number) => setState((s) => (s ? zoomTo(W, H, aspect, s, z) : s));
  const fitWhole = () => { const base = coverSize(W, H, aspect); zoom(base.w / Math.max(W, H * aspect)); };

  async function confirm() {
    if (!img || !crop) return;
    setBusy(true);
    const out = outputSize(aspect, crop);
    const canvas = document.createElement("canvas");
    canvas.width = out.w; canvas.height = out.h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { setBusy(false); return onUnreadable ? onUnreadable(file!) : onCancel(); }
    const k = out.w / crop.w;
    const padded = needsPadding(W, H, crop);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -crop.x * k, -crop.y * k, W * k, H * k);
    // Empty space around a zoomed-out picture stays see-through, which only PNG and WEBP can hold.
    let type = padded && file!.type === "image/jpeg" ? "image/png" : file!.type;
    let blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.92));
    if (blob && blob.size > MAX_BYTES) { type = "image/webp"; blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.85)); }
    setBusy(false);
    if (!blob) return onUnreadable ? onUnreadable(file!) : onCancel();
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    onDone(new File([blob], `${file!.name.replace(/\.[^.]+$/, "")}.${ext}`, { type }));
  }

  return (
    <Modal open={!!file} onClose={onCancel} title={title} size="md">
      <p className="mt-1 text-sm text-gray-700">Drag the picture to place it. Use the slider to zoom. This is how it will appear.</p>
      <div className="mt-4 flex justify-center">
        <div
          ref={frame}
          role="img"
          aria-label="Picture frame. Drag to move the picture, or use the arrow keys."
          tabIndex={0}
          data-testid="image-frame"
          className={`relative w-full touch-none select-none overflow-hidden bg-brand-sand outline-none ring-1 ring-brand-gray focus-visible:ring-2 focus-visible:ring-brand-teal ${round ? "max-w-[260px] rounded-full" : "rounded-2xl"} ${drag.current ? "cursor-grabbing" : "cursor-grab"}`}
          style={{ height }}
          onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); frame.current?.setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY }; }}
          onPointerMove={(e) => { if (!drag.current) return; move(e.clientX - drag.current.x, e.clientY - drag.current.y); drag.current = { x: e.clientX, y: e.clientY }; }}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
          onKeyDown={(e) => {
            const step = 16;
            if (e.key === "ArrowLeft") { e.preventDefault(); move(step, 0); }
            else if (e.key === "ArrowRight") { e.preventDefault(); move(-step, 0); }
            else if (e.key === "ArrowUp") { e.preventDefault(); move(0, step); }
            else if (e.key === "ArrowDown") { e.preventDefault(); move(0, -step); }
            else if (e.key === "+" || e.key === "=") zoom((state?.zoom ?? 1) + 0.1);
            else if (e.key === "-") zoom((state?.zoom ?? 1) - 0.1);
          }}
        >
          {src && crop && (
            // eslint-disable-next-line @next/next/no-img-element -- a local preview of the person's own file
            <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: W * scale, height: H * scale, left: -crop.x * scale, top: -crop.y * scale }} />
          )}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="button" aria-label="Zoom out" onClick={() => zoom((state?.zoom ?? 1) - 0.1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-gray text-lg font-semibold text-brand-ink hover:bg-brand-mint">−</button>
        <input type="range" aria-label="Zoom" min={MIN_ZOOM} max={MAX_ZOOM} step={0.01} value={state?.zoom ?? 1} onChange={(e) => zoom(Number(e.target.value))} className="h-10 flex-1 accent-brand-teal" />
        <button type="button" aria-label="Zoom in" onClick={() => zoom((state?.zoom ?? 1) + 0.1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-gray text-lg font-semibold text-brand-ink hover:bg-brand-mint">+</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-sm font-semibold">
        <button type="button" onClick={() => setState(img ? startState(W, H) : null)} className="min-h-[36px] text-brand-teal hover:underline">Reset</button>
        <button type="button" onClick={fitWhole} className="min-h-[36px] text-brand-teal hover:underline">Fit the whole picture</button>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button onClick={confirm} loading={busy} disabled={!img}>Use this picture</Button>
      </div>
    </Modal>
  );
}
