/**
 * Visual Certificate Design Editor — the layout data model a
 * CertificateTemplate.layoutJson column holds, built by the Fabric.js-
 * based drag-and-drop editor (src/components/certificateEditor/) and
 * consumed by the read-only CertificateLayoutRenderer. Every value is
 * a bounded number, a short string, or one of a fixed set of enum
 * values — there is no markup anywhere in this shape, so unlike the
 * HTML-import approach this replaces, there is nothing to sanitize:
 * CertificateLayoutSchema's own Zod validation IS the safety boundary.
 * Deliberately canvas-library-agnostic — the editor is just one
 * producer/consumer of this shape; the read-only renderer never
 * touches Fabric (or any canvas library) at all.
 */
import { z } from "zod";

// The built-in icon bank — see src/lib/certificateIcons.ts for the
// actual lucide-react component each name maps to. Listed here (not
// derived from that file) so this schema has zero dependency on React/
// lucide-react, keeping it safely importable from a plain Node script
// or a test file with no JSX involved.
export const BUILTIN_ICON_NAMES = [
  "GraduationCap", "Trophy", "Star", "Award", "BookOpen", "Medal",
  "ShieldCheck", "Stamp", "Sparkles", "Crown", "Target", "Flag",
  "ThumbsUp", "Gem", "ScrollText", "PenTool", "BadgeCheck", "CheckCircle2",
] as const;
export type BuiltinIconName = (typeof BUILTIN_ICON_NAMES)[number];

export const DYNAMIC_FIELDS = [
  "traineeName", "verb", "credentialTitle", "issuedAt", "certificateCode",
  "organizationName", "signatoryName", "signatoryTitle",
] as const;
export type DynamicField = (typeof DYNAMIC_FIELDS)[number];

export const DYNAMIC_FIELD_LABELS: Record<DynamicField, string> = {
  traineeName: "Trainee Name",
  verb: "Verb (\"has completed\"/\"has passed\")",
  credentialTitle: "Course/Exam Title",
  issuedAt: "Issue Date",
  certificateCode: "Certificate Code",
  organizationName: "Organization Name",
  signatoryName: "Signatory Name",
  signatoryTitle: "Signatory Title",
};

const BaseElementSchema = z.object({
  id: z.string().min(1).max(40),
  x: z.number().min(-2000).max(4000),
  y: z.number().min(-2000).max(4000),
  rotation: z.number().min(-360).max(360),
});

export const TextElementSchema = BaseElementSchema.extend({
  type: z.literal("text"),
  width: z.number().min(1).max(4000),
  fontSize: z.number().min(6).max(200),
  fontFamily: z.string().min(1).max(60),
  bold: z.boolean(),
  italic: z.boolean(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  align: z.enum(["left", "center", "right"]),
  content: z.union([
    z.object({ kind: z.literal("literal"), text: z.string().max(200) }),
    z.object({ kind: z.literal("field"), field: z.enum(DYNAMIC_FIELDS) }),
  ]),
});

export const ImageElementSchema = BaseElementSchema.extend({
  type: z.literal("image"),
  width: z.number().min(1).max(4000),
  height: z.number().min(1).max(4000),
  source: z.enum(["logo", "qr"]),
});

export const ShapeElementSchema = BaseElementSchema.extend({
  type: z.literal("shape"),
  shapeType: z.enum(["rect", "line"]),
  width: z.number().min(0).max(4000),
  height: z.number().min(0).max(4000),
  fill: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  stroke: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  strokeWidth: z.number().min(0).max(40).optional(),
  cornerRadius: z.number().min(0).max(200).optional(),
});

export const IconElementSchema = BaseElementSchema.extend({
  type: z.literal("icon"),
  size: z.number().min(8).max(500),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // An uploaded icon's url is snapshotted here at placement time, not
  // a live lookup against CertificateIcon at render time — a
  // certificate that already used an icon keeps rendering correctly
  // even if that icon is later removed from the shared bank.
  source: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("builtin"), name: z.enum(BUILTIN_ICON_NAMES) }),
    z.object({ kind: z.literal("uploaded"), url: z.string().url() }),
  ]),
});

export const CertificateElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
  IconElementSchema,
]);

/** Only images this app stored itself may sit behind a certificate (a public page), never an arbitrary web address. */
function isOwnUploadUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com");
  } catch {
    return false;
  }
}

export const CertificateLayoutSchema = z.object({
  width: z.number().min(200).max(4000),
  height: z.number().min(200).max(4000),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  // An uploaded certificate design (PNG/JPG/WEBP) drawn edge to edge
  // behind every element. Its url is part of the layout, so it is frozen
  // into each certificate's snapshot like any other design value.
  backgroundImageUrl: z
    .string()
    .url()
    .max(2000)
    .refine(isOwnUploadUrl, "The template image must be one uploaded through the editor.")
    .optional(),
  elements: z.array(CertificateElementSchema).max(200),
});

export type TextElement = z.infer<typeof TextElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type ShapeElement = z.infer<typeof ShapeElementSchema>;
export type IconElement = z.infer<typeof IconElementSchema>;
export type CertificateElement = z.infer<typeof CertificateElementSchema>;
export type CertificateLayout = z.infer<typeof CertificateLayoutSchema>;

export interface CertificateRenderData {
  traineeName: string;
  verb: string;
  credentialTitle: string;
  issuedAt: string;
  certificateCode: string;
  organizationName: string;
  signatoryName: string;
  signatoryTitle: string;
}

/** Pure, no React/Prisma — resolves a text element's field binding
 * against the render-time data bag. Unit-testable on its own. */
export function resolveFieldValue(field: DynamicField, data: CertificateRenderData): string {
  return data[field];
}

export const DEFAULT_LAYOUT_WIDTH = 1000;
export const DEFAULT_LAYOUT_HEIGHT = 700;

/**
 * Page-size picker options for the editor — width/height stay the
 * single source of truth for both size AND orientation (implied by
 * which dimension is larger), so this is purely a UI convenience list,
 * not a schema field. Px values at a 100px-per-inch design scale (A4:
 * 8.27in x 11.69in -> 827x1169, rounded; Letter: 8.5in x 11in ->
 * 850x1100) — not print-exact DPI, but this schema already isn't
 * pixel-locked to a physical size (the renderer scales the whole
 * canvas to fit its container), so round numbers are easier to reason
 * about than 96dpi fractions.
 */
export const PAGE_SIZE_PRESETS: { id: string; label: string; width: number; height: number }[] = [
  { id: "a4-landscape", label: "A4 Landscape", width: 1169, height: 827 },
  { id: "a4-portrait", label: "A4 Portrait", width: 827, height: 1169 },
  { id: "letter-landscape", label: "Letter Landscape", width: 1100, height: 850 },
  { id: "letter-portrait", label: "Letter Portrait", width: 850, height: 1100 },
];

/** Page size for an uploaded design: keeps the image's shape on an A4-sized long edge, never outside the schema's limits. */
export function pageSizeForImage(imageWidth: number, imageHeight: number): { width: number; height: number } {
  if (!(imageWidth > 0) || !(imageHeight > 0)) return { width: DEFAULT_LAYOUT_WIDTH, height: DEFAULT_LAYOUT_HEIGHT };
  const LONG = 1169;
  const scale = LONG / Math.max(imageWidth, imageHeight);
  const clamp = (n: number) => Math.min(4000, Math.max(200, Math.round(n)));
  return { width: clamp(imageWidth * scale), height: clamp(imageHeight * scale) };
}
