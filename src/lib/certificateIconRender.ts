/**
 * Visual Certificate Design Editor — converts a built-in lucide-react
 * icon into a `data:image/svg+xml` URI, the one bridge the Fabric.js
 * editor needs (Fabric can't render a React component directly, only
 * an image resource via FabricImage.fromURL). Client-side only —
 * `renderToStaticMarkup` runs fine in the browser despite living under
 * react-dom/server; only called from "use client" editor code, never
 * from the read-only CertificateLayoutRenderer, which renders the
 * actual lucide-react component directly instead (no conversion
 * needed there — it's plain React, not a canvas library).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BUILTIN_ICON_COMPONENTS } from "@/lib/certificateIcons";
import type { BuiltinIconName } from "@/lib/certificateLayout";

export function builtinIconToDataUrl(name: BuiltinIconName, color: string, size: number): string {
  const Icon = BUILTIN_ICON_COMPONENTS[name];
  const svg = renderToStaticMarkup(createElement(Icon, { color, size, strokeWidth: 2 }));
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
