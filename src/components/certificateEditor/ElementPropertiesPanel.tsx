"use client";
import type { CertificateElement } from "@/lib/certificateLayout";

/**
 * Visual Certificate Design Editor — the side panel for whichever
 * element is currently selected on the canvas. Plain HTML inputs, not
 * part of Fabric — only the canvas itself is Fabric-rendered.
 */
export default function ElementPropertiesPanel({
  element,
  onChange,
}: {
  element: CertificateElement;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  if (element.type === "text") {
    const isLiteral = element.content.kind === "literal";
    return (
      <div className="mt-3 space-y-2.5 rounded-lg border border-brand-gray p-3">
        {isLiteral ? (
          <label className="block text-xs font-semibold text-gray-600">
            Text
            <input
              value={element.content.kind === "literal" ? element.content.text : ""}
              onChange={(e) => onChange({ content: { kind: "literal", text: e.target.value } })}
              className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
            />
          </label>
        ) : (
          <p className="text-xs text-gray-500">Bound to a dynamic field — its real value fills in automatically.</p>
        )}
        <div className="flex gap-2">
          <label className="flex-1 text-xs font-semibold text-gray-600">
            Size
            <input
              type="number"
              min={6}
              max={200}
              value={element.fontSize}
              onChange={(e) => onChange({ fontSize: Number(e.target.value) || element.fontSize })}
              className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
            />
          </label>
          <label className="flex-1 text-xs font-semibold text-gray-600">
            Color
            <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-brand-gray" />
          </label>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={element.bold} onChange={(e) => onChange({ bold: e.target.checked })} /> Bold
          </label>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
            <input type="checkbox" checked={element.italic} onChange={(e) => onChange({ italic: e.target.checked })} /> Italic
          </label>
        </div>
        <label className="block text-xs font-semibold text-gray-600">
          Align
          <select
            value={element.align}
            onChange={(e) => onChange({ align: e.target.value })}
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </label>
      </div>
    );
  }

  if (element.type === "image") {
    return (
      <div className="mt-3 rounded-lg border border-brand-gray p-3">
        <p className="text-xs text-gray-500">{element.source === "logo" ? "Organization logo" : "QR code (verification link)"} — drag the corner handles to resize.</p>
      </div>
    );
  }

  if (element.type === "icon") {
    return (
      <div className="mt-3 space-y-2.5 rounded-lg border border-brand-gray p-3">
        <label className="block text-xs font-semibold text-gray-600">
          Size
          <input
            type="number"
            min={8}
            max={500}
            value={element.size}
            onChange={(e) => onChange({ size: Number(e.target.value) || element.size })}
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
        <label className="block text-xs font-semibold text-gray-600">
          Color
          <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-brand-gray" />
        </label>
      </div>
    );
  }

  // shape
  return (
    <div className="mt-3 space-y-2.5 rounded-lg border border-brand-gray p-3">
      <div className="flex gap-2">
        {element.shapeType === "rect" && (
          <label className="flex-1 text-xs font-semibold text-gray-600">
            Fill
            <input
              type="color"
              value={element.fill ?? "#FFFFFF"}
              onChange={(e) => onChange({ fill: e.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-brand-gray"
            />
          </label>
        )}
        <label className="flex-1 text-xs font-semibold text-gray-600">
          Stroke
          <input
            type="color"
            value={element.stroke ?? "#000000"}
            onChange={(e) => onChange({ stroke: e.target.value })}
            className="mt-1 h-9 w-full rounded-lg border border-brand-gray"
          />
        </label>
      </div>
      <label className="block text-xs font-semibold text-gray-600">
        Stroke width
        <input
          type="number"
          min={0}
          max={40}
          value={element.strokeWidth ?? 1}
          onChange={(e) => onChange({ strokeWidth: Number(e.target.value) || 0 })}
          className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
        />
      </label>
      {element.shapeType === "rect" && (
        <label className="block text-xs font-semibold text-gray-600">
          Corner radius
          <input
            type="number"
            min={0}
            max={200}
            value={element.cornerRadius ?? 0}
            onChange={(e) => onChange({ cornerRadius: Number(e.target.value) || 0 })}
            className="mt-1 w-full rounded-lg border border-brand-gray px-2 py-1.5 text-sm outline-none focus:border-brand-teal"
          />
        </label>
      )}
    </div>
  );
}
