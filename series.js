// My Series: each series saves its own template (fonts, colours, text, pacing) so new episodes
// only need the footage. Stored on this device.
import { db, uid } from "./db.js";

export const TEXT_POSITIONS = { top: 0.16, middle: 0.42, bottom: 0.72 };

export const STARTER_SERIES = [
  {
    name: "Pilates Challenge", emoji: "🩰", pillar: "little",
    about: "My 60-class Pilates challenge. Same look every class so it's instantly recognisable.",
    palette: "studio", pairing: "editorial",
    title: "pilates class {n}/{total}", subtitle: "{date} · {word}",
    position: "top", showTitle: "whole", captions: false, zoom: "off", pause: 0.7,
    total: 60, next: 1, askWord: true, askPlace: false,
  },
  {
    name: "Island Diaries", emoji: "🌴", pillar: "experiencing",
    about: "My Bali diaries. Soft, cinematic, minimal text, the island tells the story.",
    palette: "coast", pairing: "minimal",
    title: "island diaries", subtitle: "day {n} · {place}",
    position: "top", showTitle: "start", captions: true, zoom: "low", pause: 0.6,
    total: null, next: 1, askWord: false, askPlace: true,
  },
];

export async function listSeries() {
  let list = await db.getValue("series", null);
  if (!list) {
    list = STARTER_SERIES.map((s, i) => ({ ...s, id: uid() + i, created: new Date(Date.now() + i).toISOString(), episodes: [], folder: null }));
    await db.setValue("series", list);
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
    palette: "signature", pairing: "editorial", title: "{name} {n}", subtitle: "", position: "top", showTitle: "start",
    captions: true, zoom: "low", pause: 0.6, total: null, next: 1, askWord: false, askPlace: false, episodes: [], folder: null };
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
