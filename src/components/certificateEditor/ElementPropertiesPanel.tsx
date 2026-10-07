"use client";
import type { CertificateElement } from "@/lib/certificateLayout";

import { Checkbox, Input, Select } from "@/components/ui/Field";
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
          <Input label="Text" compact value={element.content.kind === "literal" ? element.content.text : ""} onChange={(e) => onChange({ content: { kind: "literal", text: e.target.value } })} />
        ) : (
          <p className="text-xs text-gray-500">Bound to a dynamic field — its real value fills in automatically.</p>
        )}
        <div className="flex gap-2">
          <Input label="Size" compact wrapperClassName="flex-1" type="number" min={6} max={200} value={element.fontSize} onChange={(e) => onChange({ fontSize: Number(e.target.value) || element.fontSize })} />
          <label className="flex-1 text-xs font-semibold text-gray-600">
            Color
            <input type="color" value={element.color} onChange={(e) => onChange({ color: e.target.value })} className="mt-1 h-9 w-full rounded-lg border border-brand-gray" />
          </label>
        </div>
        <div className="flex gap-3">
          <Checkbox label="Bold" checked={element.bold} onChange={(e) => onChange({ bold: e.target.checked })} />
          <Checkbox label="Italic" checked={element.italic} onChange={(e) => onChange({ italic: e.target.checked })} />
        </div>
        <Select label="Align" compact value={element.align} onChange={(e) => onChange({ align: e.target.value })}>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </Select>
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
        <Input label="Size" compact type="number" min={8} max={500} value={element.size} onChange={(e) => onChange({ size: Number(e.target.value) || element.size })} />
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
      <Input label="Stroke width" compact type="number" min={0} max={40} value={element.strokeWidth ?? 1} onChange={(e) => onChange({ strokeWidth: Number(e.target.value) || 0 })} />
      {element.shapeType === "rect" && (
        <Input label="Corner radius" compact type="number" min={0} max={200} value={element.cornerRadius ?? 0} onChange={(e) => onChange({ cornerRadius: Number(e.target.value) || 0 })} />
      )}
    </div>
  );
}
