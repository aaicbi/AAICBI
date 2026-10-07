/**
 * The design tokens, as data, so the design-system page can show them and
 * a test can hold them to account. These mirror the CSS variables in
 * src/app/globals.css exactly: tests/designTokens.test.ts parses that
 * file and fails if the two drift apart, and also checks that every
 * text-on-background pair the app relies on meets WCAG AA contrast in
 * both themes. Change a color in globals.css, then update it here.
 * Values are RGB triples.
 */
export type Rgb = [number, number, number];
export type TokenMap = Record<string, Rgb>;

export const LIGHT_TOKENS: TokenMap = {
  "brand-teal": [1, 107, 97],
  "brand-teal-deep": [1, 74, 67],
  "brand-green": [133, 199, 154],
  "brand-mint": [228, 238, 231],
  "brand-gray": [217, 217, 217],
  "brand-ink": [22, 48, 43],
  "brand-sand": [247, 245, 240],
  "brand-surface": [255, 255, 255],
  "brand-gold": [217, 154, 52],
  "brand-gold-light": [246, 232, 204],
  "brand-gold-text": [138, 95, 31],
  "brand-rose": [178, 58, 72],
  "brand-rose-light": [245, 226, 225],
  "brand-on-accent": [255, 255, 255],
  "brand-on-gold": [22, 48, 43],
  "gray-50": [249, 250, 251],
  "gray-100": [243, 244, 246],
  "gray-300": [209, 213, 219],
  "gray-400": [96, 104, 116],
  "gray-500": [84, 92, 106],
  "gray-600": [70, 80, 95],
  "gray-700": [55, 65, 81],
  "gray-800": [31, 41, 55],
  "gray-900": [17, 24, 39],
};

export const DARK_TOKENS: TokenMap = {
  "brand-teal": [79, 187, 168],
  "brand-teal-deep": [110, 212, 192],
  "brand-green": [154, 212, 172],
  "brand-mint": [27, 56, 51],
  "brand-gray": [51, 57, 60],
  "brand-ink": [232, 240, 237],
  "brand-sand": [20, 24, 26],
  "brand-surface": [28, 33, 36],
  "brand-gold": [227, 172, 85],
  "brand-gold-light": [61, 46, 20],
  "brand-gold-text": [230, 195, 140],
  "brand-rose": [228, 110, 124],
  "brand-rose-light": [61, 26, 30],
  "brand-on-accent": [20, 24, 26],
  "brand-on-gold": [20, 24, 26],
  "gray-50": [24, 28, 30],
  "gray-100": [34, 39, 42],
  "gray-300": [70, 77, 81],
  "gray-400": [148, 155, 159],
  "gray-500": [160, 167, 171],
  "gray-600": [172, 178, 182],
  "gray-700": [194, 199, 202],
  "gray-800": [222, 226, 228],
  "gray-900": [237, 240, 241],
};

/** Text-on-background pairs the app depends on, each of which must meet 4.5:1. */
export const TEXT_PAIRS: Array<{ text: string; background: string; use: string }> = [
  { text: "brand-ink", background: "brand-sand", use: "Body text on the page" },
  { text: "brand-ink", background: "brand-surface", use: "Body text on cards" },
  { text: "gray-600", background: "brand-surface", use: "Secondary text on cards" },
  { text: "gray-600", background: "brand-sand", use: "Secondary text on the page" },
  { text: "gray-500", background: "brand-surface", use: "Muted text and placeholders on cards" },
  { text: "gray-500", background: "brand-sand", use: "Muted text and placeholders on the page" },
  { text: "gray-400", background: "brand-surface", use: "Captions on cards" },
  { text: "gray-400", background: "brand-sand", use: "Captions on the page" },
  { text: "brand-teal", background: "brand-surface", use: "Links and accents on cards" },
  { text: "brand-teal", background: "brand-sand", use: "Links and accents on the page" },
  { text: "brand-teal", background: "brand-mint", use: "Selected items and chips" },
  { text: "brand-on-accent", background: "brand-teal", use: "Primary buttons" },
  { text: "brand-on-accent", background: "brand-rose", use: "Danger buttons" },
  { text: "brand-on-gold", background: "brand-gold", use: "Gold badges" },
  { text: "brand-rose", background: "brand-surface", use: "Error text on cards" },
  { text: "brand-rose", background: "brand-rose-light", use: "Error banners" },
  { text: "brand-gold-text", background: "brand-gold-light", use: "Gold callouts" },
  { text: "brand-gold-text", background: "brand-surface", use: "Gold text on cards" },
];
