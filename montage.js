// Multi-clip editor: several clips/photos -> one smooth vertical video that makes sense.
// - Listens to talking clips (speech-to-text on the phone) and cuts on whole sentences
// - Removes pauses, ums, restarts and repeated lines; jump cuts get an alternating punch-in
// - Playback follows the video's own clock (no freezes/jolts), tiny audio fades at every cut
// - Captions across all clips, series templates, music, export
// - "Ask Claude to edit the story": Claude picks the best sentences in the order that makes sense
import { getBlob, listMedia } from "./library.js";
import { getSeries, listSeries, fillTemplate, logEpisode, TEXT_POSITIONS, seriesFonts, needsWord, needsPlace } from "./series.js";
import { PAIRINGS, PALETTES, googleFontsHref, loadFontsFor, activeFonts, activePalette } from "./kit.js";
import { loadKit, loadBrand, registerCustomFonts } from "./brand.js";
import { drawHook, drawCaptions, pickMime } from "./render.js";
import { analyseAudio, captureAudio, blooperCuts, groupWords, wordsFromASR } from "./engine.js";
import { suggestHooks, herBlock, HER_RULES } from "./hooks.js";
import { db } from "./db.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const TEST = params.has("test");
const W = 1080, H = 1920;
const MIN_LEN = 1.2;
const PACE = { cinematic: 3.2, smooth: 2.4, snappy: 1.5 };
const DISSOLVE = 0.35, SPEECH_DISSOLVE = 0.25;

// ---------------- state ----------------
const P = {
  sources: [],           // media ids in the order you picked them
  clips: [],             // timeline items: {mediaId, kind, duration, inT, len, muted, xfIn, zoom, speech}
  seriesId: null, title: "", sub: "", ep: { n: 1, date: new Date().toISOString().slice(0, 10), word: "", place: "" },
  pace: "smooth", transition: "fade", clipVol: 1, musicVol: 0.6, captions: true, goal: "",
};
const media = new Map();        // mediaId -> {meta, url, thumbUrl, bmp}
const transcripts = new Map();  // mediaId -> {words, sentences}
let music = null, series = null, look = null, palette = null, capLook = null;
let groups = [];
let selected = 0;
const undoStack = [], redoStack = [];

const snapshot = () => JSON.stringify({ sources: P.sources, clips: P.clips, title: P.title, pace: P.pace, transition: P.transition,
  clipVol: P.clipVol, musicVol: P.musicVol, captions: P.captions, goal: P.goal });
function remember() { undoStack.push(snapshot()); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; updateUndo(); }
function restore(s) { Object.assign(P, JSON.parse(s)); selected = Math.max(0, Math.min(selected, P.clips.length - 1)); $("titleIn").value = P.title; refresh(); }
function updateUndo() { $("undoBtn").disabled = !undoStack.length; $("redoBtn").disabled = !redoStack.length; }
$("undoBtn").onclick = () => { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); updateUndo(); };
$("redoBtn").onclick = () => { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); updateUndo(); };
let saveT;
function autosave() {
  clearTimeout(saveT);
  saveT = setTimeout(() => db.setValue("montageDraft", { ...JSON.parse(snapshot()), seriesId: P.seriesId, ep: P.ep, sub: P.sub, saved: new Date().toISOString() }).catch(() => {}), 400);
}

// ---------------- timing ----------------
function timing() {
  const starts = [];
  let t = 0;
  P.clips.forEach((c, i) => {
    if (i > 0) t = starts[i - 1] + P.clips[i - 1].len - (c.xfIn || 0);
    starts.push(Math.max(0, t));
  });
  const last = P.clips.length - 1;
  return { starts, total: last >= 0 ? starts[last] + P.clips[last].len : 0 };
}
const fmt = (s) => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };
const isSpeech = (id) => (transcripts.get(id)?.words?.length || 0) >= 3;

// ---------------- building the edit ----------------
function brollItem(id, i, n) {
  const m = media.get(id).meta;
  const per = PACE[P.pace];
  let len = m.kind === "photo" ? per + 0.4 : per;
  if (i === 0) len = Math.max(1.4, per * 0.85);
  if (i === n - 1 && n > 1) len = per + 1.2;
  const dur = m.kind === "video" ? m.duration || 3 : 0;
  if (m.kind === "video") len = Math.min(len, Math.max(0.5, dur - 0.2));
  len = Math.max(Math.min(MIN_LEN, dur || MIN_LEN), +len.toFixed(2));
  const inT = m.kind === "video" ? +Math.max(0, Math.min(dur - len - 0.05, dur * 0.35 - len / 3)).toFixed(2) : 0;
  return { mediaId: id, kind: m.kind, duration: dur, inT, len, muted: false, xfIn: 0, zoom: 1, speech: false };
}

// Splits what you said into clean spoken segments: removes restarts, repeats, ums and pauses.
function speechSegments(id, range = null) {
  const tr = transcripts.get(id);
  const dur = media.get(id).meta.duration || 0;
  let words = tr.words;
  if (range) words = words.filter((w) => (w.start + w.end) / 2 >= range[0] && (w.start + w.end) / 2 <= range[1]);
  const cuts = blooperCuts(words, { bloopers: !range, fillers: true });
  const kept = words.filter((w) => !cuts.some((c) => (w.start + w.end) / 2 >= c.start && (w.start + w.end) / 2 <= c.end));
  const segs = [];
  let cur = null;
  for (const w of kept) {
    if (cur && w.start - cur.lastEnd <= 0.5) { cur.lastEnd = w.end; cur.n++; continue; }
    if (cur) segs.push(cur);
    cur = { first: w.start, lastEnd: w.end, n: 1 };
  }
  if (cur) segs.push(cur);
  return segs.map((s) => {
    const inT = Math.max(0, s.first - 0.08);
    return { inT: +inT.toFixed(3), len: +(Math.min(dur, s.lastEnd + 0.15) - inT).toFixed(3) };
  }).filter((s) => s.len > 0.3);
}

function pushItems(items, id, segs) {
  const m = media.get(id).meta;
  segs.forEach((s, k) => {
    const prev = items[items.length - 1];
    if (prev && prev.mediaId === id && Math.abs(prev.inT + prev.len - s.inT) < 0.06) { prev.len = +(prev.len + s.len).toFixed(3); return; }
    const sameSource = prev && prev.mediaId === id;
    const zoom = sameSource ? (prev.zoom > 1 ? 1 : 1.1) : 1;   // jump cuts alternate a gentle punch-in
    items.push({ mediaId: id, kind: "video", duration: m.duration || 0, inT: s.inT, len: s.len, muted: false,
      xfIn: !prev || sameSource ? 0 : (P.transition === "fade" ? SPEECH_DISSOLVE : 0), zoom, speech: true });
  });
}

function autoEdit() {
  const items = [];
  const n = P.sources.length;
  P.sources.forEach((id, i) => {
    if (!media.has(id)) return;
    if (isSpeech(id)) pushItems(items, id, speechSegments(id));
    else {
      const b = brollItem(id, i, n);
      b.xfIn = items.length && P.transition === "fade" ? DISSOLVE : 0;
      items.push(b);
    }
  });
  P.clips = items;
}

function speechSummary() {
  const talking = P.sources.filter(isSpeech);
  const sentences = talking.reduce((a, id) => a + transcripts.get(id).sentences.length, 0);
  return talking.length ? `🎙 Heard you in ${talking.length} clip${talking.length > 1 ? "s" : ""} (${sentences} sentences). Cut on whole sentences, with pauses, ums and restarts removed.` : "";
}

// ---------------- loading ----------------
async function loadMedia(ids) {
  const all = await listMedia();
  for (const id of ids) {
    if (media.has(id)) continue;
    const meta = all.find((m) => m.id === id);
    const blob = await getBlob(id);
    if (!meta || !blob) continue;
    const entry = { meta, blob, url: URL.createObjectURL(blob), thumbUrl: meta.thumb ? URL.createObjectURL(meta.thumb) : null, bmp: null };
    if (meta.kind === "photo") { try { entry.bmp = await createImageBitmap(blob); } catch { entry.bmp = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = entry.url; }); } }
    media.set(id, entry);
    const tr = await db.getValue(`tr:${id}`, null);
    if (tr) transcripts.set(id, tr);
  }
}

// ---------------- understanding speech ----------------
function toSentences(words) {
  const out = [];
  let cur = [];
  words.forEach((w, i) => {
    cur.push(w);
    const next = words[i + 1];
    if (/[.!?…]$/.test(w.text) || !next || next.start - w.end > 0.7) {
      out.push({ i: out.length + 1, text: cur.map((x) => x.text).join(" "), start: cur[0].start, end: cur[cur.length - 1].end });
      cur = [];
    }
  });
  return out;
}

let worker = null;
function transcribePCM(pcm, onStatus) {
  if (!worker) worker = new Worker("./listen-worker.js", { type: "module" });
  return new Promise((resolve, reject) => {
    const files = {};
    worker.onmessage = (e) => {
      const m = e.data;
      if (m.type === "download") {
        files[m.file] = m;
        const l = Object.values(files).reduce((a, f) => a + f.loaded, 0), t = Object.values(files).reduce((a, f) => a + f.total, 0);
        onStatus?.(`Downloading the speech model (first time only): ${Math.round((l / t) * 100)}%`);
      } else if (m.type === "listening") onStatus?.("Listening…");
      else if (m.type === "done") resolve(m.out);
      else if (m.type === "error") reject(new Error(m.message));
    };
    worker.postMessage({ pcm });
  });
}

async function understand() {
  const btn = $("flowBtn");
  btn.disabled = true;
  const status = (t) => ($("flowStatus").textContent = t);
  let wake = null; try { wake = await navigator.wakeLock?.request("screen"); } catch {}
  try {
    audioSetup();
    const videos = P.sources.filter((id) => media.get(id)?.meta.kind === "video" && !transcripts.has(id));
    for (let k = 0; k < videos.length; k++) {
      const id = videos[k], m = media.get(id);
      const label = `Clip ${P.sources.indexOf(id) + 1} of ${P.sources.length}`;
      let words = [];
      if (TEST) words = (window.__fakeTranscripts || {})[m.meta.name] || [];
      else {
        let analysis;
        status(`${label}: reading the sound…`);
        try {
          analysis = await analyseAudio(new File([m.blob], m.meta.name, { type: m.blob.type }));
        } catch {
          // iPhone .MOV: play it silently once and record the sound
          const v = pool[0];
          v.dataset.url = m.url; v.src = m.url;
          await new Promise((r) => { v.onloadedmetadata = r; v.load(); setTimeout(r, 5000); });
          monitor.gain.value = 0;
          analysis = await captureAudio(v, { ctx: actx, src: srcNodes[0], monitor: actx.createGain() }, (p) => status(`${label}: scanning the sound ${Math.round(p * 100)}%`));
          monitor.gain.value = 1;
        }
        status(`${label}: listening to what you say…`);
        const out = await transcribePCM(analysis.pcm, (t) => status(`${label}: ${t}`));
        words = wordsFromASR(out, analysis.duration);
      }
      const tr = { words, sentences: toSentences(words) };
      transcripts.set(id, tr);
      await db.setValue(`tr:${id}`, tr).catch(() => {});
    }
    remember();
    autoEdit();
    status(speechSummary() || "No speech found, so these are treated as b-roll.");
    $("storyBox").hidden = !P.sources.some(isSpeech);
    refresh();
  } catch (e) {
    status("Couldn't listen to the clips: " + (e.message || e));
  } finally {
    btn.disabled = false;
    btn.textContent = "🎙 Listen again";
    try { await wake?.release(); } catch {}
  }
}

// ---------------- Ask Claude to edit the story ----------------
const letter = (i) => String.fromCharCode(65 + i);
async function storyPrompt() {
  const b = await loadBrand();
  const lines = P.sources.map((id, i) => {
    const m = media.get(id)?.meta;
    if (!m) return "";
    if (isSpeech(id)) return `CLIP ${letter(i)} (talking, ${Math.round(m.duration)}s):\n` + transcripts.get(id).sentences.map((s) => `  ${letter(i)}${s.i}: "${s.text}" (${(s.end - s.start).toFixed(1)}s)`).join("\n");
    return `CLIP ${letter(i)}: ${m.kind === "photo" ? "photo" : `b-roll video, ${Math.round(m.duration)}s, no talking`}`;
  }).join("\n");
  return `I'm Paige (@paigesuterx). I filmed these clips for ONE video and need you to edit them so it flows and makes sense.

WHAT I'M TRYING TO MAKE: ${P.goal || "(work it out from what I say)"}
${series ? `It's part of my "${series.name}" series.` : ""}
${herBlock(b)}
My voice: ${(b.voice.style || []).slice(0, 4).join("; ")}

THE CLIPS (sentences are numbered like A1, A2):
${lines}

${HER_RULES}
Build the edit for HER: open with the line that makes her think "that's literally me", keep the parts that are useful or relatable to her life, and end on what it means for her.
Edit it like a good editor: pick the best sentences in the order that tells the story clearly, cut repeats, rambling, mistakes and anything that doesn't fit. You can reorder sentences and clips, and place b-roll/photos between sentences (or at the start/end) to break up talking. Aim for under ~60 seconds unless the story needs more. Open with the strongest line.

Reply with ONLY one JSON code block:
\`\`\`json
{"title": "short on-screen hook about HER, in my voice",
 "edit": [{"clip": "A", "sentences": [2, 3]}, {"clip": "C"}, {"clip": "B", "sentences": [1]}],
 "why": "one line on the story you built"}
\`\`\`
(For b-roll or photos just give the clip letter.)`;
}
$("askStory").onclick = async () => {
  P.goal = $("goalIn").value.trim();
  $("promptBox").textContent = await storyPrompt();
  $("replyBox").value = ""; $("replyMsg").textContent = "";
  $("claudeSheet").hidden = false;
};
$("closeClaude").onclick = () => ($("claudeSheet").hidden = true);
$("copyPrompt").onclick = async () => {
  try { await navigator.clipboard.writeText($("promptBox").textContent); $("copyPrompt").textContent = "Copied ✓ Now paste it into Claude"; }
  catch { $("copyPrompt").textContent = "Couldn't copy. Select the text below and copy it"; }
};
$("applyReply").onclick = () => {
  const text = $("replyBox").value;
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  let data;
  try { data = JSON.parse(m ? m[1] : text); } catch { $("replyMsg").textContent = "That didn't look like Claude's reply. Copy the whole message, including the code block."; return; }
  const ok = applyStory(data);
  if (!ok) { $("replyMsg").textContent = "Couldn't find an edit in that reply."; return; }
  $("claudeSheet").hidden = true;
  $("flowStatus").textContent = `✧ Claude's edit: ${data.why || "story rebuilt"}`;
};

function applyStory(data) {
  const entries = Array.isArray(data.edit) ? data.edit : [];
  const items = [];
  entries.forEach((e, k) => {
    const idx = String(e.clip || "").toUpperCase().charCodeAt(0) - 65;
    const id = P.sources[idx];
    if (!id || !media.has(id)) return;
    if (isSpeech(id) && Array.isArray(e.sentences) && e.sentences.length) {
      const tr = transcripts.get(id);
      e.sentences.forEach((n) => {
        const s = tr.sentences.find((x) => x.i === Number(String(n).replace(/\D/g, "")));
        if (s) pushItems(items, id, speechSegments(id, [s.start - 0.01, s.end + 0.01]));
      });
    } else {
      const b = brollItem(id, k, entries.length);
      b.xfIn = items.length && P.transition === "fade" ? DISSOLVE : 0;
      items.push(b);
    }
  });
  if (!items.length) return false;
  remember();
  P.clips = items;
  if (data.title) { P.title = String(data.title); $("titleIn").value = P.title; }
  selected = 0;
  refresh();
  return true;
}

// ---------------- engine ----------------
const pool = [$("vA"), $("vB"), $("vC")];
const elOf = (i) => pool[i % pool.length];
let actx = null, recDest = null, monitor = null;
const gains = [], srcNodes = [];
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
    gains[k] = g; srcNodes[k] = src;
  });
}
// iOS only lets video play with sound after a tap: "unlock" every player during the tap.
async function unlock() {
  audioSetup();
  const first = [...media.values()].find((m) => m.meta.kind === "video");
  for (const v of pool) { try { if (!v.src && first) { v.src = first.url; v.dataset.url = first.url; } await v.play(); v.pause(); } catch {} }
}

function prepare(i) {
  const c = P.clips[i];
  if (!c || c.kind !== "video") return Promise.resolve();
  const v = elOf(i);
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

function drawCover(ctx, src, sw, sh, zoom, cw, ch, focusY = 0.45) {
  if (!sw || !sh) return;
  const scale = Math.max(cw / sw, ch / sh) * zoom;
  const dw = sw * scale, dh = sh * scale;
  ctx.drawImage(src, (cw - dw) / 2, (ch - dh) * focusY, dw, dh);
}

function alphaFor(i, t, tm) {
  const c = P.clips[i], s = tm.starts[i], e = s + c.len;
  let a = 1;
  if (c.xfIn && t < s + c.xfIn) a = (t - s) / c.xfIn;
  const next = P.clips[i + 1];
  if (next?.xfIn && t > e - next.xfIn) a = Math.min(a, (e - t) / next.xfIn);
  return Math.max(0, Math.min(1, a));
}

function drawAt(ctx, cw, ch, t, tm) {
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, cw, ch);
  P.clips.forEach((c, i) => {
    const s = tm.starts[i], e = s + c.len;
    if (t < s || t > e) return;
    // incoming clip fades in over the outgoing one; the outgoing one stays solid underneath (no dip to black)
    ctx.globalAlpha = c.xfIn && t < s + c.xfIn ? Math.max(0, Math.min(1, (t - s) / c.xfIn)) : 1;
    const prog = (t - s) / Math.max(0.01, c.len);
    const push = c.speech ? 0 : c.kind === "photo" ? 0.08 * prog : 0.04 * prog;
    const zoom = (c.zoom || 1) + push;
    if (c.kind === "photo") { const b = media.get(c.mediaId)?.bmp; if (b) drawCover(ctx, b, b.width, b.height, 1.02 + push, cw, ch); }
    else { const v = elOf(i); drawCover(ctx, v, v.videoWidth, v.videoHeight, zoom, cw, ch, c.zoom > 1 ? 0.38 : 0.45); }
  });
  ctx.globalAlpha = 1;
  if (P.captions && groups.length && capLook) drawCaptions(ctx, cw, ch, { captionsOn: true, plan: { groups }, look: capLook, palette }, t);
  if (P.title || P.sub) drawHook(ctx, cw, ch, { hook: P.title, sub: P.sub, look, palette }, t);
}

// Captions: every word you say, placed at its time in the finished edit.
function buildGroups(tm) {
  const words = [];
  P.clips.forEach((c, i) => {
    if (!c.speech) return;
    const tr = transcripts.get(c.mediaId);
    for (const w of tr?.words || []) {
      const mid = (w.start + w.end) / 2;
      if (mid < c.inT || mid > c.inT + c.len) continue;
      const off = tm.starts[i] - c.inT;
      words.push({ text: w.text, start: Math.max(tm.starts[i], w.start + off), end: Math.min(tm.starts[i] + c.len, w.end + off) });
    }
  });
  groups = words.length ? groupWords(words, capLook?.captions.words || 4) : [];
}

let running = null;
// Plays the edit, drawing to ctx. The clock follows the playing video itself, so a clip that
// starts a moment late never causes a freeze-then-jump. Used for preview and export.
async function run(ctx, cw, ch, { recording = false, onProgress } = {}) {
  const tm = timing();
  if (!P.clips.length) return;
  audioSetup();
  monitor.gain.value = recording ? 0 : 1;
  const token = {}; running = token;
  await Promise.all([prepare(0), prepare(1), prepare(2)]);
  const started = new Set(), ended = new Set();
  let musicNode = null;
  if (music) {
    musicNode = actx.createBufferSource(); musicNode.buffer = music.buffer;
    const mg = actx.createGain(); mg.gain.value = P.musicVol;
    musicNode.connect(mg); mg.connect(monitor); mg.connect(recDest);
    musicNode.start(0, 0);
  }
  let lastT = 0, lastWall = performance.now(), holdSince = null;
  await new Promise((resolve) => {
    const frame = () => {
      if (running !== token) return resolve();
      const now = performance.now();
      let t = lastT + (now - lastWall) / 1000;
      lastWall = now;
      // follow the most recent playing video
      let drv = -1;
      for (const i of started) if (!ended.has(i) && P.clips[i].kind === "video" && i > drv) drv = i;
      if (drv >= 0) {
        const v = elOf(drv);
        if (!v.paused && v.readyState >= 2) { holdSince = null; t = Math.max(lastT, Math.min(t + 0.2, tm.starts[drv] + (v.currentTime - P.clips[drv].inT))); }
        else if (!v.ended) { holdSince ??= now; if (now - holdSince < 1500) t = lastT; }   // wait for it to start (max 1.5s)
      }
      lastT = t;
      P.clips.forEach((c, i) => {
        const s = tm.starts[i], e = s + c.len;
        if (t >= s && !started.has(i)) { started.add(i); if (c.kind === "video") elOf(i).play().catch(() => {}); }
        if (t >= e && !ended.has(i)) {
          ended.add(i);
          if (c.kind === "video") { elOf(i).pause(); gains[i % pool.length].gain.value = 0; }
          prepare(i + pool.length);
        }
        if (c.kind === "video" && started.has(i) && !ended.has(i)) {
          // tiny fades (30ms) at every cut = no clicks or pops; longer fades for dissolves
          const fi = Math.max(0.03, c.xfIn || 0), fo = Math.max(0.03, P.clips[i + 1]?.xfIn || 0);
          const a = Math.max(0, Math.min(1, (t - s) / fi, (e - t) / fo));
          gains[i % pool.length].gain.value = c.muted ? 0 : a * P.clipVol;
        }
      });
      drawAt(ctx, cw, ch, Math.min(t, tm.total - 0.02), tm);
      onProgress?.(t / Math.max(0.01, tm.total), t);
      if (t >= tm.total) return resolve();
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
  const c = P.clips[i];
  const off = Math.min(0.6, c.len / 2);
  if (c.kind === "video") {
    const v = elOf(i);
    const url = media.get(c.mediaId)?.url;
    if (v.dataset.url !== url) { v.dataset.url = url; v.src = url; await new Promise((r) => { v.onloadeddata = r; v.load(); setTimeout(r, 3000); }); }
    await new Promise((r) => { v.onseeked = r; v.currentTime = c.inT + off; setTimeout(r, 1500); });
  }
  drawAt(pctx, pv.width, pv.height, tm.starts[i] + off, tm);
}
$("playBtn").onclick = async () => {
  if (running) { stop(); $("playBtn").textContent = "▶"; return; }
  await unlock();
  $("playBtn").textContent = "❚❚";
  await run(pctx, pv.width, pv.height, { onProgress: (p, t) => { $("timeLabel").textContent = `${fmt(t)} / ${fmt(timing().total)}`; } });
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

function clipWords(c) {
  if (!c.speech) return "";
  return (transcripts.get(c.mediaId)?.words || []).filter((w) => (w.start + w.end) / 2 >= c.inT && (w.start + w.end) / 2 <= c.inT + c.len).map((w) => w.text).join(" ");
}

function renderTimeline() {
  const tm = timing();
  buildGroups(tm);
  $("totalLabel").textContent = `${P.clips.length} pieces · ${fmt(tm.total)}`;
  $("timeLabel").textContent = `0:00 / ${fmt(tm.total)}`;
  const PX = 34;
  $("trackVideo").replaceChildren(...P.clips.map((c, i) => {
    const m = media.get(c.mediaId);
    return el("button", { class: "tl-clip" + (i === selected ? " on" : "") + (c.speech ? " speech" : ""), style: { width: `${Math.max(56, c.len * PX)}px`, backgroundImage: m?.thumbUrl ? `url(${m.thumbUrl})` : "none" },
      onclick: () => { selected = i; refresh(); } },
      el("span", { class: "tl-len" }, `${c.len.toFixed(1)}s`), c.kind === "photo" ? el("span", { class: "tl-kind" }, "📷") : c.speech ? el("span", { class: "tl-kind" }, "🎙") : null,
      c.muted ? el("span", { class: "tl-kind" }, "🔇") : null);
  }), el("button", { class: "tl-add", onclick: openPicker }, "＋"));
  const titleW = Math.min(tm.total, look?.hook?.whole ? tm.total : 3.2) * PX;
  $("trackText").replaceChildren(P.title ? el("div", { class: "tl-bar text", style: { width: `${Math.max(60, titleW)}px` } }, "Aa " + P.title)
    : el("div", { class: "tl-empty" }, "no title"), P.captions && groups.length ? el("div", { class: "tl-bar caps", style: { width: `${Math.max(60, tm.total * PX - titleW)}px` } }, `${groups.length} captions`) : null);
  $("trackMusic").replaceChildren(music ? el("div", { class: "tl-bar music", style: { width: `${Math.max(60, tm.total * PX)}px` } }, "♫ " + music.name) : el("div", { class: "tl-empty" }, "no music"));
}

function renderClipPanel() {
  const c = P.clips[selected];
  const box = $("clipPanel");
  if (!c) { box.replaceChildren(el("p", { class: "small muted" }, "Add some clips to get started.")); return; }
  const m = media.get(c.mediaId);
  const maxLen = c.kind === "video" ? Math.max(0.5, c.duration) : 8;
  const lenIn = el("input", { type: "range", min: Math.min(0.4, maxLen), max: maxLen.toFixed(2), step: "0.1", value: c.len });
  const startIn = el("input", { type: "range", min: 0, max: Math.max(0, c.duration - c.len).toFixed(2), step: "0.05", value: c.inT, disabled: c.kind !== "video" || c.duration - c.len < 0.1 });
  const lenLabel = el("b", {}, `${c.len.toFixed(1)}s`), startLabel = el("b", {}, `${c.inT.toFixed(1)}s`);
  lenIn.onpointerdown = startIn.onpointerdown = () => remember();
  lenIn.oninput = () => { c.len = +(+lenIn.value).toFixed(2); if (c.inT + c.len > c.duration && c.kind === "video") c.inT = Math.max(0, c.duration - c.len); lenLabel.textContent = `${c.len.toFixed(1)}s`; renderTimeline(); autosave(); };
  startIn.oninput = () => { c.inT = +(+startIn.value).toFixed(2); startLabel.textContent = `${c.inT.toFixed(1)}s`; autosave(); };
  lenIn.onchange = startIn.onchange = () => refresh();
  const move = (d) => { const j = selected + d; if (j < 0 || j >= P.clips.length) return; remember(); [P.clips[selected], P.clips[j]] = [P.clips[j], P.clips[selected]]; selected = j; refresh(); };
  const said = clipWords(c);
  box.replaceChildren(...[
    el("div", { class: "cp-head" }, m?.thumbUrl ? el("img", { src: m.thumbUrl, alt: "" }) : null,
      el("div", {}, el("b", {}, `Piece ${selected + 1} of ${P.clips.length}`), el("div", { class: "small muted" },
        c.speech ? "Talking" : c.kind === "video" ? `B-roll · from a ${c.duration.toFixed(1)}s clip` : "Photo, with a gentle zoom"))),
    said ? el("p", { class: "said" }, `“${said}”`) : null,
    el("label", { class: "field" }, el("span", {}, "Length ", lenLabel), lenIn),
    c.kind === "video" ? el("label", { class: "field" }, el("span", {}, "Starts at ", startLabel, " into the clip"), startIn) : null,
    el("div", { class: "cp-actions" },
      el("button", { onclick: () => move(-1), disabled: selected === 0 }, "◀ Move"),
      el("button", { onclick: () => move(1), disabled: selected === P.clips.length - 1 }, "Move ▶"),
      c.kind === "video" ? el("button", { onclick: () => { remember(); c.muted = !c.muted; refresh(); } }, c.muted ? "🔇 Sound off" : "🔊 Sound on") : null,
      el("button", { onclick: () => { remember(); c.xfIn = c.xfIn ? 0 : DISSOLVE; refresh(); }, disabled: selected === 0 }, c.xfIn ? "Dissolve in ✓" : "Cut in"),
      el("button", { class: "danger", onclick: () => { remember(); P.clips.splice(selected, 1); selected = Math.max(0, selected - 1); refresh(); } }, "🗑 Remove"))].filter(Boolean));
}

function refresh() { renderTimeline(); renderClipPanel(); drawStill(); autosave(); updateUndo(); }

// ---------------- settings ----------------
document.querySelectorAll("[data-pace]").forEach((b) => b.onclick = () => { remember(); P.pace = b.dataset.pace; autoEdit(); markChips(); refresh(); });
document.querySelectorAll("[data-tr]").forEach((b) => b.onclick = () => { remember(); P.transition = b.dataset.tr; autoEdit(); markChips(); refresh(); });
function markChips() {
  document.querySelectorAll("[data-pace]").forEach((b) => b.classList.toggle("on", b.dataset.pace === P.pace));
  document.querySelectorAll("[data-tr]").forEach((b) => b.classList.toggle("on", b.dataset.tr === P.transition));
  $("capToggle").checked = P.captions;
}
$("capToggle").onchange = (e) => { P.captions = e.target.checked; refresh(); };
$("titleIn").oninput = (e) => { P.title = e.target.value; renderTimeline(); drawStill(); autosave(); };
$("goalIn").oninput = (e) => { P.goal = e.target.value; autosave(); };
$("clipVol").oninput = (e) => { P.clipVol = +e.target.value; autosave(); };
$("musicVol").oninput = (e) => { P.musicVol = +e.target.value; autosave(); };
$("flowBtn").onclick = () => understand();
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

async function applyLook() {
  const kit = await loadKit();
  let titleFont, subFont, capFont, pal;
  if (series) {
    const fonts = seriesFonts(series, PAIRINGS);
    pal = (PALETTES.find((p) => p.id === series.palette) || PALETTES[0]).colors;
    titleFont = fonts.title; subFont = fonts.sub;
    capFont = ["Allura", "Pinyon Script", "Caveat"].includes(fonts.sub.family) ? { family: "DM Sans", weight: 600 } : fonts.sub;
    look = { hook: { style: "series", y: TEXT_POSITIONS[series.position] ?? 0.16, font: titleFont, subFont, whole: series.showTitle === "whole",
      color: { pink: "accent", butter: "accent2", white: "light" }[series.titleColor] || "light", case: series.titleCase || "none",
      size: series.titleSize || "l", layout: series.layout || "stack", subStyle: series.subStyle || "pill" } };
    P.title = fillTemplate(series.title, series, P.ep);
    P.sub = fillTemplate(series.subtitle, series, P.ep);
  } else {
    const f = activeFonts(kit);
    pal = activePalette(kit).colors;
    titleFont = f.title; capFont = f.primary;
    look = { hook: { style: "series", y: 0.16, font: f.title, subFont: f.primary, whole: false, color: "light", case: "none", size: "l", layout: "stack", subStyle: "small" } };
    P.sub = "";
  }
  await loadFontsFor({ a: titleFont, b: subFont || titleFont, c: capFont });
  palette = { accent: pal.pink, accent2: pal.butter, ink: pal.deep, light: pal.text };
  capLook = { captions: { font: capFont.family, weight: capFont.weight || 600, size: 56, words: 4, upper: false, y: 0.74,
    color: "light", highlight: "accent2", stroke: null, strokeW: 0, style: "highlight", shadow: true, pop: false, punct: true } };
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
  $("styleChips").replaceChildren(
    el("button", { class: "chip" + (!series ? " on" : ""), onclick: async () => { series = null; P.seriesId = null; P.title = ""; await applyLook(); renderStyleChips(); refresh(); } }, "My brand"),
    ...list.map((s) => el("button", { class: "chip" + (series?.id === s.id ? " on" : ""), onclick: async () => { series = s; P.seriesId = s.id; P.ep.n = s.next || 1; await applyLook(); renderStyleChips(); refresh(); } }, `${s.emoji} ${s.name}`)));
}

async function renderHookIdeas() {
  const hb = (await db.getValue("hookbank", null)) || { favs: [], mine: [] };
  const said = P.sources.filter(isSpeech).map((id) => transcripts.get(id).words.map((w) => w.text).join(" ")).join(" ");
  const ideas = suggestHooks(said, { pillar: series?.pillar || null, n: 5, shuffleSeed: Math.floor(Math.random() * 9), mine: hb.mine, favs: hb.favs });
  $("hookIdeas").replaceChildren(...ideas.map((h) => el("button", { class: "chip", title: h.her ? `she's thinking: ${h.her}` : "", onclick: () => { P.title = h.text.replace(/\{n\}/g, P.ep.n); $("titleIn").value = P.title; renderTimeline(); drawStill(); autosave(); } }, h.text)));
}
$("moreHooks").onclick = renderHookIdeas;

// ---------------- add clips ----------------
async function openPicker() {
  const all = (await listMedia()).filter((m) => m.kind === "video" || m.kind === "photo");
  const picked = [];
  $("pickGrid").replaceChildren(...all.map((m) => {
    const b = el("button", { class: "pick-tile", style: { backgroundImage: m.thumb ? `url(${URL.createObjectURL(m.thumb)})` : "none" },
      onclick: () => { const k = picked.indexOf(m.id); k >= 0 ? picked.splice(k, 1) : picked.push(m.id); b.classList.toggle("on", picked.includes(m.id)); $("pickAdd").textContent = `Add ${picked.length}`; } },
      m.kind === "video" ? el("span", {}, `${Math.round(m.duration)}s`) : el("span", {}, "📷"));
    return b;
  }));
  $("pickAdd").textContent = "Add 0";
  $("pickAdd").onclick = async () => {
    if (!picked.length) return;
    remember();
    await loadMedia(picked);
    picked.forEach((id) => { if (media.has(id)) P.sources.push(id); });
    const from = P.clips.length;
    picked.forEach((id, k) => {
      if (!media.has(id)) return;
      if (isSpeech(id)) pushItems(P.clips, id, speechSegments(id));
      else { const b = brollItem(id, from + k, from + picked.length + 1); b.xfIn = P.clips.length && P.transition === "fade" ? DISSOLVE : 0; P.clips.push(b); }
    });
    $("picker").hidden = true; selected = Math.min(from, P.clips.length - 1); refresh();
    if (picked.some((id) => media.get(id)?.meta.kind === "video" && !transcripts.has(id))) $("flowStatus").textContent = "New clips added. Tap 🎙 to listen to them too.";
  };
  $("picker").hidden = false;
}
$("pickClose").onclick = () => ($("picker").hidden = true);

// ---------------- export ----------------
let lastFile = null;
$("exportBtn").onclick = async () => {
  if (!P.clips.length) return;
  stop();
  await unlock();
  $("exportBox").hidden = false; $("saveRow").hidden = true;
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
    await prepare(0);
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
      const s = await logEpisode(series.id, { n: P.ep.n, date: P.ep.date, word: P.ep.word, place: P.ep.place, clips: P.sources, title: P.title });
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
    if (!P.sources?.length) P.sources = [...new Set(P.clips.map((c) => c.mediaId))];
    await loadMedia(P.sources);
    P.clips = P.clips.filter((c) => media.has(c.mediaId));
    if (P.seriesId) series = await getSeries(P.seriesId);
    $("status").textContent = `Welcome back. Your draft from ${new Date(draft.saved).toLocaleString()} is here.`;
    await applyLook();
    if (draft.title) { P.title = draft.title; $("titleIn").value = P.title; }
  } else {
    await loadMedia(ids);
    P.sources = ids.filter((id) => media.has(id));
    const sid = params.get("series");
    if (sid) { series = await getSeries(sid); P.seriesId = sid; P.ep.n = series?.next || 1; }
    autoEdit();
    await applyLook();
  }
  const hasVideo = P.sources.some((id) => media.get(id)?.meta.kind === "video");
  const known = P.sources.filter((id) => media.get(id)?.meta.kind === "video").every((id) => transcripts.has(id));
  $("flowStatus").textContent = !hasVideo ? "Only photos, so no speech to listen to." : known ? speechSummary() || "These clips have no talking, so they're edited as b-roll."
    : "Talking in these clips? Tap below so the edit follows what you say: whole sentences, in order, with pauses, ums and restarts cut.";
  if (known) { $("flowBtn").textContent = "🎙 Listen again"; }
  $("storyBox").hidden = !P.sources.some(isSpeech);
  $("goalIn").value = P.goal || "";
  markChips();
  $("clipVol").value = P.clipVol; $("musicVol").value = P.musicVol;
  await renderStyleChips();
  renderHookIdeas();
  refresh();
  if (!P.clips.length) openPicker();
  window.__P = P; window.__transcripts = transcripts;
})();
