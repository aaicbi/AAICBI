"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { MAX_ZOOM, MIN_ZOOM, backgroundCrop, coverSize, cropRect, narrowerView, needsPadding, outputSize, panBy, startState, zoomTo, type Crop, type FrameState } from "@/lib/imageFrame";

const MAX_BYTES = 4.8 * 1024 * 1024; // the server accepts 5MB

/** Fetches a picture that is already on the site so it can be placed again. Null when the browser is not allowed to read it. */
export async function loadAsFile(url: string, name = "picture"): Promise<File | null> {
  try {
    const res = await fetch(url, { mode: "cors", cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) return null;
    return new File([blob], name, { type: blob.type });
  } catch {
    return null;
  }
}

/** The picture shown through a window of the given crop (used for the main frame and the small phone strip). */
function Shot({ src, imgW, imgH, crop, boxWidth, blurred = false }: { src: string; imgW: number; imgH: number; crop: Crop; boxWidth: number; blurred?: boolean }) {
  const k = boxWidth / crop.w;
  // eslint-disable-next-line @next/next/no-img-element -- a local preview of the person's own file
  const img = <img src={src} alt="" draggable={false} className="pointer-events-none absolute max-w-none" style={{ width: imgW * k, height: imgH * k, left: -crop.x * k, top: -crop.y * k }} />;
  // The blurred copy is enlarged a little so its soft edges never show inside the frame.
  return blurred ? <div className="pointer-events-none absolute inset-0" style={{ filter: `blur(${Math.max(8, boxWidth / 28)}px)`, transform: "scale(1.12)" }}>{img}</div> : img;
}

/** Draws a blurred, enlarged copy of the picture over the whole canvas (shrinking it and stretching it back blurs it in every browser). */
function drawBlurredBackground(ctx: CanvasRenderingContext2D, img: HTMLImageElement, out: { w: number; h: number }) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const small = document.createElement("canvas");
  small.width = Math.max(2, Math.round(out.w / 40)); small.height = Math.max(2, Math.round(out.h / 40));
  const sctx = small.getContext("2d");
  if (!sctx) return;
  sctx.imageSmoothingQuality = "high";
  const sk = Math.max(small.width / W, small.height / H);
  sctx.drawImage(img, (small.width - W * sk) / 2, (small.height - H * sk) / 2, W * sk, H * sk);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, out.w, out.h);
}

/**
 * Lets the person place a picture before it is uploaded: drag it to move, zoom with the slider (or the buttons), or fit the whole
 * picture in. The frame has the shape the picture will be shown in (a wide banner, a square or round profile picture, a 16:9 flyer),
 * so what they see here is what visitors see. The kept part is cut out in the browser and that is what gets uploaded.
 */
export default function ImageFramer({ file, aspect, round = false, title, context, alsoShow, onCancel, onDone, onUnreadable }: {
  file: File | null;
  aspect: number;
  round?: boolean;
  title: string;
  /** What sits under the picture on the real page (the logo and name), so the frame looks like the page. */
  context?: React.ReactNode;
  /** Narrower boxes the same picture also appears in (for example a phone), shown live under the frame. */
  alsoShow?: Array<{ label: string; aspect: number }>;
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
  const padded = !!crop && needsPadding(W, H, crop);
  const bg = backgroundCrop(W, H, aspect);
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
    // Space around a zoomed-out picture is filled with a blurred copy of the picture, so the result is always a solid picture.
    if (needsPadding(W, H, crop)) drawBlurredBackground(ctx, img, out);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -crop.x * k, -crop.y * k, W * k, H * k);
    let type = file!.type;
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
        <div className={context ? "w-full overflow-hidden rounded-xl border border-brand-gray bg-card-gradient" : "w-full"}>
          <div className={context ? "" : "flex justify-center"}>
            <div
              ref={frame}
              role="img"
              aria-label="Picture frame. Drag to move the picture, or use the arrow keys."
              tabIndex={0}
              data-testid="image-frame"
              className={`relative w-full touch-none select-none overflow-hidden bg-brand-sand outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-teal ${context ? "" : `ring-1 ring-brand-gray ${round ? "max-w-[260px] rounded-full" : "rounded-2xl"}`} ${drag.current ? "cursor-grabbing" : "cursor-grab"}`}
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
              {src && crop && padded && <Shot src={src} imgW={W} imgH={H} crop={bg} boxWidth={width} blurred />}
              {src && crop && <Shot src={src} imgW={W} imgH={H} crop={crop} boxWidth={width} />}
            </div>
          </div>
          {context}
        </div>
      </div>
      {alsoShow?.map((v) => {
        const boxW = Math.min(width, 280);
        const sub = crop ? narrowerView(crop, v.aspect) : null;
        return (
          <div key={v.label} className="mt-3" data-testid={`also-${v.label}`}>
            <p className="text-xs font-semibold text-gray-600">{v.label}</p>
            <div className="relative mt-1 overflow-hidden rounded-xl bg-brand-sand ring-1 ring-brand-gray" style={{ width: boxW, height: boxW / v.aspect }}>
              {src && sub && padded && <Shot src={src} imgW={W} imgH={H} crop={narrowerView(bg, v.aspect)} boxWidth={boxW} blurred />}
              {src && sub && <Shot src={src} imgW={W} imgH={H} crop={sub} boxWidth={boxW} />}
            </div>
          </div>
        );
      })}
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
