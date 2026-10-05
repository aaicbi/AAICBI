/**
 * Visual Certificate Design Editor — the built-in icon bank. Maps
 * BUILTIN_ICON_NAMES (certificateLayout.ts) to real lucide-react
 * components, confirmed-existing exports in the installed version —
 * same plain `import { X } from "lucide-react"` convention used
 * throughout this codebase (BackButton.tsx, NotificationBell.tsx,
 * etc.), lucide-react already a dependency, no new one needed for this
 * part. Education/achievement-themed, 18 icons.
 */
import {
  GraduationCap, Trophy, Star, Award, BookOpen, Medal,
  ShieldCheck, Stamp, Sparkles, Crown, Target, Flag,
  ThumbsUp, Gem, ScrollText, PenTool, BadgeCheck, CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import type { BuiltinIconName } from "@/lib/certificateLayout";

export const BUILTIN_ICON_COMPONENTS: Record<BuiltinIconName, LucideIcon> = {
  GraduationCap, Trophy, Star, Award, BookOpen, Medal,
  ShieldCheck, Stamp, Sparkles, Crown, Target, Flag,
  ThumbsUp, Gem, ScrollText, PenTool, BadgeCheck, CheckCircle2,
};

export const BUILTIN_ICONS: { name: BuiltinIconName; label: string; Icon: LucideIcon }[] = [
  { name: "GraduationCap", label: "Graduation Cap", Icon: GraduationCap },
  { name: "Trophy", label: "Trophy", Icon: Trophy },
  { name: "Star", label: "Star", Icon: Star },
  { name: "Award", label: "Award", Icon: Award },
  { name: "BookOpen", label: "Open Book", Icon: BookOpen },
  { name: "Medal", label: "Medal", Icon: Medal },
  { name: "ShieldCheck", label: "Shield Check", Icon: ShieldCheck },
  { name: "Stamp", label: "Stamp", Icon: Stamp },
  { name: "Sparkles", label: "Sparkles", Icon: Sparkles },
  { name: "Crown", label: "Crown", Icon: Crown },
  { name: "Target", label: "Target", Icon: Target },
  { name: "Flag", label: "Flag", Icon: Flag },
  { name: "ThumbsUp", label: "Thumbs Up", Icon: ThumbsUp },
  { name: "Gem", label: "Gem", Icon: Gem },
  { name: "ScrollText", label: "Scroll", Icon: ScrollText },
  { name: "PenTool", label: "Pen", Icon: PenTool },
  { name: "BadgeCheck", label: "Verified Badge", Icon: BadgeCheck },
  { name: "CheckCircle2", label: "Checkmark", Icon: CheckCircle2 },
];
