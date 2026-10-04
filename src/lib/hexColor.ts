/**
 * Training Organizations, Phase 1 — the certificate card re-pins its
 * brand-teal/brand-gold CSS custom properties to fixed light-mode
 * values via an inline `style` object (see the certificate page's own
 * comment: it must look identical regardless of the viewer's site
 * theme). Those custom properties are stored as space-separated "R G B"
 * triples for use with `rgb(var(--x) / <alpha>)`, not hex strings — a
 * branded template's hex color needs converting to that same shape to
 * slot into the same mechanism. Pure, no DOM/network — same
 * testability discipline as every other small validator in this app.
 */
export function hexToRgbTriple(hex: string): string {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return "1 107 97"; // falls back to AAICBI's own brand-teal if given something malformed
  const n = parseInt(match[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `${r} ${g} ${b}`;
}
