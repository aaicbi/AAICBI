/**
 * Custom HTML Certificate Templates — the one HTML sanitizer in this
 * codebase (none existed before this feature). Deliberately called
 * twice, not once at a single boundary like most validation in this
 * app: once in the PATCH route before storing (so what's previewed
 * after save is exactly what's stored), and again in
 * CustomHtmlCertificate.tsx on every render (defense in depth — this
 * is the one place admin/org-supplied markup reaches the public,
 * unauthenticated /certificate/[code] page, the highest-exposure
 * surface this app has).
 *
 * Allowlist covers structural/typographic markup and full SVG (for
 * embedded vector borders/graphics) — no script/iframe/object/embed/
 * form/link, and no attribute is permitted unless explicitly listed
 * below, which is what keeps `on*` event handlers and `javascript:`
 * URLs out without special-casing them.
 *
 * Deliberately NOT allowing a block-level <style> tag: sanitize-html
 * itself flags it as "inherently vulnerable" (CSS can exfiltrate data
 * via `url()` background requests, among other tricks) and asks for an
 * explicit opt-in to allow it. The already-allowed inline `style="..."`
 * attribute covers every real design need a certificate has — color,
 * font, spacing, borders — without that risk, so there's no reason to
 * take it on.
 */
import sanitizeHtml from "sanitize-html";

const SVG_TAGS = [
  "svg", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "g", "defs", "lineargradient", "radialgradient", "stop", "clippath", "use", "text", "tspan",
];

const ALLOWED_TAGS = [
  "div", "span", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "em", "b", "i", "u", "br", "hr",
  "table", "thead", "tbody", "tr", "td", "th",
  "ul", "ol", "li", "img",
  ...SVG_TAGS,
];

const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  "*": ["class", "style", "id"],
  img: ["src", "alt", "width", "height"],
  svg: ["viewbox", "width", "height", "xmlns", "fill", "stroke"],
  path: ["d", "fill", "stroke", "stroke-width"],
  rect: ["x", "y", "width", "height", "rx", "ry", "fill", "stroke"],
  circle: ["cx", "cy", "r", "fill", "stroke"],
  ellipse: ["cx", "cy", "rx", "ry", "fill", "stroke"],
  line: ["x1", "y1", "x2", "y2", "stroke", "stroke-width"],
  polyline: ["points", "fill", "stroke"],
  polygon: ["points", "fill", "stroke"],
  lineargradient: ["id", "x1", "y1", "x2", "y2"],
  radialgradient: ["id", "cx", "cy", "r"],
  stop: ["offset", "stop-color", "stop-opacity"],
  use: ["href", "x", "y"],
  text: ["x", "y", "font-size", "fill"],
  table: ["border", "cellpadding", "cellspacing"],
};

export function sanitizeCertificateHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // https only — the one legitimate URL in this template is
    // {{logoUrl}}, already substituted in as a real Vercel Blob URL by
    // the time this runs. No http/data/javascript/anything else.
    allowedSchemes: ["https"],
  });
}
