"use client";
import { useEffect, useRef, useState } from "react";
import type { CertificateLayout, CertificateElement, CertificateRenderData } from "@/lib/certificateLayout";
import { resolveFieldValue } from "@/lib/certificateLayout";
import { BUILTIN_ICON_COMPONENTS } from "@/lib/certificateIcons";

export interface CertificateLayoutRendererProps extends CertificateRenderData {
  layout: CertificateLayout;
  logoUrl: string | null;
  /** Undefined for a preview (same convention CertificateCard's own
   * qrSvg prop already uses) — shows a plain placeholder box instead
   * of a QR code for a certificate that doesn't exist yet. */
  qrDataUrl?: string;
  /** Certificate watermark removal — required, not optional/defaulted,
   * so every caller makes an explicit decision rather than silently
   * defaulting one way. Deliberately drawn here, AFTER layout.elements,
   * rather than as a layout element itself: this is the one and only
   * place "Powered by AAICBI" ever gets added to a certificate, so
   * there's nothing in layoutJson an org could strip via the editor or
   * a raw API call to remove it — see shouldShowCertWatermark
   * (src/lib/trainingOrgBilling.ts) for how callers compute this. */
  showWatermark: boolean;
}

/**
 * Visual Certificate Design Editor — the read-only counterpart to the
 * Fabric.js-based editor. Maps a CertificateLayout's elements to
 * plain, absolutely-positioned React nodes using real style objects
 * (never a string of HTML), so there is no injection surface here even
 * in principle — every value in `layout` was already bounded/enum-
 * checked by CertificateLayoutSchema before it was ever stored. A
 * builtin icon renders the real lucide-react component directly (no
 * canvas library involved on this render path at all).
 *
 * Responsive scaling, fixed here as a real bug (not just a preview
 * nuisance — this is the exact component /certificate/[code] renders
 * too): elements use absolute px coordinates in `layout`'s own
 * width/height space, so a narrow container needs the WHOLE inner box
 * visually scaled down via CSS transform, not just its outer wrapper
 * shrunk — a shrunk wrapper with untransformed absolute-positioned
 * children just clips them, which is exactly what was happening in any
 * container narrower than the design's own width (e.g. the admin
 * tool's sidebar preview).
 */
export default function CertificateLayoutRenderer({ layout, logoUrl, qrDataUrl, showWatermark, ...data }: CertificateLayoutRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / layout.width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [layout.width]);

  return (
    <div ref={containerRef} className="relative mx-auto w-full" style={{ maxWidth: layout.width, aspectRatio: `${layout.width} / ${layout.height}` }}>
      <div
        className="absolute left-0 top-0 overflow-hidden rounded-2xl print:border print:shadow-none animate-[modal-in_0.4s_ease-out]"
        style={{ width: layout.width, height: layout.height, backgroundColor: layout.backgroundColor, transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        {layout.backgroundImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- an uploaded certificate design, drawn edge to edge behind the fields.
          <img src={layout.backgroundImageUrl} alt="" className="absolute left-0 top-0 select-none" style={{ width: layout.width, height: layout.height }} draggable={false} />
        )}
        {layout.elements.map((el) => (
          <ElementNode key={el.id} element={el} logoUrl={logoUrl} qrDataUrl={qrDataUrl} data={data} />
        ))}
        {showWatermark && (
          <p
            className="absolute bottom-0 left-0 m-0"
            style={{ width: layout.width, textAlign: "center", fontSize: 10, fontFamily: "Georgia", color: "#9CA3AF", padding: "6px 0" }}
          >
            POWERED BY AAICBI.ORG
          </p>
        )}
      </div>
    </div>
  );
}

function ElementNode({
  element,
  logoUrl,
  qrDataUrl,
  data,
}: {
  element: CertificateElement;
  logoUrl: string | null;
  qrDataUrl?: string;
  data: CertificateRenderData;
}) {
  const base: React.CSSProperties = {
    position: "absolute",
    left: element.x,
    top: element.y,
    transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
    transformOrigin: "top left",
  };

  if (element.type === "text") {
    const text = element.content.kind === "literal" ? element.content.text : resolveFieldValue(element.content.field, data);
    return (
      <p
        style={{
          ...base,
          width: element.width,
          fontSize: element.fontSize,
          fontFamily: element.fontFamily,
          fontWeight: element.bold ? 700 : 400,
          fontStyle: element.italic ? "italic" : "normal",
          color: element.color,
          textAlign: element.align,
          margin: 0,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </p>
    );
  }

  if (element.type === "image") {
    const src = element.source === "logo" ? logoUrl : qrDataUrl;
    if (!src) {
      return (
        <div
          style={{ ...base, width: element.width, height: element.height }}
          className="flex items-center justify-center rounded-lg border border-dashed border-brand-gray text-[10px] text-gray-400"
        >
          {element.source === "logo" ? "Logo" : "QR code"}
        </div>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element -- a dynamically-sourced URL/data-URI, same reasoning as every other org-branded image in this app.
    return <img src={src} alt="" style={{ ...base, width: element.width, height: element.height, objectFit: "contain" }} />;
  }

  if (element.type === "icon") {
    if (element.source.kind === "builtin") {
      const Icon = BUILTIN_ICON_COMPONENTS[element.source.name];
      return (
        <div style={{ ...base, width: element.size, height: element.size }}>
          <Icon color={element.color} size={element.size} />
        </div>
      );
    }
    // eslint-disable-next-line @next/next/no-img-element -- an uploaded icon URL, loaded as an image resource (never inlined), same reasoning as the logo/QR image elements above.
    return <img src={element.source.url} alt="" style={{ ...base, width: element.size, height: element.size, objectFit: "contain" }} />;
  }

  // shape
  if (element.shapeType === "rect") {
    return (
      <div
        style={{
          ...base,
          width: element.width,
          height: element.height,
          backgroundColor: element.fill,
          borderColor: element.stroke,
          borderWidth: element.strokeWidth ?? (element.stroke ? 1 : 0),
          borderStyle: element.stroke ? "solid" : undefined,
          borderRadius: element.cornerRadius,
        }}
      />
    );
  }
  // line
  return (
    <div
      style={{
        ...base,
        width: element.width,
        height: element.strokeWidth ?? 1,
        backgroundColor: element.stroke ?? element.fill,
      }}
    />
  );
}
