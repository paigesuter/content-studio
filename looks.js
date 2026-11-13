// Ready-made looks: same clip, different video. Each look = caption style + hook style + zoom + pacing.
// Colours come from the chosen palette, so every look can be tried in every palette.

export const PALETTES = [
  { id: "pink", name: "Pink pop", accent: "#FF4D8D", accent2: "#FFD23F", ink: "#1A1A1A", light: "#FFFFFF" },
  { id: "neutral", name: "Warm neutral", accent: "#E9C9A1", accent2: "#C57B5C", ink: "#2B2420", light: "#FFF8EE" },
  { id: "sage", name: "Sage", accent: "#B7D3A8", accent2: "#F3E3C3", ink: "#1F2A22", light: "#FBFAF5" },
  { id: "lilac", name: "Lilac", accent: "#CDB9FF", accent2: "#FFB5D8", ink: "#22192E", light: "#FFFFFF" },
  { id: "mono", name: "Black & white", accent: "#FFE600", accent2: "#FFFFFF", ink: "#000000", light: "#FFFFFF" },
];

export const LOOKS = [
  {
    id: "bold", name: "Bold yap",
    blurb: "Big punchy captions, word-by-word highlight, lots of zooms",
    captions: { font: "Montserrat", weight: 900, size: 84, words: 3, upper: true, y: 0.66,
      color: "light", highlight: "accent2", stroke: "ink", strokeW: 12, style: "highlight", pop: true, punct: false },
    hook: { style: "bold", y: 0.16 },
    zoom: { frequency: "high", strength: 1.18 },
    pacing: { pause: 0.4, padding: 0.08 },
  },
  {
    id: "box", name: "Highlight box",
    blurb: "Spoken word sits on a coloured box, CapCut-style",
    captions: { font: "Montserrat", weight: 800, size: 76, words: 3, upper: true, y: 0.62,
      color: "light", highlight: "ink", box: "accent", stroke: "ink", strokeW: 8, style: "box", pop: true, punct: false },
    hook: { style: "label", y: 0.15 },
    zoom: { frequency: "medium", strength: 1.15 },
    pacing: { pause: 0.45, padding: 0.1 },
  },
  {
    id: "serif", name: "Soft serif",
    blurb: "Elegant serif hook + gentle lowercase captions",
    captions: { font: "DM Sans", weight: 700, size: 54, words: 5, upper: false, y: 0.74,
      color: "light", highlight: "accent", stroke: null, strokeW: 0, style: "highlight", shadow: true, pop: false, punct: true },
    hook: { style: "serif", y: 0.15 },
    zoom: { frequency: "low", strength: 1.08 },
    pacing: { pause: 0.6, padding: 0.14 },
  },
  {
    id: "busymum", name: "Storytime text",
    blurb: "Big serif hook up top, small typewriter subtitles (like your inspo)",
    captions: { font: "Space Mono", weight: 400, size: 40, words: 6, upper: false, y: 0.8,
      color: "light", highlight: "light", stroke: null, strokeW: 0, style: "plain", shadow: true, pop: false, punct: true },
    hook: { style: "story", y: 0.2 },
    zoom: { frequency: "off", strength: 1 },
    pacing: { pause: 0.7, padding: 0.16 },
  },
  {
    id: "clean", name: "Clean minimal",
    blurb: "Small, quiet captions. Lets you and the vibe do the talking",
    captions: { font: "Inter", weight: 600, size: 48, words: 4, upper: false, y: 0.84,
      color: "light", highlight: "light", stroke: null, strokeW: 0, style: "plain", shadow: true, pop: false, punct: false },
    hook: { style: "minimal", y: 0.12 },
    zoom: { frequency: "low", strength: 1.06 },
    pacing: { pause: 0.55, padding: 0.12 },
  },
];

export const FONT_LOADS = [
  "900 40px Montserrat", "800 40px Montserrat", "700 40px 'DM Sans'", "400 40px 'Space Mono'",
  "600 40px Inter", "800 40px Inter", "400 40px 'DM Serif Display'", "italic 400 40px 'Playfair Display'",
];
