"use client";
import { useEffect, useRef, useState } from "react";
import { Stage, Layer, Text, Rect, Line, Image as KonvaImage, Transformer } from "react-konva";
import type Konva from "konva";
import useImage from "use-image";
import {
  DYNAMIC_FIELDS,
  DYNAMIC_FIELD_LABELS,
  DEFAULT_LAYOUT_WIDTH,
  DEFAULT_LAYOUT_HEIGHT,
  type CertificateLayout,
  type CertificateElement,
  type TextElement,
  type DynamicField,
} from "@/lib/certificateLayout";
import ElementPropertiesPanel from "@/components/certificateEditor/ElementPropertiesPanel";

const DEFAULT_LAYOUT: CertificateLayout = {
  width: DEFAULT_LAYOUT_WIDTH,
  height: DEFAULT_LAYOUT_HEIGHT,
  backgroundColor: "#FFFFFF",
  elements: [],
};

// The editor's own design space is always DEFAULT_LAYOUT_WIDTH/HEIGHT
// px, scaled down to fit the page — Konva's Stage scaleX/scaleY keeps
// every element's stored x/y/width in that full-resolution coordinate
// system regardless of how small the on-screen canvas is drawn.
const DISPLAY_WIDTH = 640;

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export interface CertificateCanvasEditorProps {
  layout: CertificateLayout | null;
  onChange: (layout: CertificateLayout) => void;
  logoUrl: string | null;
  disabled: boolean;
}

export default function CertificateCanvasEditor({ layout, onChange, logoUrl, disabled }: CertificateCanvasEditorProps) {
  const [current, setCurrent] = useState<CertificateLayout>(layout ?? DEFAULT_LAYOUT);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const shapeRefs = useRef<Record<string, Konva.Node>>({});
  const scale = DISPLAY_WIDTH / current.width;

  function update(next: CertificateLayout) {
    setCurrent(next);
    onChange(next);
  }

  function updateElement(id: string, patch: Record<string, unknown>) {
    update({
      ...current,
      elements: current.elements.map((el) => (el.id === id ? ({ ...el, ...patch } as CertificateElement) : el)),
    });
  }

  function addElement(el: CertificateElement) {
    update({ ...current, elements: [...current.elements, el] });
    setSelectedId(el.id);
  }

  function removeSelected() {
    if (!selectedId) return;
    update({ ...current, elements: current.elements.filter((el) => el.id !== selectedId) });
    setSelectedId(null);
  }

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;
    const node = selectedId ? shapeRefs.current[selectedId] : null;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [selectedId, current.elements]);

  function handleDragEnd(el: CertificateElement, target: Konva.Node) {
    updateElement(el.id, { x: target.x(), y: target.y() });
  }

  function handleTransformEnd(el: CertificateElement, target: Konva.Node) {
    const scaleX = target.scaleX();
    const scaleY = target.scaleY();
    target.scaleX(1);
    target.scaleY(1);
    const rotation = target.rotation();
    if (el.type === "text") {
      updateElement(el.id, { x: target.x(), y: target.y(), width: Math.max(20, el.width * scaleX), rotation });
    } else {
      updateElement(el.id, {
        x: target.x(),
        y: target.y(),
        width: Math.max(10, el.width * scaleX),
        height: Math.max(10, el.height * scaleY),
        rotation,
      });
    }
  }

  function addText(content: TextElement["content"]) {
    addElement({
      id: newId(),
      type: "text",
      x: 40,
      y: 40,
      width: 300,
      rotation: 0,
      fontSize: 24,
      fontFamily: "Georgia",
      bold: false,
      italic: false,
      color: "#16302B",
      align: "left",
      content,
    });
  }

  const selected = current.elements.find((el) => el.id === selectedId) ?? null;

  return (
    <div onKeyDown={(e) => { if ((e.key === "Delete" || e.key === "Backspace") && selectedId) removeSelected(); }} tabIndex={-1}>
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
            onClick={() =>
              addElement({ id: newId(), type: "shape", shapeType: "rect", x: 20, y: 20, width: 200, height: 120, rotation: 0, stroke: "#D99A34", strokeWidth: 3 })
            }
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
          {selectedId && (
            <button type="button" onClick={removeSelected} className="ml-auto rounded-lg border border-brand-rose px-2.5 py-1 text-xs font-semibold text-brand-rose">
              Delete selected
            </button>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-start gap-4">
        <div className="overflow-hidden rounded-lg border border-brand-gray" style={{ width: DISPLAY_WIDTH, height: current.height * scale }}>
          <Stage
            width={current.width * scale}
            height={current.height * scale}
            scaleX={scale}
            scaleY={scale}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelectedId(null);
            }}
          >
            <Layer>
              <Rect x={0} y={0} width={current.width} height={current.height} fill={current.backgroundColor} listening={false} />
              {current.elements.map((el) => (
                <ElementShape
                  key={el.id}
                  element={el}
                  logoUrl={logoUrl}
                  draggable={!disabled}
                  registerRef={(node) => {
                    if (node) shapeRefs.current[el.id] = node;
                  }}
                  onSelect={() => setSelectedId(el.id)}
                  onDragEnd={(target) => handleDragEnd(el, target)}
                  onTransformEnd={(target) => handleTransformEnd(el, target)}
                />
              ))}
              <Transformer ref={transformerRef} rotateEnabled flipEnabled={false} />
            </Layer>
          </Stage>
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
            {selected && <ElementPropertiesPanel element={selected} onChange={(patch) => updateElement(selected.id, patch)} />}
            {!selected && <p className="mt-3 text-xs text-gray-500">Click an element on the canvas to edit it.</p>}
          </div>
        )}
      </div>
    </div>
  );
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

function ElementShape({
  element,
  logoUrl,
  draggable,
  registerRef,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: {
  element: CertificateElement;
  logoUrl: string | null;
  draggable: boolean;
  registerRef: (node: Konva.Node | null) => void;
  onSelect: () => void;
  onDragEnd: (target: Konva.Node) => void;
  onTransformEnd: (target: Konva.Node) => void;
}) {
  const common = {
    id: element.id,
    x: element.x,
    y: element.y,
    rotation: element.rotation,
    draggable,
    onClick: onSelect,
    onTap: onSelect,
    ref: registerRef,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEnd(e.target),
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => onTransformEnd(e.target),
  };

  if (element.type === "text") {
    const label = element.content.kind === "literal" ? element.content.text : `{${DYNAMIC_FIELD_LABELS[element.content.field]}}`;
    return (
      <Text
        {...common}
        text={label}
        width={element.width}
        fontSize={element.fontSize}
        fontFamily={element.fontFamily}
        fontStyle={`${element.bold ? "bold" : ""} ${element.italic ? "italic" : ""}`.trim() || "normal"}
        fill={element.color}
        align={element.align}
      />
    );
  }

  if (element.type === "image") {
    return <ImageShape common={common} element={element} logoUrl={logoUrl} />;
  }

  if (element.shapeType === "rect") {
    return (
      <Rect
        {...common}
        width={element.width}
        height={element.height}
        fill={element.fill}
        stroke={element.stroke}
        strokeWidth={element.strokeWidth ?? (element.stroke ? 1 : 0)}
        cornerRadius={element.cornerRadius}
      />
    );
  }
  return <Line {...common} points={[0, 0, element.width, 0]} stroke={element.stroke ?? element.fill ?? "#000000"} strokeWidth={element.strokeWidth ?? 2} />;
}

function ImageShape({
  common,
  element,
  logoUrl,
}: {
  common: Record<string, unknown>;
  element: Extract<CertificateElement, { type: "image" }>;
  logoUrl: string | null;
}) {
  const [image] = useImage(element.source === "logo" ? logoUrl ?? "" : "", "anonymous");
  if (element.source === "qr" || !image) {
    return (
      <Rect
        {...common}
        width={element.width}
        height={element.height}
        fill="#F3F4F6"
        stroke="#D1D5DB"
        strokeWidth={1}
        dash={[4, 4]}
      />
    );
  }
  return <KonvaImage {...common} image={image} width={element.width} height={element.height} />;
}
