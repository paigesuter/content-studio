// Multi-clip editor: several clips/photos -> one smooth vertical video.
// Runs on the phone: canvas drawing + crossfades + Web Audio mixing + MediaRecorder export.
import { getBlob, listMedia } from "./library.js";
import { getSeries, listSeries, fillTemplate, logEpisode, TEXT_POSITIONS, seriesFonts, needsWord, needsPlace } from "./series.js";
import { PAIRINGS, PALETTES, googleFontsHref, loadFontsFor, activeFonts, activePalette } from "./kit.js";
import { loadKit, registerCustomFonts } from "./brand.js";
import { drawHook, pickMime } from "./render.js";
import { suggestHooks } from "./hooks.js";
import { db } from "./db.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const W = 1080, H = 1920;
const MIN_LEN = 1.2;
const PACE = { cinematic: 3.2, smooth: 2.4, snappy: 1.5 };

// ---------------- state ----------------
const P = {
  clips: [],             // {mediaId, kind, name, duration, inT, len, muted}
  seriesId: null, title: "", sub: "", ep: { n: 1, date: new Date().toISOString().slice(0, 10), word: "", place: "" },
  pace: "smooth", transition: "fade", clipVol: 1, musicVol: 0.6,
};
const media = new Map();   // mediaId -> {meta, url, thumbUrl, bmp}
let music = null;          // {buffer, name}
let series = null;
let look = null, palette = null;
let selected = 0;
const undoStack = [], redoStack = [];

const snapshot = () => JSON.stringify({ clips: P.clips, title: P.title, pace: P.pace, transition: P.transition, clipVol: P.clipVol, musicVol: P.musicVol });
function remember() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; updateUndo(); }
function restore(s) { const o = JSON.parse(s); Object.assign(P, o); selected = Math.min(selected, P.clips.length - 1); refresh(); }
function updateUndo() { $("undoBtn").disabled = !undoStack.length; $("redoBtn").disabled = !redoStack.length; }
$("undoBtn").onclick = () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateUndo(); };
$("redoBtn").onclick = () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateUndo(); };

let saveT;
function autosave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => db.setValue("montageDraft", { ...JSON.parse(snapshot()), seriesId: P.seriesId, ep: P.ep, sub: P.sub, saved: new Date().toISOString() }).catch(() => {}), 400);
}

// ---------------- timing ----------------
const XF = () => (P.transition === "fade" ? 0.35 : 0);
function timing() {
  const starts = [];
  let t = 0;
  P.clips.forEach((c, i) => { starts.push(t); t += c.len - (i < P.clips.length - 1 ? XF() : 0); });
  return { starts, total: Math.max(0, t) };
}
const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };

function autoEdit() {
  const per = PACE[P.pace];
  const n = P.clips.length;
  P.clips.forEach((c, i) => {
    let len = c.kind === "photo" ? per + 0.4 : per;
    if (i === 0) len = Math.max(1.4, per * 0.85);                  // quick opener
    if (i === n - 1 && n > 1) len = per + 1.2;                     // let the ending breathe
    if (c.kind === "video") len = Math.min(len, Math.max(0.5, c.duration - 0.2));
    c.len = Math.max(Math.min(MIN_LEN, c.duration || MIN_LEN), +len.toFixed(2));
    c.inT = c.kind === "video" ? +Math.max(0, Math.min(c.duration - c.len - 0.05, c.duration * 0.35 - c.len / 3)).toFixed(2) : 0;
  });
}

// ---------------- loading ----------------
async function loadMedia(ids) {
  const all = await listMedia();
  for (const id of ids) {
    if (media.has(id)) continue;
    const meta = all.find((m) => m.id === id);
    const blob = await getBlob(id);
    if (!meta || !blob) continue;
    const entry = { meta, url: URL.createObjectURL(blob), thumbUrl: meta.thumb ? URL.createObjectURL(meta.thumb) : null, bmp: null };
    if (meta.kind === "photo") { try { entry.bmp = await createImageBitmap(blob); } catch { entry.bmp = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = entry.url; }); } }
    media.set(id, entry);
  }
}

// ---------------- engine ----------------
const pool = [$("vA"), $("vB")];
let actx = null, recDest = null, monitor = null;
const gains = [];
function audioSetup() {
  if (actx) { if (actx.state === "suspended") actx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  actx = new AC();
  recDest = actx.createMediaStreamDestination();
  monitor = actx.createGain();
  monitor.connect(actx.destination);
  pool.forEach((v, k) => {
    const src = actx.createMediaElementSource(v);
    const g = actx.createGain(); g.gain.value = 0;
    src.connect(g); g.connect(monitor); g.connect(recDest);
    gains[k] = g;
  });
}
// iOS only lets a video play with sound after a tap: "unlock" both players during the tap.
async function unlock() {
  audioSetup();
  for (const v of pool) { try { v.muted = false; if (!v.src) v.src = media.values().next().value?.url || ""; await v.play(); v.pause(); } catch {} }
}

function prepare(i) {
  const c = P.clips[i];
  if (!c || c.kind !== "video") return Promise.resolve();
  const v = pool[i % 2];
  const url = media.get(c.mediaId)?.url;
  return new Promise((res) => {
    const seek = () => {
      const done = () => { v.removeEventListener("seeked", done); res(); };
      v.addEventListener("seeked", done);
      v.currentTime = c.inT;
      setTimeout(res, 2500);
    };
    if (v.dataset.url !== url) {
      v.dataset.url = url; v.src = url;
      v.addEventListener("loadedmetadata", seek, { once: true });
      v.load();
      setTimeout(res, 4000);
    } else seek();
  });
}

function drawCover(ctx, src, sw, sh, zoom, cw, ch) {
  if (!sw || !sh) return;
  const scale = Math.max(cw / sw, ch / sh) * zoom;
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(src, (cw - dw) / 2, (ch - dh) * 0.45, dw, dh);
}

function overlayState(outT) {
  return { hook: P.title, sub: P.sub, look, palette };
}

function drawAt(ctx, cw, ch, t, tm) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch);
  const xf = XF();
  P.clips.forEach((c, i) => {
    const s = tm.starts[i], e = s + c.len;
    if (t < s || t > e) return;
    let a = 1;
    if (xf && i > 0 && t < s + xf) a = (t - s) / xf;
    ctx.globalAlpha = Math.max(0, Math.min(1, a));
    const prog = (t - s) / c.len;
    const zoom = c.kind === "photo" ? 1.02 + 0.08 * prog : 1.0 + 0.04 * prog;   // gentle cinematic push-in
    if (c.kind === "photo") { const b = media.get(c.mediaId)?.bmp; if (b) drawCover(ctx, b, b.width, b.height, zoom, cw, ch); }
    else { const v = pool[i % 2]; drawCover(ctx, v, v.videoWidth, v.videoHeight, zoom, cw, ch); }
  });
  ctx.globalAlpha = 1;
  if (P.title || P.sub) drawHook(ctx, cw, ch, overlayState(t), t);
}

let running = null;
// Plays the edit in real time, drawing to ctx. Used for both preview and export.
async function run(ctx, cw, ch, { from = 0, recording = false, onProgress } = {}) {
  const tm = timing();
  if (!P.clips.length) return;
  audioSetup();
  monitor.gain.value = recording ? 0 : 1;
  const token = {}; running = token;
  await prepare(from); await prepare(from + 1);
  const startOut = tm.starts[from];
  const started = new Set(), ended = new Set(), prepped = new Set([from, from + 1]);
  let musicNode = null;
  if (music) {
    musicNode = actx.createBufferSource(); musicNode.buffer = music.buffer;
    const mg = actx.createGain(); mg.gain.value = P.musicVol;
    musicNode.connect(mg); mg.connect(monitor); mg.connect(recDest);
    musicNode.start(0, startOut % music.buffer.duration);
  }
  const t0 = performance.now();
  await new Promise((resolve) => {
    const frame = () => {
      if (running !== token) return resolve();
      const raw = startOut + (performance.now() - t0) / 1000;
      const t = Math.min(raw, tm.total - 0.02);   // never draw past the last frame (no black flash at the end)
      P.clips.forEach((c, i) => {
        if (i < from) return;
        const s = tm.starts[i], e = s + c.len;
        const v = pool[i % 2];
        if (t >= s && !started.has(i)) {
          started.add(i);
          if (c.kind === "video") v.play().catch(() => {});
        }
        if (t > e && !ended.has(i)) {
          ended.add(i);
          if (c.kind === "video") v.pause();
          if (!prepped.has(i + 2)) { prepped.add(i + 2); prepare(i + 2); }   // reuse this player for the clip after next
        }
        if (c.kind === "video" && t >= s && t <= e) {
          const xf = XF();
          let a = 1;
          if (xf && i > 0 && t < s + xf) a = (t - s) / xf;
          if (xf && i < P.clips.length - 1 && t > e - xf) a = Math.min(a, (e - t) / xf);
          gains[i % 2].gain.value = c.muted ? 0 : Math.max(0, a) * P.clipVol;
        }
      });
      drawAt(ctx, cw, ch, t, tm);
      onProgress?.((t - startOut) / Math.max(0.01, tm.total - startOut), t);
      if (raw >= tm.total) return resolve();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  pool.forEach((v) => v.pause());
  gains.forEach((g) => g && (g.gain.value = 0));
  try { musicNode?.stop(); } catch {}
  if (running === token) running = null;
}
function stop() { running = null; pool.forEach((v) => v.pause()); }

// ---------------- preview ----------------
const pv = $("preview"), pctx = pv.getContext("2d");
async function drawStill() {
  const tm = timing();
  if (!P.clips.length) { pctx.fillStyle = "#000"; pctx.fillRect(0, 0, pv.width, pv.height); return; }
  const i = Math.min(selected, P.clips.length - 1);
  const t = tm.starts[i] + Math.min(0.6, P.clips[i].len / 2);
  if (P.clips[i].kind === "video") {
    const v = pool[i % 2];
    const url = media.get(P.clips[i].mediaId)?.url;
    if (v.dataset.url !== url) { v.dataset.url = url; v.src = url; await new Promise((r) => { v.onloadeddata = r; v.load(); setTimeout(r, 3000); }); }
    await new Promise((r) => { v.onseeked = r; v.currentTime = P.clips[i].inT + Math.min(0.6, P.clips[i].len / 2); setTimeout(r, 1500); });
  }
  drawAt(pctx, pv.width, pv.height, t, tm);
}
$("playBtn").onclick = async () => {
  if (running) { stop(); $("playBtn").textContent = "▶"; return; }
  await unlock();
  $("playBtn").textContent = "❚❚";
  await run(pctx, pv.width, pv.height, { from: 0, onProgress: (p, t) => { $("timeLabel").textContent = `${fmt(t)} / ${fmt(timing().total)}`; } });
  $("playBtn").textContent = "▶";
};

// ---------------- timeline UI ----------------
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v; else if (k === "style") Object.assign(n.style, v);
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? "" : v);
  }
  kids.flat().forEach((c) => c != null && c !== false && n.append(c instanceof Node ? c : document.createTextNode(String(c))));
  return n;
}

function renderTimeline() {
  const tm = timing();
  $("totalLabel").textContent = `${P.clips.length} clips · ${fmt(tm.total)}`;
  $("timeLabel").textContent = `0:00 / ${fmt(tm.total)}`;
  const PX = 34; // pixels per second
  $("trackVideo").replaceChildren(...P.clips.map((c, i) => {
    const m = media.get(c.mediaId);
    return el("button", { class: "tl-clip" + (i === selected ? " on" : ""), style: { width: `${Math.max(56, c.len * PX)}px`, backgroundImage: m?.thumbUrl ? `url(${m.thumbUrl})` : "none" },
      onclick: () => { selected = i; refresh(); } },
      el("span", { class: "tl-len" }, `${c.len.toFixed(1)}s`), c.kind === "photo" ? el("span", { class: "tl-kind" }, "📷") : null, c.muted ? el("span", { class: "tl-kind" }, "🔇") : null);
  }), el("button", { class: "tl-add", onclick: openPicker }, "＋"));
  const titleW = Math.min(tm.total, look?.hook?.whole ? tm.total : 3.2) * PX;
  $("trackText").replaceChildren(P.title ? el("div", { class: "tl-bar text", style: { width: `${Math.max(60, titleW)}px` } }, "Aa " + P.title) : el("div", { class: "tl-empty" }, "no text"));
  $("trackMusic").replaceChildren(music ? el("div", { class: "tl-bar music", style: { width: `${Math.max(60, tm.total * PX)}px` } }, "♫ " + music.name) : el("div", { class: "tl-empty" }, "no music"));
}

function renderClipPanel() {
  const c = P.clips[selected];
  const box = $("clipPanel");
  if (!c) { box.replaceChildren(el("p", { class: "small muted" }, "Add some clips to get started.")); return; }
  const m = media.get(c.mediaId);
  const maxLen = c.kind === "video" ? Math.max(0.5, c.duration) : 8;
  const lenIn = el("input", { type: "range", min: Math.min(MIN_LEN, maxLen), max: maxLen.toFixed(2), step: "0.1", value: c.len });
  const startIn = el("input", { type: "range", min: 0, max: Math.max(0, c.duration - c.len).toFixed(2), step: "0.1", value: c.inT, disabled: c.kind !== "video" || c.duration - c.len < 0.1 });
  const lenLabel = el("b", {}, `${c.len.toFixed(1)}s`), startLabel = el("b", {}, `${c.inT.toFixed(1)}s`);
  lenIn.onpointerdown = startIn.onpointerdown = () => remember();
  lenIn.oninput = () => { c.len = +(+lenIn.value).toFixed(2); if (c.inT + c.len > c.duration) c.inT = Math.max(0, c.duration - c.len); lenLabel.textContent = `${c.len.toFixed(1)}s`; renderTimeline(); autosave(); };
  startIn.oninput = () => { c.inT = +(+startIn.value).toFixed(2); startLabel.textContent = `${c.inT.toFixed(1)}s`; autosave(); };
  lenIn.onchange = startIn.onchange = () => { refresh(); };
  const move = (d) => { const j = selected + d; if (j < 0 || j >= P.clips.length) return; remember(); [P.clips[selected], P.clips[j]] = [P.clips[j], P.clips[selected]]; selected = j; refresh(); };
  box.replaceChildren(...[
    el("div", { class: "cp-head" }, m?.thumbUrl ? el("img", { src: m.thumbUrl, alt: "" }) : null,
      el("div", {}, el("b", {}, `Clip ${selected + 1} of ${P.clips.length}`), el("div", { class: "small muted" }, c.kind === "video" ? `${c.duration.toFixed(1)}s long` : "Photo, with a gentle zoom"))),
    el("label", { class: "field" }, el("span", {}, "Length ", lenLabel), lenIn),
    c.kind === "video" ? el("label", { class: "field" }, el("span", {}, "Starts at ", startLabel, " into the clip"), startIn) : null,
    el("div", { class: "cp-actions" },
      el("button", { onclick: () => move(-1), disabled: selected === 0 }, "◀ Move"),
      el("button", { onclick: () => move(1), disabled: selected === P.clips.length - 1 }, "Move ▶"),
      c.kind === "video" ? el("button", { onclick: () => { remember(); c.muted = !c.muted; refresh(); } }, c.muted ? "🔇 Sound off" : "🔊 Sound on") : null,
      el("button", { class: "danger", onclick: () => { remember(); P.clips.splice(selected, 1); selected = Math.max(0, selected - 1); refresh(); } }, "🗑 Remove"))].filter(Boolean));
}

function refresh() { renderTimeline(); renderClipPanel(); drawStill(); autosave(); updateUndo(); }

// ---------------- settings ----------------
document.querySelectorAll("[data-pace]").forEach((b) => b.onclick = () => {
  remember(); P.pace = b.dataset.pace; autoEdit(); markChips(); refresh();
});
document.querySelectorAll("[data-tr]").forEach((b) => b.onclick = () => { remember(); P.transition = b.dataset.tr; markChips(); refresh(); });
function markChips() {
  document.querySelectorAll("[data-pace]").forEach((b) => b.classList.toggle("on", b.dataset.pace === P.pace));
  document.querySelectorAll("[data-tr]").forEach((b) => b.classList.toggle("on", b.dataset.tr === P.transition));
}
$("titleIn").oninput = (e) => { P.title = e.target.value; renderTimeline(); drawStill(); autosave(); };
$("clipVol").oninput = (e) => { P.clipVol = +e.target.value; autosave(); };
$("musicVol").oninput = (e) => { P.musicVol = +e.target.value; autosave(); };
$("musicBtn").onclick = () => $("musicIn").click();
$("musicIn").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    audioSetup();
    const buffer = await actx.decodeAudioData(await f.arrayBuffer());
    music = { buffer, name: f.name.replace(/\.[^.]+$/, "") };
    $("musicName").textContent = `♫ ${music.name}`;
    $("musicRemove").hidden = false;
    renderTimeline();
  } catch { alert("That audio file couldn't be opened. Try an .mp3 or .m4a."); }
};
$("musicRemove").onclick = () => { music = null; $("musicName").textContent = "No music"; $("musicRemove").hidden = true; renderTimeline(); };

// style: series template or your brand
async function applyLook() {
  const kit = await loadKit();
  if (series) {
    const fonts = seriesFonts(series, PAIRINGS);
    const pal = (PALETTES.find((p) => p.id === series.palette) || PALETTES[0]).colors;
    await loadFontsFor({ a: fonts.title, b: fonts.sub });
    palette = { accent: pal.pink, accent2: pal.butter, ink: pal.deep, light: pal.text };
    look = { hook: { style: "series", y: TEXT_POSITIONS[series.position] ?? 0.16, font: fonts.title, subFont: fonts.sub, whole: series.showTitle === "whole",
      color: { pink: "accent", butter: "accent2", white: "light" }[series.titleColor] || "light", case: series.titleCase || "none",
      size: series.titleSize || "l", layout: series.layout || "stack", subStyle: series.subStyle || "pill" } };
    P.title = fillTemplate(series.title, series, P.ep);
    P.sub = fillTemplate(series.subtitle, series, P.ep);
  } else {
    const f = activeFonts(kit), pal = activePalette(kit).colors;
    await loadFontsFor(f);
    palette = { accent: pal.pink, accent2: pal.butter, ink: pal.deep, light: pal.text };
    look = { hook: { style: "series", y: 0.16, font: f.title, subFont: f.primary, whole: false, color: "light", case: "none", size: "l", layout: "stack", subStyle: "small" } };
    P.sub = "";
  }
  $("titleIn").value = P.title;
  renderEpisode();
}

function renderEpisode() {
  const box = $("episodeBox");
  if (!series) { box.hidden = true; return; }
  box.hidden = false;
  const field = (label, key, type = "text", ph = "") => {
    const i = el("input", { type, value: P.ep[key], placeholder: ph });
    i.oninput = () => { P.ep[key] = type === "number" ? parseInt(i.value || "1", 10) : i.value; P.title = fillTemplate(series.title, series, P.ep); P.sub = fillTemplate(series.subtitle, series, P.ep); $("titleIn").value = P.title; renderTimeline(); drawStill(); autosave(); };
    return el("label", {}, label, i);
  };
  box.replaceChildren(el("h3", {}, `${series.emoji} ${series.name}`), el("div", { class: "ep-grid" },
    field(series.total ? `Episode (of ${series.total})` : "Episode", "n", "number"), field("Date", "date", "date"),
    needsWord(series) ? field("Feeling", "word", "text", "e.g. strong") : null, needsPlace(series) ? field("Place", "place", "text", "e.g. uluwatu") : null));
}

async function renderStyleChips() {
  const list = await listSeries();
  const chips = [el("button", { class: "chip" + (!series ? " on" : ""), onclick: async () => { series = null; P.seriesId = null; P.title = ""; await applyLook(); renderStyleChips(); refresh(); } }, "My brand"),
    ...list.map((s) => el("button", { class: "chip" + (series?.id === s.id ? " on" : ""), onclick: async () => { series = s; P.seriesId = s.id; P.ep.n = s.next || 1; await applyLook(); renderStyleChips(); refresh(); } }, `${s.emoji} ${s.name}`))];
  $("styleChips").replaceChildren(...chips);
}

async function renderHookIdeas() {
  const hb = (await db.getValue("hookbank", null)) || { favs: [], mine: [] };
  const ideas = suggestHooks("", { pillar: series?.pillar || null, n: 5, shuffleSeed: Math.floor(Math.random() * 9), mine: hb.mine, favs: hb.favs });
  $("hookIdeas").replaceChildren(...ideas.map((h) => el("button", { class: "chip", onclick: () => { P.title = h.text.replace(/\{n\}/g, P.ep.n); $("titleIn").value = P.title; renderTimeline(); drawStill(); autosave(); } }, h.text)));
}
$("moreHooks").onclick = renderHookIdeas;

// ---------------- add clips ----------------
async function openPicker() {
  const all = (await listMedia()).filter((m) => m.kind === "video" || m.kind === "photo");
  const picked = new Set();
  const grid = $("pickGrid");
  grid.replaceChildren(...all.map((m) => {
    const b = el("button", { class: "pick-tile", style: { backgroundImage: m.thumb ? `url(${URL.createObjectURL(m.thumb)})` : "none" },
      onclick: () => { picked.has(m.id) ? picked.delete(m.id) : picked.add(m.id); b.classList.toggle("on"); $("pickAdd").textContent = `Add ${picked.size}`; } },
      m.kind === "video" ? el("span", {}, `${Math.round(m.duration)}s`) : el("span", {}, "📷"));
    return b;
  }));
  $("pickAdd").textContent = "Add 0";
  $("pickAdd").onclick = async () => {
    if (!picked.size) return;
    remember();
    await loadMedia([...picked]);
    const from = P.clips.length;
    for (const id of picked) { const m = media.get(id); if (m) P.clips.push(newClip(m.meta)); }
    const per = PACE[P.pace];
    P.clips.slice(from).forEach((c) => { c.len = Math.min(c.kind === "video" ? Math.max(0.5, c.duration - 0.2) : 8, per); c.inT = c.kind === "video" ? Math.max(0, Math.min(c.duration - c.len - 0.05, c.duration * 0.3)) : 0; });
    $("picker").hidden = true; selected = from; refresh();
  };
  $("picker").hidden = false;
}
$("pickClose").onclick = () => ($("picker").hidden = true);
const newClip = (m) => ({ mediaId: m.id, kind: m.kind, name: m.name, duration: m.kind === "video" ? m.duration || 3 : 0, inT: 0, len: 2.4, muted: false });

// ---------------- export ----------------
let lastFile = null;
$("exportBtn").onclick = async () => {
  if (!P.clips.length) return;
  stop();
  await unlock();
  const box = $("exportBox"); box.hidden = false; $("saveRow").hidden = true;
  $("exportBtn").disabled = true;
  $("exportMsg").textContent = "Making your video… keep this screen open (it plays through once).";
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch {}
  try {
    const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");
    const mime = pickMime();
    const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...recDest.stream.getAudioTracks()]);
    const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 160_000 });
    const chunks = []; rec.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    drawAt(ctx, W, H, 0, timing());
    rec.start(1000);
    await run(ctx, W, H, { recording: true, onProgress: (p) => ($("exportBar").style.width = `${Math.round(Math.min(1, p) * 100)}%`) });
    rec.stop(); await stopped;
    const type = (mime || "video/mp4").split(";")[0];
    const blob = new Blob(chunks, { type });
    lastFile = new File([blob], `${series ? series.name.toLowerCase().replace(/\W+/g, "-") + "-" + P.ep.n : "my-video"}.${type.includes("webm") ? "webm" : "mp4"}`, { type });
    $("dlLink").href = URL.createObjectURL(blob); $("dlLink").download = lastFile.name;
    $("saveBtn").hidden = !(navigator.canShare && navigator.canShare({ files: [lastFile] }));
    $("saveRow").hidden = false;
    $("exportBar").style.width = "100%";
    $("exportMsg").textContent = `Done! ${(blob.size / 1e6).toFixed(1)} MB. Tap Save to Photos, then “Save Video”.`;
    if (series) {
      const s = await logEpisode(series.id, { n: P.ep.n, date: P.ep.date, word: P.ep.word, place: P.ep.place, clips: P.clips.map((c) => c.mediaId), title: P.title });
      if (s) { series = s; $("exportMsg").textContent += ` Logged as ${s.name} #${P.ep.n} ✓`; }
    }
  } catch (e) {
    $("exportMsg").textContent = "Something went wrong making the video: " + (e.message || e);
  } finally {
    $("exportBtn").disabled = false;
    try { await wake?.release(); } catch {}
  }
};
$("saveBtn").onclick = async () => { try { await navigator.share({ files: [lastFile] }); } catch {} };

// ---------------- start ----------------
(async () => {
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: googleFontsHref() }));
  await registerCustomFonts().catch(() => {});
  let ids = (params.get("clips") || "").split(",").filter(Boolean);
  const draft = await db.getValue("montageDraft", null);
  if (!ids.length && draft?.clips?.length) {
    Object.assign(P, draft);
    ids = P.clips.map((c) => c.mediaId);
    await loadMedia(ids);
    P.clips = P.clips.filter((c) => media.has(c.mediaId));
    if (P.seriesId) series = await getSeries(P.seriesId);
    $("status").textContent = `Welcome back. Your draft from ${new Date(draft.saved).toLocaleString()} is here.`;
  } else {
    await loadMedia(ids);
    P.clips = ids.filter((id) => media.has(id)).map((id) => newClip(media.get(id).meta));
    const sid = params.get("series");
    if (sid) { series = await getSeries(sid); P.seriesId = sid; P.ep.n = series?.next || 1; }
    autoEdit();
  }
  await applyLook();
  if (draft && !params.get("clips") && draft.title) { P.title = draft.title; $("titleIn").value = P.title; }
  markChips();
  $("clipVol").value = P.clipVol; $("musicVol").value = P.musicVol;
  await renderStyleChips();
  renderHookIdeas();
  refresh();
  if (!P.clips.length) openPicker();
  window.__P = P;
})();
