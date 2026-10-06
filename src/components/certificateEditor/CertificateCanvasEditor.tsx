"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, Textbox, Rect, Line, FabricImage, FabricObject } from "fabric";
import {
  DYNAMIC_FIELDS,
  DYNAMIC_FIELD_LABELS,
  DEFAULT_LAYOUT_WIDTH,
  DEFAULT_LAYOUT_HEIGHT,
  PAGE_SIZE_PRESETS,
  type CertificateLayout,
  type CertificateElement,
  type TextElement,
  type DynamicField,
} from "@/lib/certificateLayout";
import { BUILTIN_ICONS } from "@/lib/certificateIcons";
import { builtinIconToDataUrl } from "@/lib/certificateIconRender";
import ElementPropertiesPanel from "@/components/certificateEditor/ElementPropertiesPanel";

const DEFAULT_LAYOUT: CertificateLayout = {
  width: DEFAULT_LAYOUT_WIDTH,
  height: DEFAULT_LAYOUT_HEIGHT,
  backgroundColor: "#FFFFFF",
  elements: [],
};

const DISPLAY_WIDTH = 640;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

interface UploadedIcon {
  id: string;
  name: string;
  url: string;
}

export interface CertificateCanvasEditorProps {
  layout: CertificateLayout | null;
  onChange: (layout: CertificateLayout) => void;
  logoUrl: string | null;
  disabled: boolean;
}

/**
 * Visual Certificate Design Editor — the Fabric.js-based drag/resize/
 * rotate canvas. Imperative, not declarative (Fabric has no official
 * React bindings the way Konva's react-konva does): this component
 * owns one `Canvas` instance via refs, and every add/edit calls
 * straight into the Fabric API, mirroring the result back into the
 * `elements` React state that `onChange` reports — that state array
 * (never Fabric's own internal object graph) is the single source of
 * truth persisted to the server.
 */
export default function CertificateCanvasEditor({ layout, onChange, logoUrl, disabled }: CertificateCanvasEditorProps) {
  const [current, setCurrent] = useState<CertificateLayout>(layout ?? DEFAULT_LAYOUT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([]);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const objectsRef = useRef<Record<string, FabricObject>>({});
  const currentRef = useRef(current);
  currentRef.current = current;
  const scale = DISPLAY_WIDTH / current.width;

  function update(next: CertificateLayout) {
    setCurrent(next);
    onChange(next);
  }

  function updateElement(id: string, patch: Record<string, unknown>) {
    update({
      ...currentRef.current,
      elements: currentRef.current.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CertificateElement) : el)),
    });
  }

  // --- Icon bank: load the shared, platform-wide uploaded icons once ---
  useEffect(() => {
    fetch("/api/admin/certificate-icons")
      .then((r) => (r.ok ? r.json() : []))
      .then(setUploadedIcons)
      .catch(() => {});
  }, []);

  // --- Canvas lifecycle: create once, dispose on unmount ---
  useEffect(() => {
    if (!canvasElRef.current) return;
    // Fabric's backstore AND its own intrinsic CSS size both stay at
    // full design resolution — no Fabric-side shrinking at all. The
    // visual shrink to DISPLAY_WIDTH is a plain CSS `transform: scale`
    // on the wrapping element below (same technique already proven in
    // CertificateLayoutRenderer). This is deliberately NOT Fabric's own
    // `setDimensions(..., { cssOnly: true })` — that call only resizes
    // the canvas elements themselves, correctly, but still left a
    // horizontal offset in practice (the `canvas-container` Fabric
    // injects has its own layout quirks once CSS-resized asymmetrically
    // from its backstore). Fabric's pointer-event math reads
    // `getBoundingClientRect()` (the element's actual on-screen bounds,
    // whatever produced them) to translate clicks into logical
    // coordinates, so it's already correct under an external CSS
    // transform — nothing else needs to know the transform exists.
    const canvas = new Canvas(canvasElRef.current, {
      width: currentRef.current.width,
      height: currentRef.current.height,
      backgroundColor: currentRef.current.backgroundColor,
      selection: !disabled,
    });
    fabricRef.current = canvas;

    canvas.on("selection:created", (e) => setSelectedId(fabricObjectElementId(e.selected?.[0])));
    canvas.on("selection:updated", (e) => setSelectedId(fabricObjectElementId(e.selected?.[0])));
    canvas.on("selection:cleared", () => setSelectedId(null));
    canvas.on("object:modified", (e) => handleModified(e.target));

    loadElements(canvas, currentRef.current.elements, logoUrl).catch((err) => console.error("Failed to load certificate layout onto the canvas:", err));

    return () => {
      canvas.dispose();
      fabricRef.current = null;
      objectsRef.current = {};
    };
    // Intentionally mount-once: layout/logoUrl changes are applied via
    // the targeted effects below, not a full re-create (which would
    // lose selection/undo-able state on every keystroke elsewhere on
    // the page). A template switch remounts this whole component via
    // the parent's `key` prop instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep canvas size/background in sync with page-size/background changes
  // (e.g. the page-size picker). Full logical resolution always — the
  // CSS transform on the wrapping element (in the JSX below) is what
  // actually shrinks it visually.
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: current.width, height: current.height });
    canvas.backgroundColor = current.backgroundColor;
    canvas.requestRenderAll();
  }, [current.width, current.height, current.backgroundColor, scale]);

  function handleModified(target: FabricObject | undefined) {
    if (!target) return;
    const id = fabricObjectElementId(target);
    if (!id) return;
    const el = currentRef.current.elements.find((e) => e.id === id);
    if (!el) return;

    const x = target.left ?? el.x;
    const y = target.top ?? el.y;
    const rotation = target.angle ?? 0;

    if (el.type === "text") {
      const width = Math.max(20, (target.width ?? el.width) * (target.scaleX ?? 1));
      target.set({ scaleX: 1, scaleY: 1, width });
      updateElement(id, { x, y, width, rotation });
    } else if (el.type === "shape" && el.shapeType === "line") {
      const width = Math.max(1, (target.width ?? el.width) * (target.scaleX ?? 1));
      target.set({ scaleX: 1, scaleY: 1 });
      updateElement(id, { x, y, width, rotation });
    } else if (el.type === "icon") {
      const size = Math.max(8, target.getScaledWidth ? target.getScaledWidth() : el.size);
      target.set({ scaleX: 1, scaleY: 1, width: size, height: size });
      updateElement(id, { x, y, size, rotation });
    } else {
      const width = Math.max(10, target.getScaledWidth ? target.getScaledWidth() : el.width);
      const height = Math.max(10, target.getScaledHeight ? target.getScaledHeight() : el.height);
      target.set({ scaleX: 1, scaleY: 1, width, height });
      updateElement(id, { x, y, width, height, rotation });
    }
    canvasRenderAll();
  }

  function canvasRenderAll() {
    fabricRef.current?.requestRenderAll();
  }

  // --- Add / remove elements ---
  async function addElement(el: CertificateElement) {
    update({ ...currentRef.current, elements: [...currentRef.current.elements, el] });
    const canvas = fabricRef.current;
    if (canvas) {
      const obj = await buildFabricObject(el, logoUrl);
      if (obj) {
        objectsRef.current[el.id] = obj;
        canvas.add(obj);
        canvas.setActiveObject(obj);
        canvas.requestRenderAll();
      }
    }
    setSelectedId(el.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    const canvas = fabricRef.current;
    const obj = objectsRef.current[selectedId];
    if (canvas && obj) {
      canvas.remove(obj);
      delete objectsRef.current[selectedId];
      canvas.requestRenderAll();
    }
    update({ ...currentRef.current, elements: currentRef.current.elements.filter((el) => el.id !== selectedId) });
    setSelectedId(null);
  }

  function addText(content: TextElement["content"]) {
    addElement({
      id: newId(), type: "text", x: 40, y: 40, width: 300, rotation: 0,
      fontSize: 24, fontFamily: "Georgia", bold: false, italic: false,
      color: "#16302B", align: "left", content,
    });
  }

  async function handleUploadIcon(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingIcon(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name);
    const res = await fetch("/api/admin/certificate-icons", { method: "POST", body: formData });
    setUploadingIcon(false);
    if (!res.ok) return;
    const icon: UploadedIcon = await res.json();
    setUploadedIcons((icons) => [icon, ...icons]);
  }

  // --- Property panel edits apply to both state AND the live Fabric object ---
  async function handlePanelChange(patch: Record<string, unknown>) {
    if (!selectedId) return;
    const el = currentRef.current.elements.find((e) => e.id === selectedId);
    updateElement(selectedId, patch);
    const canvas = fabricRef.current;
    const obj = objectsRef.current[selectedId];
    if (!canvas || !obj || !el) return;

    // A builtin icon is a pre-baked raster image (its color is burned
    // into the generated SVG data URI at build time) — unlike a vector
    // shape's `fill`, there's no way to recolor it in place, so a
    // color/size change rebuilds the Fabric object instead of patching it.
    if (el.type === "icon" && ("color" in patch || "size" in patch)) {
      const updatedEl = { ...el, ...patch } as CertificateElement;
      canvas.remove(obj);
      const newObj = await buildFabricObject(updatedEl, logoUrl);
      if (newObj) {
        objectsRef.current[selectedId] = newObj;
        canvas.add(newObj);
        canvas.setActiveObject(newObj);
      }
      canvas.requestRenderAll();
      return;
    }

    applyPatchToFabricObject(obj, patch);
    canvasRenderAll();
  }

  const selected = current.elements.find((el) => el.id === selectedId) ?? null;

  return (
    <div onKeyDown={(e) => { if ((e.key === "Delete" || e.key === "Backspace") && selectedId && !disabled) removeSelected(); }} tabIndex={-1}>
      {!disabled && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => addText({ kind: "literal", text: "Text" })} className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink">
            + Text
          </button>
          <AddFieldMenu onAdd={(field) => addText({ kind: "field", field })} />
          <button
            type="button"
            onClick={() => addElement({ id: newId(), type: "image", x: 40, y: 40, width: 100, height: 100, rotation: 0, source: "logo" })}
            className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink"
          >
            + Logo
          </button>
          <button
            type="button"
            onClick={() => addElement({ id: newId(), type: "image", x: 40, y: 40, width: 100, height: 100, rotation: 0, source: "qr" })}
            className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink"
          >
            + QR Code
          </button>
          <button
            type="button"
            onClick={() => addElement({ id: newId(), type: "shape", shapeType: "rect", x: 20, y: 20, width: 200, height: 120, rotation: 0, stroke: "#D99A34", strokeWidth: 3 })}
            className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink"
          >
            + Rectangle
          </button>
          <button
            type="button"
            onClick={() => addElement({ id: newId(), type: "shape", shapeType: "line", x: 20, y: 20, width: 200, height: 0, rotation: 0, stroke: "#9CA3AF", strokeWidth: 1 })}
            className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink"
          >
            + Line
          </button>
          <label className="text-xs font-semibold text-gray-600">
            Page size
            <select
              onChange={(e) => {
                const preset = PAGE_SIZE_PRESETS.find((p) => p.id === e.target.value);
                if (preset) update({ ...current, width: preset.width, height: preset.height });
              }}
              defaultValue=""
              className="ml-1.5 rounded-lg border border-brand-gray px-2 py-1 text-xs outline-none"
            >
              <option value="" disabled>
                Choose...
              </option>
              {PAGE_SIZE_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          {selectedId && (
            <button type="button" onClick={removeSelected} className="ml-auto rounded-lg border border-brand-rose px-2.5 py-1 text-xs font-semibold text-brand-rose">
              Delete selected
            </button>
          )}
        </div>
      )}

      {!disabled && (
        <div className="mb-3 rounded-lg border border-brand-gray p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Icon Bank</p>
          <div className="flex flex-wrap gap-1.5">
            {BUILTIN_ICONS.map(({ name, label, Icon }) => (
              <button
                key={name}
                type="button"
                title={label}
                onClick={() => addElement({ id: newId(), type: "icon", x: 40, y: 40, size: 48, rotation: 0, color: "#016B61", source: { kind: "builtin", name } })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-gray text-gray-700 hover:border-brand-teal hover:text-brand-teal"
              >
                <Icon size={18} />
              </button>
            ))}
            {uploadedIcons.map((icon) => (
              <button
                key={icon.id}
                type="button"
                title={icon.name}
                onClick={() => addElement({ id: newId(), type: "icon", x: 40, y: 40, size: 48, rotation: 0, color: "#016B61", source: { kind: "uploaded", url: icon.url } })}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-gray p-1"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- a small icon-bank thumbnail from an already-uploaded, trusted-admin-controlled asset. */}
                <img src={icon.url} alt={icon.name} className="h-full w-full object-contain" />
              </button>
            ))}
            <label className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-dashed border-brand-gray text-xs text-gray-500">
              {uploadingIcon ? "…" : "+"}
              <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleUploadIcon} className="hidden" disabled={uploadingIcon} />
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="overflow-hidden rounded-lg border border-brand-gray" style={{ width: DISPLAY_WIDTH, height: current.height * scale }}>
          <div style={{ width: current.width, height: current.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
            <canvas ref={canvasElRef} />
          </div>
        </div>

        {!disabled && (
          <div className="w-56 shrink-0">
            <label className="block text-xs font-semibold text-gray-600">
              Background color
              <input
                type="color"
                value={current.backgroundColor}
                onChange={(e) => update({ ...current, backgroundColor: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-brand-gray"
              />
            </label>
            {selected && <ElementPropertiesPanel element={selected} onChange={handlePanelChange} />}
            {!selected && <p className="mt-3 text-xs text-gray-500">Click an element on the canvas to edit it.</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function fabricObjectElementId(obj: FabricObject | undefined): string | null {
  if (!obj) return null;
  return (obj as unknown as { elementId?: string }).elementId ?? null;
}

async function loadElements(canvas: Canvas, elements: CertificateElement[], logoUrl: string | null) {
  for (const el of elements) {
    const obj = await buildFabricObject(el, logoUrl);
    if (obj) canvas.add(obj);
  }
  canvas.requestRenderAll();
}

async function buildFabricObject(el: CertificateElement, logoUrl: string | null): Promise<FabricObject | null> {
  // Fabric v6+ changed its default object origin from top-left to
  // center (a breaking change from v5) — explicitly pinning
  // originX/originY back to "left"/"top" here is what makes el.x/el.y
  // actually mean "top-left corner", matching both this schema's own
  // intent and how CertificateLayoutRenderer already interprets the
  // same x/y as plain CSS `left`/`top`. Without this, every element's
  // x/y is its CENTER, silently shifting wide/centered elements far
  // off-canvas to the left — confirmed directly via Fabric's own
  // aCoords on a live canvas (a 968px-wide rect at x:16 was rendering
  // with its actual left edge at x:-468, not 16).
  const common = { left: el.x, top: el.y, angle: el.rotation, selectable: true, originX: "left" as const, originY: "top" as const };

  if (el.type === "text") {
    const label = el.content.kind === "literal" ? el.content.text : `{${DYNAMIC_FIELD_LABELS[el.content.field]}}`;
    const textbox = new Textbox(label, {
      ...common,
      width: el.width,
      fontSize: el.fontSize,
      fontFamily: el.fontFamily,
      fontWeight: el.bold ? "bold" : "normal",
      fontStyle: el.italic ? "italic" : "normal",
      fill: el.color,
      textAlign: el.align,
      lockScalingY: true,
    });
    (textbox as unknown as { elementId: string }).elementId = el.id;
    return textbox;
  }

  if (el.type === "shape") {
    if (el.shapeType === "rect") {
      const rect = new Rect({
        ...common,
        width: el.width,
        height: el.height,
        fill: el.fill ?? "transparent",
        stroke: el.stroke,
        strokeWidth: el.strokeWidth ?? (el.stroke ? 1 : 0),
        rx: el.cornerRadius ?? 0,
        ry: el.cornerRadius ?? 0,
      });
      (rect as unknown as { elementId: string }).elementId = el.id;
      return rect;
    }
    const line = new Line([0, 0, el.width, 0], {
      ...common,
      stroke: el.stroke ?? el.fill ?? "#000000",
      strokeWidth: el.strokeWidth ?? 2,
    });
    (line as unknown as { elementId: string }).elementId = el.id;
    return line;
  }

  if (el.type === "image") {
    const src = el.source === "logo" ? logoUrl : null; // QR has no real value at design time — shown as a placeholder
    if (!src) {
      const placeholder = new Rect({ ...common, width: el.width, height: el.height, fill: "#F3F4F6", stroke: "#D1D5DB", strokeWidth: 1, strokeDashArray: [4, 4] });
      (placeholder as unknown as { elementId: string }).elementId = el.id;
      return placeholder;
    }
    const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
    img.set({ ...common, scaleX: el.width / (img.width || el.width), scaleY: el.height / (img.height || el.height) });
    (img as unknown as { elementId: string }).elementId = el.id;
    return img;
  }

  // icon
  const src = el.source.kind === "builtin" ? builtinIconToDataUrl(el.source.name, el.color, el.size) : el.source.url;
  const img = await FabricImage.fromURL(src, { crossOrigin: "anonymous" });
  img.set({ ...common, scaleX: el.size / (img.width || el.size), scaleY: el.size / (img.height || el.size) });
  (img as unknown as { elementId: string }).elementId = el.id;
  return img;
}

function applyPatchToFabricObject(obj: FabricObject, patch: Record<string, unknown>) {
  const mapped: Record<string, unknown> = {};
  if ("color" in patch) mapped.fill = patch.color;
  if ("fontSize" in patch) mapped.fontSize = patch.fontSize;
  if ("bold" in patch) mapped.fontWeight = patch.bold ? "bold" : "normal";
  if ("italic" in patch) mapped.fontStyle = patch.italic ? "italic" : "normal";
  if ("align" in patch) mapped.textAlign = patch.align;
  if ("fill" in patch) mapped.fill = patch.fill;
  if ("stroke" in patch) mapped.stroke = patch.stroke;
  if ("strokeWidth" in patch) mapped.strokeWidth = patch.strokeWidth;
  if ("cornerRadius" in patch) {
    mapped.rx = patch.cornerRadius;
    mapped.ry = patch.cornerRadius;
  }
  if ("content" in patch) {
    const content = patch.content as TextElement["content"];
    if (content.kind === "literal" && obj instanceof Textbox) obj.set("text", content.text);
  }
  obj.set(mapped);
}

function AddFieldMenu({ onAdd }: { onAdd: (field: DynamicField) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-block">
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink">
        + Field ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-10 mt-1 w-56 rounded-lg border border-brand-gray bg-brand-surface py-1 shadow-lg animate-[modal-in_0.15s_ease-out]">
          {DYNAMIC_FIELDS.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() => {
                onAdd(field);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-brand-mint"
            >
              {DYNAMIC_FIELD_LABELS[field]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
