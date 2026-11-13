// My Series: each series saves its own template (fonts, colours, text, pacing) so new episodes
// only need the footage. Stored on this device.
import { db, uid } from "./db.js";

export const TEXT_POSITIONS = { top: 0.16, middle: 0.42, bottom: 0.72 };

// Starter series, matched to Paige's real Instagram series.
export const STARTER_SERIES = [
  {
    name: "60 Promises", emoji: "🎀", pillar: "little",
    about: "My 60-class Pilates challenge. Big pink 60 PROMISES with the class number in white script underneath.",
    palette: "studio", fonts: { title: { family: "Gloock", weight: 400 }, sub: { family: "Allura", weight: 400 } },
    title: "60 promises", titleCase: "upper", titleColor: "pink", titleSize: "xl", layout: "stack",
    subtitle: "— {n}/{total} —", subStyle: "script",
    position: "top", showTitle: "whole", captions: false, zoom: "off", pause: 0.7, total: 60, next: 1,
  },
  {
    name: "Island Diaries", emoji: "🌴", pillar: "experiencing",
    about: "My Bali diaries. Staggered editorial serif: italic 'island', regular 'diaries'. Soft and cinematic.",
    palette: "coast", fonts: { title: { family: "Instrument Serif", weight: 400 }, sub: { family: "DM Sans", weight: 500, italic: true } },
    title: "island diaries", titleCase: "lower", titleColor: "white", titleSize: "xl", layout: "stagger",
    subtitle: "day {n} · {place}", subStyle: "small",
    position: "middle", showTitle: "start", captions: true, zoom: "low", pause: 0.6, total: null, next: 1,
  },
  {
    name: "Fashion Finds", emoji: "👗", pillar: "style",
    about: "Outfit and fashion finds. Pink bold italic serif with a small white line underneath.",
    palette: "signature", fonts: { title: { family: "Playfair Display", weight: 800, italic: true }, sub: { family: "Instrument Serif", weight: 400, italic: true } },
    title: "Fashion finds", titleCase: "none", titleColor: "pink", titleSize: "l", layout: "stack",
    subtitle: "outfits for every version of you", subStyle: "small",
    position: "top", showTitle: "start", captions: true, zoom: "medium", pause: 0.5, total: null, next: 1,
  },
  {
    name: "Notes from Becoming Her", emoji: "✨", pillar: "becoming",
    about: "Talking-to-camera reflections. Chunky butter serif title with little stars.",
    palette: "signature", fonts: { title: { family: "Young Serif", weight: 400 }, sub: { family: "DM Sans", weight: 600 } },
    title: "✦ notes from becoming her ✦", titleCase: "none", titleColor: "butter", titleSize: "l", layout: "stack",
    subtitle: "", subStyle: "small",
    position: "top", showTitle: "start", captions: true, zoom: "low", pause: 0.55, total: null, next: 1,
  },
];

const fresh = (s, i) => ({ ...s, id: uid() + i, created: new Date(Date.now() + i).toISOString(), episodes: [], folder: null });

export async function listSeries() {
  let list = await db.getValue("series", null);
  if (!list) {
    list = STARTER_SERIES.map(fresh);
    await db.setValue("series", list);
    await db.setValue("seriesVersion", 2);
    return list;
  }
  // v2: swap the first guessed templates for your real series (only if they were never used)
  if ((await db.getValue("seriesVersion", 1)) < 2) {
    const swap = { "Pilates Challenge": "60 Promises", "Island Diaries": "Island Diaries" };
    list = list.map((s) => {
      const target = swap[s.name] && STARTER_SERIES.find((x) => x.name === swap[s.name]);
      return target && !(s.episodes || []).length ? { ...target, id: s.id, created: s.created, episodes: [], folder: s.folder || null } : s;
    });
    STARTER_SERIES.forEach((st, i) => { if (!list.some((s) => s.name === st.name)) list.push(fresh(st, i)); });
    await db.setValue("series", list);
    await db.setValue("seriesVersion", 2);
  }
  return list;
}

export async function saveSeries(series) {
  const list = await listSeries();
  const i = list.findIndex((s) => s.id === series.id);
  if (i >= 0) list[i] = series; else list.push(series);
  await db.setValue("series", list);
  return series;
}

export async function getSeries(id) {
  return (await listSeries()).find((s) => s.id === id) || null;
}

export async function deleteSeries(id) {
  await db.setValue("series", (await listSeries()).filter((s) => s.id !== id));
}

export function newSeries() {
  return { id: uid(), created: new Date().toISOString(), name: "New series", emoji: "✨", pillar: "style", about: "",
    palette: "signature", fonts: { title: { family: "Playfair Display", weight: 500, italic: true }, sub: { family: "DM Sans", weight: 600 } },
    title: "{name} {n}", titleCase: "none", titleColor: "white", titleSize: "l", layout: "stack", subtitle: "", subStyle: "pill",
    position: "top", showTitle: "start", captions: true, zoom: "low", pause: 0.6, total: null, next: 1, episodes: [], folder: null };
}

// Fills {n} {total} {date} {word} {place} {name}
export function fillTemplate(tpl, s, vals = {}) {
  const d = vals.date ? new Date(vals.date) : new Date();
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }).toLowerCase();
  return (tpl || "")
    .replace(/\{n\}/g, vals.n ?? s.next ?? 1)
    .replace(/\{total\}/g, s.total ?? "")
    .replace(/\{date\}/g, date)
    .replace(/\{word\}/g, vals.word || "")
    .replace(/\{place\}/g, vals.place || "")
    .replace(/\{name\}/g, (s.name || "").toLowerCase())
    .replace(/\s*·\s*$/g, "").replace(/^\s*·\s*/g, "").replace(/\/\s*$/, "").replace(/\s{2,}/g, " ").trim();
}

export async function logEpisode(seriesId, ep) {
  const s = await getSeries(seriesId);
  if (!s) return null;
  s.episodes = [...(s.episodes || []), { ...ep, at: new Date().toISOString() }];
  s.next = Math.max(s.next || 1, (ep.n || 0) + 1);
  await saveSeries(s);
  return s;
}

// Fonts for a series (older templates used a pairing instead).
export function seriesFonts(s, pairings) {
  if (s.fonts?.title) return s.fonts;
  const p = pairings.find((x) => x.id === s.pairing) || pairings[0];
  return { title: p.title, sub: p.primary };
}
export const needsWord = (s) => /\{word\}/.test(`${s.title} ${s.subtitle}`);
export const needsPlace = (s) => /\{place\}/.test(`${s.title} ${s.subtitle}`);
