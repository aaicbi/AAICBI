/**
 * Visual Certificate Design Editor — the layout data model a
 * CertificateTemplate.layoutJson column holds, built by the Konva-
 * based drag-and-drop editor (src/components/certificateEditor/) and
 * consumed by the read-only CertificateLayoutRenderer. Every value is
 * a bounded number, a short string, or one of a fixed set of enum
 * values — there is no markup anywhere in this shape, so unlike the
 * HTML-import approach this replaces, there is nothing to sanitize:
 * CertificateLayoutSchema's own Zod validation IS the safety boundary.
 */
import { z } from "zod";

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

export const CertificateElementSchema = z.discriminatedUnion("type", [
  TextElementSchema,
  ImageElementSchema,
  ShapeElementSchema,
]);

export const CertificateLayoutSchema = z.object({
  width: z.number().min(200).max(4000),
  height: z.number().min(200).max(4000),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  elements: z.array(CertificateElementSchema).max(200),
});

export type TextElement = z.infer<typeof TextElementSchema>;
export type ImageElement = z.infer<typeof ImageElementSchema>;
export type ShapeElement = z.infer<typeof ShapeElementSchema>;
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
