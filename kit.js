// Brand Kit: colour palettes + font pairings. All fonts are free Google Fonts,
// so they work for real video rendering (drawn onto the video frames), not just on screen.

// Roles: text = default overlay text (classic white), pink, butter = brand accents,
// soft = light neutral, deep = dark neutral used for outlines/shadows (instead of black).
export const PALETTES = [
  { id: "signature", name: "Signature Pink & Butter", note: "Your core look: baby pink + butter yellow on clean white.",
    colors: { text: "#FFFFFF", pink: "#F5C4D3", butter: "#F8E3A3", soft: "#FBF3EE", deep: "#5B4440" } },
  { id: "sorbet", name: "Soft Sorbet", note: "Sweeter and lighter. Great for Little Life and getting-ready content.",
    colors: { text: "#FFFFFF", pink: "#F9D2DE", butter: "#FFF0B8", soft: "#FDF7F2", deep: "#6E5148" } },
  { id: "coast", name: "Sunlit Coast", note: "For Bali, beach days and travel. Butter leads, pink supports, a soft sea accent.",
    colors: { text: "#FFFFFF", pink: "#F2BACA", butter: "#F6D98A", soft: "#F5EDE2", deep: "#5E5048", sea: "#A8CFCF" } },
  { id: "sage", name: "Pink & Sage", note: "From your moodboard reference: blush pink with soft sage. An option to try, not a change.",
    colors: { text: "#FFFFFF", pink: "#F6C9D2", butter: "#FFEDE9", soft: "#F7F3EE", deep: "#4F6B55", sage: "#BBD3BF", sagedeep: "#698A6F" } },
  { id: "studio", name: "Pilates Pink", note: "Your Pilates series: a slightly deeper pink with butter highlights.",
    colors: { text: "#FFFFFF", pink: "#EFA3BC", butter: "#FBE6A2", soft: "#FCEAF0", deep: "#5A3646" } },
];

// Each pairing: primary (captions/body), title (hooks/editorial moments), accent (handwritten, use sparingly).
export const PAIRINGS = [
  { id: "editorial", name: "Editorial Classic", vibe: "Magazine-clean with a romantic serif.",
    primary: { family: "DM Sans", weight: 600 }, title: { family: "Playfair Display", weight: 500, italic: true }, accent: { family: "Pinyon Script", weight: 400 } },
  { id: "softmodern", name: "Soft Modern", vibe: "Friendly, modern and very readable.",
    primary: { family: "Manrope", weight: 700 }, title: { family: "DM Serif Display", weight: 400 }, accent: { family: "Caveat", weight: 600 } },
  { id: "fashionmag", name: "Fashion Mag", vibe: "High-fashion contrast. Most 'fashion-led'.",
    primary: { family: "Montserrat", weight: 600 }, title: { family: "Bodoni Moda", weight: 500, italic: true }, accent: { family: "La Belle Aurore", weight: 400 } },
  { id: "girlyclean", name: "Girly Clean", vibe: "Soft and pretty without being twee.",
    primary: { family: "Poppins", weight: 500 }, title: { family: "Cormorant Garamond", weight: 600, italic: true }, accent: { family: "Homemade Apple", weight: 400 } },
  { id: "diary", name: "Diary Notes", vibe: "Personal and journal-like, great for TikTok diaries.",
    primary: { family: "Inter", weight: 600 }, title: { family: "Fraunces", weight: 500, italic: true }, accent: { family: "Reenie Beanie", weight: 400 } },
  { id: "minimal", name: "Minimal Chic", vibe: "Light, airy and elegant. Lets the footage lead.",
    primary: { family: "Jost", weight: 500 }, title: { family: "Italiana", weight: 400 }, accent: { family: "Mrs Saint Delafield", weight: 400 } },
];

export const DEFAULT_KIT = { palette: "signature", pairing: "editorial", customFonts: {}, approved: false };

// Google Fonts stylesheet covering every pairing (loaded once by each page).
export function googleFontsHref() {
  const fams = new Map();
  for (const p of PAIRINGS) for (const role of ["primary", "title", "accent"]) {
    const f = p[role];
    const key = f.family;
    if (!fams.has(key)) fams.set(key, new Set());
    fams.get(key).add(`${f.italic ? 1 : 0},${f.weight}`);
  }
  // Editor looks also use these
  const extra = { "Nunito": ["0,400", "0,600", "0,700", "0,800"], "Montserrat": ["0,800", "0,900"], "DM Sans": ["0,700"], "Inter": ["0,800"], "Space Mono": ["0,400"], "DM Serif Display": ["0,400"], "Playfair Display": ["1,400"] };
  for (const [k, v] of Object.entries(extra)) { if (!fams.has(k)) fams.set(k, new Set()); v.forEach((x) => fams.get(k).add(x)); }
  const parts = [...fams.entries()].map(([fam, set]) => {
    const vals = [...set].sort();
    const anyItalic = vals.some((v) => v.startsWith("1"));
    const spec = anyItalic ? `ital,wght@${vals.join(";")}` : `wght@${vals.map((v) => v.split(",")[1]).join(";")}`;
    return `family=${fam.replace(/ /g, "+")}:${spec}`;
  });
  return `https://fonts.googleapis.com/css2?${parts.join("&")}&display=swap`;
}

export function fontCSS(f) {
  return `${f.italic ? "italic " : ""}${f.weight || 400} 1em "${f.family}"`;
}

// The active fonts, with any custom uploaded font overriding a role.
export function activeFonts(kit) {
  const p = PAIRINGS.find((x) => x.id === kit.pairing) || PAIRINGS[0];
  const out = {};
  for (const role of ["primary", "title", "accent"]) {
    const custom = kit.customFonts?.[role];
    out[role] = custom ? { family: custom, weight: 400, custom: true } : p[role];
  }
  return out;
}

export const activePalette = (kit) => PALETTES.find((x) => x.id === kit.palette) || PALETTES[0];

export async function loadFontsFor(fonts) {
  await Promise.all(Object.values(fonts).map((f) =>
    document.fonts.load(`${f.italic ? "italic " : ""}${f.weight || 400} 40px "${f.family}"`).catch(() => {})));
}
