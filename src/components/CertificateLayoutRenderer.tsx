import type { CertificateLayout, CertificateElement, CertificateRenderData } from "@/lib/certificateLayout";
import { resolveFieldValue } from "@/lib/certificateLayout";

export interface CertificateLayoutRendererProps extends CertificateRenderData {
  layout: CertificateLayout;
  logoUrl: string | null;
  /** Undefined for a preview (same convention CertificateCard's own
   * qrSvg prop already uses) — shows a plain placeholder box instead
   * of a QR code for a certificate that doesn't exist yet. */
  qrDataUrl?: string;
}

/**
 * Visual Certificate Design Editor — the read-only counterpart to the
 * Konva-based editor. Maps a CertificateLayout's elements to plain,
 * absolutely-positioned React nodes using real style objects (never a
 * string of HTML), so there is no injection surface here even in
 * principle — every value in `layout` was already bounded/enum-checked
 * by CertificateLayoutSchema before it was ever stored.
 */
export default function CertificateLayoutRenderer({ layout, logoUrl, qrDataUrl, ...data }: CertificateLayoutRendererProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl print:border print:shadow-none animate-[modal-in_0.4s_ease-out]"
      style={{ width: layout.width, height: layout.height, backgroundColor: layout.backgroundColor, margin: "0 auto", maxWidth: "100%" }}
    >
      {layout.elements.map((el) => (
        <ElementNode key={el.id} element={el} logoUrl={logoUrl} qrDataUrl={qrDataUrl} data={data} />
      ))}
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
