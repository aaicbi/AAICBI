"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, Textbox, Rect, Line, FabricImage, FabricObject, ActiveSelection, util } from "fabric";
import type { TPointerEvent } from "fabric";
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
  const [multiCount, setMultiCount] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [uploadedIcons, setUploadedIcons] = useState<UploadedIcon[]>([]);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<Canvas | null>(null);
  const objectsRef = useRef<Record<string, FabricObject>>({});
  const guideLinesRef = useRef<{ v: Line | null; h: Line | null }>({ v: null, h: null });
  const currentRef = useRef(current);
  currentRef.current = current;
  const scale = DISPLAY_WIDTH / current.width;

  // --- Undo/redo: a plain snapshot stack, scoped to this editing session
  // only (not persisted) — same convention as the rest of this component,
  // where `elements` state is the single source of truth and the canvas is
  // just kept in sync with it. `update()` is the one chokepoint every edit
  // already goes through (property-panel changes, drag/resize/rotate,
  // add/delete, background, page size), so it's the one place a history
  // entry needs to be pushed.
  const undoStackRef = useRef<CertificateLayout[]>([]);
  const redoStackRef = useRef<CertificateLayout[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  function update(next: CertificateLayout) {
    undoStackRef.current.push(structuredClone(currentRef.current));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    setCurrent(next);
    onChange(next);
  }

  // Re-syncs the canvas's actual Fabric objects to a snapshot — used by
  // undo/redo only. Full reload rather than a diff/patch: undo can jump
  // back across an add/delete/preset-pick, not just a property tweak, so
  // there's no single object to patch in the general case.
  function applySnapshot(target: CertificateLayout) {
    const canvas = fabricRef.current;
    const reselectId = selectedId && target.elements.some((el) => el.id === selectedId) ? selectedId : null;
    if (canvas) {
      canvas.remove(...canvas.getObjects());
      objectsRef.current = {};
      loadElements(canvas, target.elements, logoUrl, objectsRef)
        .then(() => {
          // Keep the same element selected across undo/redo when it still
          // exists in the restored snapshot, rather than forcing the user
          // to re-click it after every step back/forward.
          const obj = reselectId ? objectsRef.current[reselectId] : null;
          if (obj) canvas.setActiveObject(obj);
          canvas.requestRenderAll();
        })
        .catch((err) => console.error("Failed to reload certificate layout for undo/redo:", err));
    }
    setSelectedId(reselectId);
    setCurrent(target);
    onChange(target);
  }

  function undo() {
    const prev = undoStackRef.current.pop();
    if (!prev) return;
    redoStackRef.current.push(structuredClone(currentRef.current));
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    applySnapshot(prev);
  }

  function redo() {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(structuredClone(currentRef.current));
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
    applySnapshot(next);
  }

  // Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (also Ctrl/Cmd+Y) — skipped while an
  // input/textarea/contentEditable has focus so native text-field undo
  // (including Fabric's own hidden textarea it uses for inline text
  // editing) isn't hijacked.
  useEffect(() => {
    if (disabled) return;
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled]);

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

    function handleSelection(e: { selected?: FabricObject[] }) {
      const sel = e.selected ?? [];
      if (sel.length > 1) {
        setSelectedId(null);
        setMultiCount(sel.length);
      } else {
        setSelectedId(fabricObjectElementId(sel[0]));
        setMultiCount(0);
      }
    }
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", () => {
      setSelectedId(null);
      setMultiCount(0);
    });
    canvas.on("object:modified", (e) => {
      hideGuides();
      handleModified(e.target);
    });
    canvas.on("object:moving", (e) => handleObjectMoving(e.target));
    canvas.on("mouse:up", hideGuides);

    // Right-click to duplicate — Fabric has no built-in context menu, and
    // leaving the browser's own menu up over the canvas isn't useful here,
    // so this both suppresses it and selects whatever's under the pointer
    // (unless it's already part of the current selection, e.g. right-
    // clicking one member of a multiselect shouldn't collapse it to one).
    const upperCanvasEl = canvas.upperCanvasEl;
    function handleContextMenu(domEvent: MouseEvent) {
      domEvent.preventDefault();
      const { target } = canvas.findTarget(domEvent as unknown as TPointerEvent) ?? {};
      if (target && !canvas.getActiveObjects().includes(target)) {
        canvas.setActiveObject(target);
        canvas.requestRenderAll();
      }
      if (canvas.getActiveObjects().length > 0) {
        setContextMenu({ x: domEvent.clientX, y: domEvent.clientY });
      }
    }
    upperCanvasEl.addEventListener("contextmenu", handleContextMenu);

    loadElements(canvas, currentRef.current.elements, logoUrl, objectsRef).catch((err) => console.error("Failed to load certificate layout onto the canvas:", err));

    return () => {
      upperCanvasEl.removeEventListener("contextmenu", handleContextMenu);
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
    if (target instanceof ActiveSelection) {
      handleMultiModified(target);
      return;
    }
    const id = fabricObjectElementId(target);
    if (!id) return;
    const el = currentRef.current.elements.find((e) => e.id === id);
    if (!el) return;

    const x = target.left ?? el.x;
    const y = target.top ?? el.y;
    const rotation = target.angle ?? 0;

    if (target instanceof FabricImage) {
      // A FabricImage's own width/height are a crop box relative to
      // its natural pixel data, NOT a freely resizable box the way a
      // Rect's are — every other branch here normalizes a resize by
      // baking scale into width/height and resetting scale to 1, which
      // for an image instead clips it down to (at most) its natural
      // resolution, silently making it vanish past that point. Images
      // — logo, QR, and both builtin and uploaded icons — read the
      // resize purely off scaleX/scaleY via getScaledWidth/Height
      // instead, leaving the object's own width/height (and its scale)
      // untouched; buildFabricObject already recomputes the correct
      // scale from stored size on every reload regardless.
      const scaledWidth = Math.max(8, target.getScaledWidth());
      const scaledHeight = Math.max(8, target.getScaledHeight());
      if (el.type === "icon") {
        updateElement(id, { x, y, size: scaledWidth, rotation });
      } else {
        updateElement(id, { x, y, width: scaledWidth, height: scaledHeight, rotation });
      }
    } else if (el.type === "text") {
      const width = Math.max(20, (target.width ?? el.width) * (target.scaleX ?? 1));
      target.set({ scaleX: 1, scaleY: 1, width });
      updateElement(id, { x, y, width, rotation });
    } else if (el.type === "shape" && el.shapeType === "line") {
      const width = Math.max(1, (target.width ?? el.width) * (target.scaleX ?? 1));
      target.set({ scaleX: 1, scaleY: 1 });
      updateElement(id, { x, y, width, rotation });
    } else if (el.type === "icon") {
      // The dashed placeholder Rect shown when there's no real image
      // yet (a QR code at design time, or a logo that hasn't been
      // uploaded) — a genuine Rect, so width/height baking is correct.
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

  // A multi-selection drag only ever translates members (resizing/rotating
  // the whole selection is out of scope for now — the ask was moving a
  // group as a unit, not group-transform) — just re-read each member's own
  // position afterward.
  //
  // This does NOT use getBoundingRect()/.left/.top directly: while an
  // object is still part of an active ActiveSelection (i.e. exactly when
  // this handler runs — "object:modified" fires before the user deselects),
  // Fabric has already rewritten that object's own left/top into the
  // selection's LOCAL coordinate space (ActiveSelection extends Group, and
  // Group._enterGroup applies that rewrite on every member the moment it's
  // added to the selection) — confirmed live: reading .left/.top here gave
  // wildly wrong, sometimes negative, canvas positions, which only became
  // correct again once the user deselected and Fabric converted them back.
  // calcTransformMatrix() is the one API documented to always return an
  // object's FULL transform chain regardless of group nesting, so
  // qrDecompose() on it gives the object's true absolute center — the
  // standard Fabric pattern for exactly this "object inside an active
  // selection" case.
  function handleMultiModified(selection: ActiveSelection) {
    // One atomic update() for every member, not updateElement() per member
    // in a loop — update() derives its next state from currentRef.current,
    // which only advances on the next render, so N calls in the same tick
    // each compute from the same stale base and only the last one's change
    // survives, silently dropping every earlier member's new position.
    // Confirmed live: a 2-object group move left the first-processed
    // object's position completely unchanged in the saved state despite
    // moving correctly on screen.
    const patches = new Map<string, { x: number; y: number }>();
    for (const obj of selection.getObjects()) {
      const id = fabricObjectElementId(obj);
      if (!id || !currentRef.current.elements.some((e) => e.id === id)) continue;
      const { translateX: centerX, translateY: centerY } = util.qrDecompose(obj.calcTransformMatrix());
      const w = obj.getScaledWidth();
      const h = obj.getScaledHeight();
      patches.set(id, { x: centerX - w / 2, y: centerY - h / 2 });
    }
    if (patches.size === 0) return;
    update({
      ...currentRef.current,
      elements: currentRef.current.elements.map((el) => (patches.has(el.id) ? ({ ...el, ...patches.get(el.id)! } as CertificateElement) : el)),
    });
    canvasRenderAll();
  }

  const SNAP_THRESHOLD = 6; // logical px, independent of display zoom

  // Smart alignment guides — snaps the object being dragged to the edges/
  // centers of other elements and to the page's own center, same category
  // of feature as every mainstream design tool's canvas. Fabric has no
  // built-in version of this; it's computed by hand on every "object:moving"
  // tick against the other objects' current bounding boxes.
  function handleObjectMoving(target: FabricObject | undefined) {
    const canvas = fabricRef.current;
    if (!target || !canvas) return;

    const excludeIds = new Set<string | null>();
    if (target instanceof ActiveSelection) {
      for (const obj of target.getObjects()) excludeIds.add(fabricObjectElementId(obj));
    } else {
      excludeIds.add(fabricObjectElementId(target));
    }

    const pageWidth = currentRef.current.width;
    const pageHeight = currentRef.current.height;
    const xs: number[] = [pageWidth / 2];
    const ys: number[] = [pageHeight / 2];
    for (const obj of canvas.getObjects()) {
      const id = fabricObjectElementId(obj);
      if (!id || excludeIds.has(id)) continue; // skip guide lines (no id) and the object(s) being moved
      const rect = obj.getBoundingRect();
      xs.push(rect.left, rect.left + rect.width / 2, rect.left + rect.width);
      ys.push(rect.top, rect.top + rect.height / 2, rect.top + rect.height);
    }

    const w = target.getScaledWidth();
    const h = target.getScaledHeight();
    const left = target.left ?? 0;
    const top = target.top ?? 0;
    const movingXs = [left, left + w / 2, left + w];
    const movingYs = [top, top + h / 2, top + h];

    let snappedLeft: number | null = null;
    let guideX: number | null = null;
    let bestDx = SNAP_THRESHOLD;
    for (const mv of movingXs) {
      for (const sx of xs) {
        const d = Math.abs(mv - sx);
        if (d < bestDx) {
          bestDx = d;
          snappedLeft = left + (sx - mv);
          guideX = sx;
        }
      }
    }

    let snappedTop: number | null = null;
    let guideY: number | null = null;
    let bestDy = SNAP_THRESHOLD;
    for (const mv of movingYs) {
      for (const sy of ys) {
        const d = Math.abs(mv - sy);
        if (d < bestDy) {
          bestDy = d;
          snappedTop = top + (sy - mv);
          guideY = sy;
        }
      }
    }

    if (snappedLeft !== null || snappedTop !== null) {
      target.set({ left: snappedLeft ?? left, top: snappedTop ?? top });
      target.setCoords();
    }
    showGuides(canvas, guideX, guideY);
  }

  function showGuides(canvas: Canvas, x: number | null, y: number | null) {
    const pageWidth = currentRef.current.width;
    const pageHeight = currentRef.current.height;
    const guides = guideLinesRef.current;

    if (x !== null) {
      if (!guides.v) {
        guides.v = new Line([x, 0, x, pageHeight], { stroke: "#FF3B9A", strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, excludeFromExport: true });
        canvas.add(guides.v);
      }
      guides.v.set({ x1: x, x2: x, y1: 0, y2: pageHeight, visible: true });
      canvas.bringObjectToFront(guides.v);
    } else {
      guides.v?.set({ visible: false });
    }

    if (y !== null) {
      if (!guides.h) {
        guides.h = new Line([0, y, pageWidth, y], { stroke: "#FF3B9A", strokeWidth: 1, strokeDashArray: [4, 4], selectable: false, evented: false, excludeFromExport: true });
        canvas.add(guides.h);
      }
      guides.h.set({ x1: 0, x2: pageWidth, y1: y, y2: y, visible: true });
      canvas.bringObjectToFront(guides.h);
    } else {
      guides.h?.set({ visible: false });
    }

    canvas.requestRenderAll();
  }

  function hideGuides() {
    const guides = guideLinesRef.current;
    guides.v?.set({ visible: false });
    guides.h?.set({ visible: false });
    fabricRef.current?.requestRenderAll();
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

  // Handles one selected element or a whole multiselect — getActiveObjects()
  // returns both the same way, so there's no need to branch on selectedId
  // vs. multiCount here.
  function removeSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) return;
    const ids = active.map(fabricObjectElementId).filter((id): id is string => !!id);
    if (ids.length === 0) return;
    canvas.discardActiveObject();
    for (const obj of active) canvas.remove(obj);
    for (const id of ids) delete objectsRef.current[id];
    canvas.requestRenderAll();
    update({ ...currentRef.current, elements: currentRef.current.elements.filter((el) => !ids.includes(el.id)) });
    setSelectedId(null);
    setMultiCount(0);
  }

  // Right-click → Duplicate, for one selected element or a whole
  // multiselect alike — clones each into a new element with a fresh id,
  // offset slightly so the copy isn't hidden directly under the original,
  // and leaves the new copy(ies) selected.
  async function duplicateSelected() {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length === 0) return;
    const ids = active.map(fabricObjectElementId).filter((id): id is string => !!id);
    const clones: CertificateElement[] = [];
    for (const id of ids) {
      const el = currentRef.current.elements.find((e) => e.id === id);
      if (!el) continue;
      clones.push({ ...el, id: newId(), x: el.x + 20, y: el.y + 20 } as CertificateElement);
    }
    if (clones.length === 0) return;

    update({ ...currentRef.current, elements: [...currentRef.current.elements, ...clones] });

    const newObjs: FabricObject[] = [];
    for (const el of clones) {
      const obj = await buildFabricObject(el, logoUrl);
      if (obj) {
        objectsRef.current[el.id] = obj;
        canvas.add(obj);
        newObjs.push(obj);
      }
    }
    canvas.discardActiveObject();
    if (newObjs.length === 1) {
      canvas.setActiveObject(newObjs[0]);
      setSelectedId(clones[0].id);
      setMultiCount(0);
    } else if (newObjs.length > 1) {
      canvas.setActiveObject(new ActiveSelection(newObjs, { canvas }));
      setSelectedId(null);
      setMultiCount(newObjs.length);
    }
    canvas.requestRenderAll();
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
    <div onKeyDown={(e) => { if ((e.key === "Delete" || e.key === "Backspace") && (selectedId || multiCount > 0) && !disabled) removeSelected(); }} tabIndex={-1}>
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
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className="rounded-lg border border-brand-gray px-2.5 py-1 text-xs font-semibold text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
          >
            Redo
          </button>
          {(selectedId || multiCount > 0) && (
            <button type="button" onClick={removeSelected} className="ml-auto rounded-lg border border-brand-rose px-2.5 py-1 text-xs font-semibold text-brand-rose">
              {multiCount > 0 ? `Delete ${multiCount} selected` : "Delete selected"}
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
            {!selected && multiCount > 1 && (
              <p className="mt-3 text-xs text-gray-500">
                {multiCount} elements selected — drag any of them to move the group together, or right-click for more options.
              </p>
            )}
            {!selected && multiCount <= 1 && <p className="mt-3 text-xs text-gray-500">Click an element on the canvas to edit it. Shift-click or drag a box to select several.</p>}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDuplicate={() => {
            duplicateSelected();
            setContextMenu(null);
          }}
        />
      )}
    </div>
  );
}

function ContextMenu({ x, y, onClose, onDuplicate }: { x: number; y: number; onClose: () => void; onDuplicate: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", left: x, top: y, zIndex: 50 }}
      className="w-40 rounded-lg border border-brand-gray bg-brand-surface py-1 shadow-lg animate-[modal-in_0.15s_ease-out]"
    >
      <button type="button" onClick={onDuplicate} className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-brand-mint">
        Duplicate
      </button>
    </div>
  );
}

function fabricObjectElementId(obj: FabricObject | undefined): string | null {
  if (!obj) return null;
  return (obj as unknown as { elementId?: string }).elementId ?? null;
}

async function loadElements(canvas: Canvas, elements: CertificateElement[], logoUrl: string | null, objectsRef: React.MutableRefObject<Record<string, FabricObject>>) {
  for (const el of elements) {
    const obj = await buildFabricObject(el, logoUrl);
    if (obj) {
      objectsRef.current[el.id] = obj;
      canvas.add(obj);
    }
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
