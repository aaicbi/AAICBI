/**
 * Visual Certificate Design Editor — the starting-template gallery.
 * Each preset is a real CertificateLayout (validated by
 * CertificateLayoutSchema in its own test) built from the same
 * text/image/shape/icon element set the editor itself produces — no
 * separate "preset format." Picking one just copies its `layout`
 * object as the starting point for a new CertificateTemplate; there is
 * no ongoing link back to the preset afterward.
 *
 * "AAICBI Classic" is also the platform-wide fallback layout — used by
 * CertificateDisplay whenever no template (or a template with no
 * layoutJson at all) applies, replacing the old hardcoded
 * CertificateCard component with real data on the same one engine
 * everything else now uses.
 */
import type { CertificateLayout } from "@/lib/certificateLayout";

const TEAL = "#016B61";
const GOLD = "#D99A34";
const INK = "#16302B";
const GRAY = "#6B7280";

const AAICBI_CLASSIC: CertificateLayout = {
  width: 1000,
  height: 700,
  backgroundColor: "#FDF8EE",
  elements: [
    { id: "border", type: "shape", shapeType: "rect", x: 16, y: 16, width: 968, height: 668, rotation: 0, stroke: GOLD, strokeWidth: 3, cornerRadius: 16 },
    { id: "logo", type: "image", x: 465, y: 50, width: 70, height: 70, rotation: 0, source: "logo" },
    { id: "org", type: "text", x: 0, y: 134, width: 1000, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: true, italic: false, color: TEAL, align: "center",
      content: { kind: "field", field: "organizationName" } },
    { id: "intro", type: "text", x: 0, y: 174, width: 1000, rotation: 0, fontSize: 15, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "literal", text: "This certifies that" } },
    { id: "trainee", type: "text", x: 0, y: 206, width: 1000, rotation: 0, fontSize: 38, fontFamily: "Georgia", bold: false, italic: true, color: INK, align: "center",
      content: { kind: "field", field: "traineeName" } },
    { id: "verb", type: "text", x: 0, y: 280, width: 1000, rotation: 0, fontSize: 15, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "field", field: "verb" } },
    { id: "course", type: "text", x: 0, y: 310, width: 1000, rotation: 0, fontSize: 24, fontFamily: "Georgia", bold: true, italic: false, color: TEAL, align: "center",
      content: { kind: "field", field: "credentialTitle" } },
    { id: "meta", type: "text", x: 90, y: 460, width: 360, rotation: 0, fontSize: 13, fontFamily: "Georgia", bold: false, italic: false, color: "#374151", align: "left",
      content: { kind: "literal", text: "Issued:" } },
    { id: "issuedAt", type: "text", x: 90, y: 480, width: 360, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: true, italic: false, color: INK, align: "left",
      content: { kind: "field", field: "issuedAt" } },
    { id: "codeLabel", type: "text", x: 90, y: 515, width: 360, rotation: 0, fontSize: 13, fontFamily: "Georgia", bold: false, italic: false, color: "#374151", align: "left",
      content: { kind: "literal", text: "Certificate Code:" } },
    { id: "code", type: "text", x: 90, y: 535, width: 360, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: true, italic: false, color: INK, align: "left",
      content: { kind: "field", field: "certificateCode" } },
    { id: "qr", type: "image", x: 830, y: 450, width: 100, height: 100, rotation: 0, source: "qr" },
    { id: "badgeIcon", type: "icon", x: 455, y: 400, size: 28, rotation: 0, color: GOLD, source: { kind: "builtin", name: "BadgeCheck" } },
    { id: "badgeText", type: "text", x: 0, y: 432, width: 1000, rotation: 0, fontSize: 12, fontFamily: "Georgia", bold: true, italic: false, color: GOLD, align: "center",
      content: { kind: "literal", text: "VERIFIED BY AAICBI" } },
    { id: "signatory", type: "text", x: 600, y: 540, width: 300, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: true, italic: false, color: INK, align: "center",
      content: { kind: "field", field: "signatoryName" } },
    { id: "signatoryTitle", type: "text", x: 600, y: 562, width: 300, rotation: 0, fontSize: 11, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "field", field: "signatoryTitle" } },
    { id: "footer", type: "text", x: 0, y: 650, width: 1000, rotation: 0, fontSize: 10, fontFamily: "Georgia", bold: false, italic: false, color: "#9CA3AF", align: "center",
      content: { kind: "literal", text: "POWERED BY AAICBI.ORG" } },
  ],
};

const MODERN_MINIMAL: CertificateLayout = {
  width: 1000,
  height: 700,
  backgroundColor: "#FFFFFF",
  elements: [
    { id: "accentBar", type: "shape", shapeType: "rect", x: 0, y: 0, width: 14, height: 700, rotation: 0, fill: TEAL },
    { id: "org", type: "text", x: 90, y: 70, width: 500, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: true, italic: false, color: TEAL, align: "left",
      content: { kind: "field", field: "organizationName" } },
    { id: "heading", type: "text", x: 90, y: 100, width: 700, rotation: 0, fontSize: 30, fontFamily: "Helvetica", bold: true, italic: false, color: INK, align: "left",
      content: { kind: "literal", text: "Certificate of Completion" } },
    { id: "intro", type: "text", x: 90, y: 200, width: 700, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "literal", text: "This is to certify that" } },
    { id: "trainee", type: "text", x: 90, y: 230, width: 700, rotation: 0, fontSize: 32, fontFamily: "Helvetica", bold: true, italic: false, color: TEAL, align: "left",
      content: { kind: "field", field: "traineeName" } },
    { id: "verb", type: "text", x: 90, y: 290, width: 700, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "verb" } },
    { id: "course", type: "text", x: 90, y: 318, width: 700, rotation: 0, fontSize: 19, fontFamily: "Helvetica", bold: true, italic: false, color: INK, align: "left",
      content: { kind: "field", field: "credentialTitle" } },
    { id: "icon", type: "icon", x: 870, y: 70, size: 48, rotation: 0, color: GOLD, source: { kind: "builtin", name: "Award" } },
    { id: "issuedAt", type: "text", x: 90, y: 560, width: 300, rotation: 0, fontSize: 12, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "issuedAt" } },
    { id: "code", type: "text", x: 90, y: 582, width: 300, rotation: 0, fontSize: 12, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "certificateCode" } },
    { id: "signatory", type: "text", x: 650, y: 560, width: 260, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: true, italic: false, color: INK, align: "right",
      content: { kind: "field", field: "signatoryName" } },
    { id: "signatoryTitle", type: "text", x: 650, y: 580, width: 260, rotation: 0, fontSize: 11, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "right",
      content: { kind: "field", field: "signatoryTitle" } },
    { id: "qr", type: "image", x: 870, y: 540, width: 80, height: 80, rotation: 0, source: "qr" },
  ],
};

const GOLD_ELEGANT: CertificateLayout = {
  width: 1000,
  height: 700,
  backgroundColor: "#FFFDF6",
  elements: [
    { id: "outerBorder", type: "shape", shapeType: "rect", x: 20, y: 20, width: 960, height: 660, rotation: 0, stroke: GOLD, strokeWidth: 6 },
    { id: "innerBorder", type: "shape", shapeType: "rect", x: 34, y: 34, width: 932, height: 632, rotation: 0, stroke: GOLD, strokeWidth: 1 },
    { id: "icon", type: "icon", x: 470, y: 60, size: 40, rotation: 0, color: GOLD, source: { kind: "builtin", name: "Crown" } },
    { id: "heading", type: "text", x: 0, y: 120, width: 1000, rotation: 0, fontSize: 26, fontFamily: "Georgia", bold: true, italic: false, color: INK, align: "center",
      content: { kind: "literal", text: "Certificate of Excellence" } },
    { id: "org", type: "text", x: 0, y: 160, width: 1000, rotation: 0, fontSize: 13, fontFamily: "Georgia", bold: false, italic: false, color: GOLD, align: "center",
      content: { kind: "field", field: "organizationName" } },
    { id: "intro", type: "text", x: 0, y: 220, width: 1000, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "literal", text: "Presented to" } },
    { id: "trainee", type: "text", x: 0, y: 254, width: 1000, rotation: 0, fontSize: 40, fontFamily: "Georgia", bold: false, italic: true, color: INK, align: "center",
      content: { kind: "field", field: "traineeName" } },
    { id: "verb", type: "text", x: 0, y: 330, width: 1000, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "field", field: "verb" } },
    { id: "course", type: "text", x: 0, y: 358, width: 1000, rotation: 0, fontSize: 22, fontFamily: "Georgia", bold: true, italic: false, color: INK, align: "center",
      content: { kind: "field", field: "credentialTitle" } },
    { id: "issuedAt", type: "text", x: 120, y: 540, width: 300, rotation: 0, fontSize: 13, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "issuedAt" } },
    { id: "code", type: "text", x: 120, y: 562, width: 300, rotation: 0, fontSize: 13, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "certificateCode" } },
    { id: "signatory", type: "text", x: 580, y: 540, width: 300, rotation: 0, fontSize: 14, fontFamily: "Georgia", bold: true, italic: false, color: INK, align: "right",
      content: { kind: "field", field: "signatoryName" } },
    { id: "signatoryTitle", type: "text", x: 580, y: 562, width: 300, rotation: 0, fontSize: 11, fontFamily: "Georgia", bold: false, italic: false, color: GRAY, align: "right",
      content: { kind: "field", field: "signatoryTitle" } },
    { id: "qr", type: "image", x: 455, y: 560, width: 90, height: 90, rotation: 0, source: "qr" },
  ],
};

const BOLD_TEAL: CertificateLayout = {
  width: 1000,
  height: 700,
  backgroundColor: "#FFFFFF",
  elements: [
    { id: "headerBand", type: "shape", shapeType: "rect", x: 0, y: 0, width: 1000, height: 170, rotation: 0, fill: TEAL },
    { id: "icon", type: "icon", x: 60, y: 50, size: 56, rotation: 0, color: "#FFFFFF", source: { kind: "builtin", name: "Trophy" } },
    { id: "heading", type: "text", x: 150, y: 55, width: 700, rotation: 0, fontSize: 28, fontFamily: "Helvetica", bold: true, italic: false, color: "#FFFFFF", align: "left",
      content: { kind: "literal", text: "Certificate of Achievement" } },
    { id: "org", type: "text", x: 150, y: 100, width: 700, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: false, italic: false, color: "#D1FAE5", align: "left",
      content: { kind: "field", field: "organizationName" } },
    { id: "intro", type: "text", x: 0, y: 220, width: 1000, rotation: 0, fontSize: 14, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "literal", text: "This certifies that" } },
    { id: "trainee", type: "text", x: 0, y: 252, width: 1000, rotation: 0, fontSize: 36, fontFamily: "Helvetica", bold: true, italic: false, color: INK, align: "center",
      content: { kind: "field", field: "traineeName" } },
    { id: "verb", type: "text", x: 0, y: 320, width: 1000, rotation: 0, fontSize: 14, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "center",
      content: { kind: "field", field: "verb" } },
    { id: "course", type: "text", x: 0, y: 348, width: 1000, rotation: 0, fontSize: 22, fontFamily: "Helvetica", bold: true, italic: false, color: TEAL, align: "center",
      content: { kind: "field", field: "credentialTitle" } },
    { id: "issuedAt", type: "text", x: 120, y: 540, width: 300, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "issuedAt" } },
    { id: "code", type: "text", x: 120, y: 562, width: 300, rotation: 0, fontSize: 13, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "left",
      content: { kind: "field", field: "certificateCode" } },
    { id: "signatory", type: "text", x: 580, y: 540, width: 300, rotation: 0, fontSize: 14, fontFamily: "Helvetica", bold: true, italic: false, color: INK, align: "right",
      content: { kind: "field", field: "signatoryName" } },
    { id: "signatoryTitle", type: "text", x: 580, y: 562, width: 300, rotation: 0, fontSize: 11, fontFamily: "Helvetica", bold: false, italic: false, color: GRAY, align: "right",
      content: { kind: "field", field: "signatoryTitle" } },
    { id: "qr", type: "image", x: 455, y: 560, width: 90, height: 90, rotation: 0, source: "qr" },
  ],
};

export interface CertificatePreset {
  id: string;
  name: string;
  layout: CertificateLayout;
}

export const CERTIFICATE_PRESETS: CertificatePreset[] = [
  { id: "aaicbi-classic", name: "AAICBI Classic", layout: AAICBI_CLASSIC },
  { id: "modern-minimal", name: "Modern Minimal", layout: MODERN_MINIMAL },
  { id: "gold-elegant", name: "Gold Elegant", layout: GOLD_ELEGANT },
  { id: "bold-teal", name: "Bold & Teal", layout: BOLD_TEAL },
];

export const AAICBI_CLASSIC_PRESET = CERTIFICATE_PRESETS[0];
