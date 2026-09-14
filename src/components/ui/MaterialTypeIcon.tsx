import { FileText, FileEdit, Presentation, Video } from "lucide-react";
import Icon from "./Icon";

/**
 * Replaces the byte-identical {PDF: "📄", DOCX: "📝", PPTX: "📊", VIDEO:
 * "🎬"} map that was independently duplicated in 3 files (trainee
 * courses/[id], trainee downloads, admin courses/[id] builder).
 */
export type MaterialIconType = "PDF" | "DOCX" | "PPTX" | "VIDEO";

const MATERIAL_ICON_MAP: Record<MaterialIconType, typeof FileText> = {
  PDF: FileText,
  DOCX: FileEdit,
  PPTX: Presentation,
  VIDEO: Video,
};

export default function MaterialTypeIcon({ type, size = "sm" }: { type: MaterialIconType; size?: "sm" | "md" | "lg" | "xl" }) {
  return <Icon icon={MATERIAL_ICON_MAP[type]} size={size} className="inline-block align-text-bottom" />;
}
