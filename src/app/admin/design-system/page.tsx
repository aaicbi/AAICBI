import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { findTrainingOrgByStaffUserId } from "@/lib/trainingOrgStaff";
import { DARK_TOKENS, LIGHT_TOKENS, TEXT_PAIRS, type Rgb } from "@/lib/designTokens";
import { contrastRatio } from "@/lib/contrast";
import * as BrandIcons from "@/components/icons/brand";
import Icon from "@/components/ui/Icon";
import DesignSystemDemos from "@/components/admin/DesignSystemDemos";

export const metadata = { title: "Design System" };

const hex = ([r, g, b]: Rgb) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

const GROUPS: Array<{ title: string; tokens: string[] }> = [
  { title: "Brand", tokens: ["brand-teal", "brand-teal-deep", "brand-green", "brand-mint", "brand-gold", "brand-gold-light", "brand-gold-text", "brand-rose", "brand-rose-light"] },
  { title: "Surfaces", tokens: ["brand-sand", "brand-surface", "brand-gray", "brand-ink"] },
  { title: "Text on a fill", tokens: ["brand-on-accent", "brand-on-gold"] },
  { title: "Neutral scale", tokens: ["gray-50", "gray-100", "gray-300", "gray-400", "gray-500", "gray-600", "gray-700", "gray-800", "gray-900"] },
];

const TYPE_SCALE: Array<{ name: string; classes: string; sample: string; use: string }> = [
  { name: "Display XL", classes: "font-display text-4xl font-semibold sm:text-5xl", sample: "Learn. Get certified.", use: "Landing hero only" },
  { name: "Display L", classes: "font-display text-2xl font-semibold", sample: "Northwind Academy", use: "Page titles" },
  { name: "Display M", classes: "font-display text-lg font-semibold", sample: "Progress by course", use: "Section titles" },
  { name: "Display S", classes: "font-display text-base font-semibold", sample: "Seat usage", use: "Card titles" },
  { name: "Body", classes: "text-sm", sample: "Your trainees, their progress and your plan at a glance.", use: "Default text, forms, tables" },
  { name: "Caption", classes: "text-xs", sample: "Not revoked. Last updated 7 October 2026.", use: "Hints, metadata, badges. The smallest allowed size: 12px" },
  { name: "Label", classes: "text-xs font-semibold uppercase tracking-wide", sample: "Active trainees", use: "Table headings, tile labels" },
  { name: "Figure", classes: "font-display text-3xl font-semibold tabular-nums", sample: "1,284", use: "Headline numbers; tabular so columns align" },
];

export default async function DesignSystemPage() {
  const session = await getSession();
  if (!session || !["SUPER_ADMIN", "ADMIN"].includes(session.role)) redirect("/admin/dashboard");
  // Organizations run on this platform but do not manage it.
  if (session.role === "ADMIN" && (await findTrainingOrgByStaffUserId(session.userId))) redirect("/admin/dashboard");

  const icons = Object.entries(BrandIcons).filter(([name]) => name.endsWith("Icon"));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-2xl font-semibold text-brand-ink">Design System</h1>
      <p className="mt-1 max-w-prose text-sm text-gray-600">
        The colours, type, icons and components the platform is built from. Components on this page are the real ones,
        and the colour figures are computed from the same tokens the app uses.
      </p>

      <nav aria-label="On this page" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
        {["colour", "contrast", "type", "shape", "icons", "motion", "components"].map((id) => (
          <a key={id} href={`#${id}`} className="text-brand-teal hover:underline">
            {id[0].toUpperCase() + id.slice(1)}
          </a>
        ))}
      </nav>

      <section id="colour" className="mt-10" aria-labelledby="h-colour">
        <h2 id="h-colour" className="font-display text-lg font-semibold text-brand-ink">Colour</h2>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          Every colour is a CSS variable, so one definition serves both themes. Never write a hex value in a component.
          Dark is the default theme.
        </p>
        {GROUPS.map((g) => (
          <div key={g.title} className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{g.title}</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {g.tokens.map((t) => (
                <li key={t} className="flex items-center gap-3 rounded-lg border border-brand-gray bg-brand-surface p-2.5">
                  <span className="flex shrink-0 overflow-hidden rounded-md border border-brand-gray" aria-hidden="true">
                    <span className="h-9 w-9" style={{ background: hex(LIGHT_TOKENS[t]) }} />
                    <span className="h-9 w-9" style={{ background: hex(DARK_TOKENS[t]) }} />
                  </span>
                  <span className="min-w-0 text-xs">
                    <span className="block truncate font-semibold text-brand-ink">{t}</span>
                    <span className="block font-mono text-gray-600">
                      {hex(LIGHT_TOKENS[t])} · {hex(DARK_TOKENS[t])}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-3 text-xs text-gray-600">In each swatch the left half is the light theme and the right half is the dark theme.</p>
      </section>

      <section id="contrast" className="mt-10" aria-labelledby="h-contrast">
        <h2 id="h-contrast" className="font-display text-lg font-semibold text-brand-ink">Contrast</h2>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          The text and background pairs the app relies on. Each must reach 4.5:1 (WCAG AA) in both themes, and a test
          fails the build if one does not.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-brand-gray bg-brand-surface">
          <table className="w-full min-w-[640px] text-left text-sm tabular-nums">
            <caption className="sr-only">Contrast ratio of each text and background pair in the light and dark themes</caption>
            <thead>
              <tr className="border-b border-brand-gray text-xs uppercase tracking-wide text-gray-600">
                <th scope="col" className="px-4 py-3 font-semibold">Pair</th>
                <th scope="col" className="px-4 py-3 font-semibold">Used for</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Light</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">Dark</th>
              </tr>
            </thead>
            <tbody>
              {TEXT_PAIRS.map((p) => {
                const l = contrastRatio(LIGHT_TOKENS[p.text], LIGHT_TOKENS[p.background]);
                const d = contrastRatio(DARK_TOKENS[p.text], DARK_TOKENS[p.background]);
                return (
                  <tr key={`${p.text}-${p.background}`} className="border-b border-brand-gray last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">{p.text} on {p.background}</td>
                    <td className="px-4 py-2.5 text-gray-600">{p.use}</td>
                    <td className="px-4 py-2.5 text-right">{l.toFixed(2)}:1</td>
                    <td className="px-4 py-2.5 text-right">{d.toFixed(2)}:1</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="type" className="mt-10" aria-labelledby="h-type">
        <h2 id="h-type" className="font-display text-lg font-semibold text-brand-ink">Type</h2>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          Fraunces for titles and figures, Manrope for everything else. Nothing smaller than 12px.
        </p>
        <ul className="mt-4 divide-y divide-brand-gray rounded-xl border border-brand-gray bg-brand-surface">
          {TYPE_SCALE.map((t) => (
            <li key={t.name} className="grid gap-1 px-4 py-3 sm:grid-cols-[9rem_1fr] sm:items-baseline sm:gap-4">
              <div className="text-xs">
                <p className="font-semibold text-brand-ink">{t.name}</p>
                <p className="text-gray-600">{t.use}</p>
              </div>
              <p className={`${t.classes} text-brand-ink`}>{t.sample}</p>
            </li>
          ))}
        </ul>
      </section>

      <section id="shape" className="mt-10" aria-labelledby="h-shape">
        <h2 id="h-shape" className="font-display text-lg font-semibold text-brand-ink">Shape and depth</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            ["rounded-lg", "Controls: buttons, fields, chips in a row. The default radius."],
            ["rounded-xl / 2xl", "Containers: cards, tables and dialogs."],
            ["rounded-full", "Pills, badges, avatars and the round action button."],
          ].map(([name, use]) => (
            <li key={name} className="rounded-xl border border-brand-gray bg-brand-surface p-4 text-sm">
              <p className="font-mono text-xs font-semibold text-brand-ink">{name}</p>
              <p className="mt-1 text-gray-600">{use}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 max-w-prose text-sm text-gray-600">
          Depth is by border first. Shadow is reserved for things that float above the page: <code className="font-mono text-xs">shadow-lg</code> for popovers and toasts,{" "}
          <code className="font-mono text-xs">shadow-xl</code> for dialogs. Spacing follows Tailwind&apos;s scale; page gutters are 16px on phones and 24px above.
        </p>
      </section>

      <section id="icons" className="mt-10" aria-labelledby="h-icons">
        <h2 id="h-icons" className="font-display text-lg font-semibold text-brand-ink">Icons</h2>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          AAICBI&apos;s own set, drawn on a 24px grid with a 2px round stroke so it sits beside Lucide icons without a
          visible seam. Use these for the platform&apos;s own concepts and Lucide for generic actions. Always render
          through the Icon component; give it a label only when the icon is the only thing naming the control.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
          {icons.map(([name, Component]) => (
            <li key={name} className="flex flex-col items-center gap-2 rounded-lg border border-brand-gray bg-brand-surface p-3 text-brand-teal">
              <Icon icon={Component as React.ComponentType<React.SVGProps<SVGSVGElement>>} size="xl" />
              <span className="text-xs text-gray-600">{name.replace(/Icon$/, "")}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="motion" className="mt-10" aria-labelledby="h-motion">
        <h2 id="h-motion" className="font-display text-lg font-semibold text-brand-ink">Motion</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
          <li>Pages fade in over 200ms when you move between screens (opacity only, never a transform).</li>
          <li>Dialogs and popovers rise in over 150ms; toasts over 200ms.</li>
          <li>Nothing animates to decorate. A pulse is reserved for something newly actionable.</li>
          <li>People who ask their system for reduced motion get no animation at all, through one global rule.</li>
        </ul>
      </section>

      <section id="components" className="mt-10" aria-labelledby="h-components">
        <h2 id="h-components" className="font-display text-lg font-semibold text-brand-ink">Components</h2>
        <div className="mt-4">
          <DesignSystemDemos />
        </div>
      </section>
    </main>
  );
}
