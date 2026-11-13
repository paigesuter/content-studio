import { analyseAudio, captureAudio, buildPlan, wordsFromASR } from "./engine.js";
import { LOOKS, PALETTES, FONT_LOADS } from "./looks.js";
import { Player, drawFrame, exportVideo, audioGraph } from "./render.js";

import { loadKit, registerCustomFonts } from "./brand.js";
import { activeFonts, activePalette, googleFontsHref, loadFontsFor } from "./kit.js";
import { getBlob, listMedia } from "./library.js";
import { getSeries, fillTemplate, logEpisode, TEXT_POSITIONS, seriesFonts, needsWord, needsPlace } from "./series.js";
import { PAIRINGS as KIT_PAIRINGS, PALETTES as KIT_PALETTES } from "./kit.js";
import { suggestHooks } from "./hooks.js";
import { loadBrand } from "./brand.js";

const $ = (id) => document.getElementById(id);
const TEST = new URLSearchParams(location.search).has("test");
const saved = (() => { try { return JSON.parse(localStorage.getItem("cs-prefs") || "{}"); } catch { return {}; } })();

const state = {
  look: LOOKS.find((l) => l.id === saved.look) || LOOKS[0],
  palette: PALETTES.find((p) => p.id === saved.palette) || PALETTES[0],
  hook: "", captionsOn: true, bloopers: true, fillers: true, pauseOverride: null,
  analysis: null, words: [], plan: null, file: null,
};
const getState = () => state;
const savePrefs = () => { try { localStorage.setItem("cs-prefs", JSON.stringify({ look: state.look.id, palette: state.palette.id })); } catch {} };

const video = $("video");
const player = new Player(video, $("preview"), getState, () => ($("playBtn").hidden = false));
let wakeLock = null;
const keepAwake = async (on) => {
  try {
    if (on && "wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
  } catch {}
};

const fmt = (s) => { s = Math.max(0, s || 0); const m = Math.floor(s / 60); return `${m}:${String(Math.round(s - m * 60)).padStart(2, "0")}`; };
const setStatus = (html) => { $("status").innerHTML = html; };
const REASONS = { pause: "pauses", restart: "restarts", repeat: "repeated lines", filler: "ums" };

// ---------- build the edit ----------

function rebuild() {
  if (!state.analysis) return;
  const look = state.look;
  const pacing = { pause: state.pauseOverride ?? look.pacing.pause, padding: look.pacing.padding,
    bloopers: state.bloopers, fillers: state.fillers };
  state.plan = buildPlan({ analysis: state.analysis, words: state.words, pacing, look });
  $("pause").value = pacing.pause;
  $("pauseVal").textContent = `${pacing.pause.toFixed(2)} s`;
  const p = state.plan;
  const counts = Object.entries(p.counts).map(([k, v]) => `${v} ${REASONS[k] || k}`).join(" · ");
  $("stats").innerHTML = `<b>${fmt(p.original)}</b> raw → <b>${fmt(p.length)}</b> edited` +
    (counts ? `<br><span class="small muted">Cut: ${counts}</span>` : "");
}

// ---------- controls ----------

function renderLooks() {
  $("looks").replaceChildren(...LOOKS.map((l) => {
    const b = document.createElement("button");
    b.className = "chip" + (l.id === state.look.id ? " on" : "");
    b.textContent = l.name;
    b.onclick = () => chooseLook(l);
    return b;
  }));
  $("lookBlurb").textContent = state.look.blurb;
}
function chooseLook(l) { state.look = l; state.pauseOverride = null; savePrefs(); renderLooks(); rebuild(); }

function renderPalettes() {
  $("palettes").replaceChildren(...PALETTES.map((p) => {
    const b = document.createElement("button");
    b.className = "swatch" + (p.id === state.palette.id ? " on" : "");
    b.innerHTML = `<div class="dots">${[p.accent, p.accent2, p.ink, p.light].map((c) => `<i style="background:${c}"></i>`).join("")}</div><span>${p.name}</span>`;
    b.onclick = () => { state.palette = p; savePrefs(); renderPalettes(); };
    return b;
  }));
}

$("hook").oninput = (e) => { state.hook = e.target.value; };
$("optCaptions").onchange = (e) => { state.captionsOn = e.target.checked; };
$("optBloopers").onchange = (e) => { state.bloopers = e.target.checked; rebuild(); };
$("optFillers").onchange = (e) => { state.fillers = e.target.checked; rebuild(); };
$("pause").oninput = (e) => { state.pauseOverride = parseFloat(e.target.value); rebuild(); };

$("playBtn").onclick = async () => {
  try { await player.play(); $("playBtn").hidden = true; } catch (e) { setStatus("Couldn't play: " + e.message); }
};
$("preview").onclick = () => { if (player.playing) { player.pause(); $("playBtn").hidden = false; } };
$("newClip").onclick = () => $("file").click();

// ---------- loading a clip ----------

$("file").onchange = (e) => { const f = e.target.files[0]; e.target.value = ""; if (f) loadClip(f); };

async function loadClip(file) {
  player.pause();
  state.file = file; state.words = []; state.analysis = null; state.plan = null;
  $("start").hidden = true; $("studio").hidden = false; $("newClip").hidden = false;
  $("exportBox").hidden = true; $("playBtn").hidden = false;
  setStatus("Opening your clip…");
  if (video.src) URL.revokeObjectURL(video.src);
  video.src = URL.createObjectURL(file);
  await new Promise((res, rej) => {
    video.onloadedmetadata = res;
    video.onerror = () => rej(new Error("This video couldn't be opened"));
    video.load();
    setTimeout(res, 8000);
  }).catch((e) => setStatus(e.message));
  setStatus("Finding the pauses…");
  try {
    if (TEST && new URLSearchParams(location.search).has("scan")) throw new Error("test: force scan");
    state.analysis = await analyseAudio(file);
  } catch (e) {
    // Safari often can't decode iPhone .MOV sound directly, so use the backup way (needs a tap).
    askToScan(e);
    return;
  }
  afterAnalysis();
}

function afterAnalysis() {
  rebuild();
  player.seekStart();
  listen();
}

function askToScan(err) {
  setStatus(`<button id="scanBtn" class="scan-btn">Tap to scan the sound</button><br>
    <span class="small">The app plays your clip once, silently, to hear where you talk (takes as long as the clip).</span>`);
  $("scanBtn").onclick = async () => {
    try {
      const graph = audioGraph(video);
      await keepAwake(true);
      state.analysis = await captureAudio(video, graph, (p) => setStatus(`Scanning the sound… <b>${Math.round(p * 100)}%</b><br>Keep this screen open.`));
      afterAnalysis();
    } catch (e) {
      setStatus(`Couldn't read the sound in this clip (${e.message || e}). Is it a video with audio?`);
    } finally {
      keepAwake(false);
    }
  };
}

// ---------- captions (speech-to-text on the phone) ----------

function listen() {
  if (TEST) { gotWords(window.__fakeWords || []); return; }
  setStatus("Getting captions ready…");
  keepAwake(true);
  const worker = new Worker("./listen-worker.js", { type: "module" });
  const files = {};
  const started = Date.now();
  let timer = null;
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === "download") {
      files[m.file] = m;
      const loaded = Object.values(files).reduce((a, f) => a + f.loaded, 0);
      const total = Object.values(files).reduce((a, f) => a + f.total, 0);
      setStatus(`Downloading the speech model (first time only): <b>${Math.round((loaded / total) * 100)}%</b>`);
    } else if (m.type === "listening") {
      timer = setInterval(() => setStatus(`Listening to your clip for captions… <b>${Math.round((Date.now() - started) / 1000)}s</b><br>You can already play the preview.`), 1000);
    } else if (m.type === "done") {
      clearInterval(timer); worker.terminate(); keepAwake(false);
      gotWords(wordsFromASR(m.out, state.analysis.duration));
    } else if (m.type === "error") {
      clearInterval(timer); worker.terminate(); keepAwake(false);
      setStatus(`Captions didn't work this time (${m.message}). Pauses are still cut.`);
    }
  };
  worker.onerror = (e) => { setStatus(`Captions couldn't start (${e.message || "unknown error"}). Pauses are still cut.`); keepAwake(false); };
  worker.postMessage({ pcm: state.analysis.pcm });
}

function gotWords(words) {
  state.words = words;
  rebuild();
  if (!series && !state.hook && state.plan.words.length) {
    // Suggest your first (clean, kept) sentence as the hook
    const first = [];
    for (const w of state.plan.words) { first.push(w.text); if (/[.!?]$/.test(w.text) || first.length >= 9) break; }
    state.hook = first.join(" ").replace(/[.!?,]$/, "");
    $("hook").value = state.hook;
  }
  setStatus(words.length ? "Captions ready ✓ Tap play, or try other looks." : "No speech found, so there are no captions. Pauses are still cut.");
  showHookIdeas();
}

// ---------- hook ideas: your hook bank + Ask Claude ----------
let shuffleN = 0;
const transcript = () => (state.plan?.words || []).map((w) => w.text).join(" ");
function useHook(text, btn) {
  const t = text.replace(/\{n\}/g, series ? ep.n : "").replace(/\s{2,}/g, " ").trim();
  state.hook = t; $("hook").value = t;
  document.querySelectorAll(".idea.on").forEach((b) => b.classList.remove("on"));
  btn?.classList.add("on");
  player.step();
}
function ideaButton(text, sub) {
  const b = document.createElement("button");
  b.className = "idea";
  b.textContent = text;
  if (sub) { const sm = document.createElement("small"); sm.textContent = sub; b.append(sm); }
  b.onclick = () => useHook(text, b);
  return b;
}
function showHookIdeas() {
  $("askClaude").disabled = !state.analysis;
  const list = suggestHooks(transcript(), { pillar: series?.pillar || null, n: 5, shuffleSeed: shuffleN });
  $("ideasNote").textContent = state.words.length ? "From your hook bank, matched to what you said. Tap one to use it." : "From your hook bank. Tap one to use it.";
  $("hookIdeas").replaceChildren(...list.map((h) => ideaButton(h.text, h.t)));
}
$("shuffleHooks").onclick = () => { shuffleN++; showHookIdeas(); };

async function buildPrompt() {
  const b = await loadBrand();
  const lines = (arr) => (arr || []).map((x) => `- ${x}`).join("\n");
  const length = state.plan ? Math.round(state.plan.length) : 0;
  return `I'm Paige (@paigesuterx). I just edited this video in my content studio. Write hooks and captions for it in MY voice.

ABOUT ME
Message: ${b.identity.message}
Who I am: ${b.identity.oneLiner}
My audience: ${b.audience.who} Their biggest thought: "${b.audience.innerThought}"
My pillars: ${b.pillars.map((p) => p.name).join(", ")}
How I write:
${lines(b.voice.style)}
Tone examples (learn the vibe, don't reuse): ${(b.voice.examples || []).join(" / ")}
Never sound like: ${(b.voice.avoidTone || []).join(", ")}
Banned phrases: ${(b.voice.bannedPhrases || []).join(", ")}
${(b.rules || []).length ? "Rules from my feedback:\n" + lines(b.rules) + "\n" : ""}
THIS VIDEO
${series ? `Series: ${series.name} (episode ${ep.n}${series.total ? " of " + series.total : ""})${ep.word ? ", feeling: " + ep.word : ""}${ep.place ? ", place: " + ep.place : ""}` : "Not part of a series"}
Edited length: about ${length} seconds
What I say (transcript): "${transcript() || "(no speech, it's a visual video)"}"

Reply with ONLY one JSON code block, exactly this shape:
\`\`\`json
{"summary": "one line: what this video is about",
 "hooks": [{"text": "on-screen hook, max ~10 words", "why": "few words"}],
 "onscreen": ["other short text-on-screen ideas"],
 "captions": [{"style": "short & cheeky", "text": "..."}, {"style": "casual & funny", "text": "..."}, {"style": "reflective", "text": "..."}, {"style": "storytelling", "text": "..."}],
 "hashtags": ["only if they genuinely fit, else empty"]}
\`\`\`
Give 8 hooks. Hooks must relate to what I actually said. Lowercase is fine. No life-coach tone, no banned phrases, no excessive exclamation marks.`;
}

$("askClaude").onclick = async () => {
  $("promptBox").textContent = await buildPrompt();
  $("replyMsg").textContent = "";
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
  showClaudeResults(data);
  $("claudeSheet").hidden = true;
};

function showClaudeResults(d) {
  const box = $("claudeResults");
  const h = (t) => { const e = document.createElement("h3"); e.className = "res-h"; e.textContent = t; return e; };
  const nodes = [];
  if (d.summary) { const p = document.createElement("p"); p.className = "small muted"; p.textContent = d.summary; nodes.push(p); }
  if (d.hooks?.length) { nodes.push(h("✧ Claude's hooks for this video")); d.hooks.forEach((x) => nodes.push(ideaButton(x.text || String(x), x.why))); }
  if (d.onscreen?.length) { nodes.push(h("More text-on-screen ideas")); d.onscreen.forEach((x) => nodes.push(ideaButton(String(x)))); }
  if (d.captions?.length) {
    nodes.push(h("Captions for your post"));
    d.captions.forEach((c) => {
      const card = document.createElement("div"); card.className = "cap-card";
      const st = document.createElement("div"); st.className = "cap-style"; st.textContent = c.style || "caption";
      const p = document.createElement("p"); p.textContent = c.text || String(c);
      const btn = document.createElement("button"); btn.className = "ghost"; btn.textContent = "Copy caption";
      btn.onclick = async () => { try { await navigator.clipboard.writeText(p.textContent + (d.hashtags?.length ? "\n\n" + d.hashtags.map((t) => (t.startsWith("#") ? t : "#" + t)).join(" ") : "")); btn.textContent = "Copied ✓"; } catch { btn.textContent = "Select & copy manually"; } };
      card.append(st, p, btn); nodes.push(card);
    });
    if (d.hashtags?.length) { const p = document.createElement("p"); p.className = "small muted"; p.textContent = "Hashtags (added when you copy): " + d.hashtags.join(" "); nodes.push(p); }
  }
  box.replaceChildren(...nodes);
}

// ---------- compare all looks ----------

$("compareBtn").onclick = async () => {
  if (!state.analysis) return;
  player.pause(); $("playBtn").hidden = false;
  // Show a moment with captions on screen
  const g = state.plan.groups[Math.min(2, state.plan.groups.length - 1)];
  const t = g ? g.start + 0.15 : video.currentTime;
  await new Promise((res) => { video.onseeked = res; video.currentTime = t; setTimeout(res, 1500); });
  const grid = $("compareGrid");
  grid.replaceChildren();
  for (const look of LOOKS) {
    const pacing = { pause: look.pacing.pause, padding: look.pacing.padding, bloopers: state.bloopers, fillers: state.fillers };
    const plan = buildPlan({ analysis: state.analysis, words: state.words, pacing, look });
    const c = document.createElement("canvas");
    c.width = 270; c.height = 480;
    drawFrame(c.getContext("2d"), 270, 480, video, { ...state, look, plan }, t);
    const b = document.createElement("button");
    b.className = look.id === state.look.id ? "on" : "";
    b.append(c, Object.assign(document.createElement("b"), { textContent: look.name }));
    b.onclick = () => { chooseLook(look); $("compare").hidden = true; };
    grid.append(b);
  }
  $("compare").hidden = false;
};
$("closeCompare").onclick = () => ($("compare").hidden = true);

// ---------- export ----------

let lastFile = null;
$("exportBtn").onclick = async () => {
  if (!state.plan?.keeps.length) return;
  player.pause(); $("playBtn").hidden = false;
  $("exportBtn").disabled = true; $("exportBox").hidden = false; $("saveRow").hidden = true;
  $("exportMsg").textContent = "Making your video… keep this screen open (it plays through once).";
  await keepAwake(true);
  try {
    const { blob, ext } = await exportVideo(video, getState, (p) => ($("exportBar").style.width = `${Math.round(p * 100)}%`));
    lastFile = new File([blob], `reel-${state.look.id}.${ext}`, { type: blob.type });
    const url = URL.createObjectURL(blob);
    $("dlLink").href = url; $("dlLink").download = lastFile.name;
    $("saveBtn").hidden = !(navigator.canShare && navigator.canShare({ files: [lastFile] }));
    $("saveRow").hidden = false;
    $("exportMsg").textContent = `Done! ${(blob.size / 1e6).toFixed(1)} MB. Tap Save to Photos, then choose “Save Video”.`;
    if (series) {
      const clipId = new URLSearchParams(location.search).get("clip");
      const updated = await logEpisode(series.id, { n: ep.n, date: ep.date, word: ep.word, place: ep.place, clip: clipId, title: state.hook });
      if (updated) { $("exportMsg").textContent += ` Logged as ${series.name} #${ep.n} ✓`; series = updated; }
    }
  } catch (e) {
    $("exportMsg").textContent = "Something went wrong making the video: " + e.message;
  } finally {
    $("exportBtn").disabled = false;
    keepAwake(false);
  }
};
$("saveBtn").onclick = async () => {
  try { await navigator.share({ files: [lastFile] }); } catch {}
};

// ---------- start ----------

// "My brand" look + palette, built from the Brand Kit you approved in the studio.
async function addBrandLook() {
  try {
    const kit = await loadKit();
    if (!kit.approved) return;
    await registerCustomFonts();
    const fonts = activeFonts(kit);
    const pal = activePalette(kit).colors;
    await loadFontsFor(fonts);
    const brandPalette = { id: "brand", name: "My brand", accent: pal.pink, accent2: pal.butter, ink: pal.deep, light: pal.text };
    const brandLook = {
      id: "brand", name: "My brand", blurb: "Your approved fonts and colours: clean white captions, butter highlight, title-font hook",
      captions: { font: fonts.primary.family, weight: fonts.primary.weight || 600, size: 60, words: 4, upper: false, y: 0.74,
        color: "light", highlight: "accent2", stroke: null, strokeW: 0, style: "highlight", shadow: true, pop: false, punct: true },
      hook: { style: "custom", y: 0.16, font: fonts.title },
      zoom: { frequency: "low", strength: 1.08 },
      pacing: { pause: 0.55, padding: 0.12 },
    };
    LOOKS.unshift(brandLook);
    PALETTES.unshift(brandPalette);
    if (!saved.look) state.look = brandLook;
    if (!saved.palette) state.palette = brandPalette;
    if (saved.look === "brand") state.look = brandLook;
    if (saved.palette === "brand") state.palette = brandPalette;
  } catch (e) { console.warn("brand look unavailable", e); }
}

// ---------- series mode: the episode template is applied automatically ----------
let series = null;
const ep = { n: 1, date: new Date().toISOString().slice(0, 10), word: "", place: "" };

async function applySeries(id) {
  series = await getSeries(id);
  if (!series) return;
  const fonts = seriesFonts(series, KIT_PAIRINGS);
  const pal = (KIT_PALETTES.find((p) => p.id === series.palette) || KIT_PALETTES[0]).colors;
  const capFont = fonts.sub.family === "Allura" || fonts.sub.family === "Pinyon Script" ? { family: "DM Sans", weight: 600 } : fonts.sub;
  await loadFontsFor({ a: fonts.title, b: fonts.sub, c: capFont });
  const look = {
    id: "series", name: `${series.emoji} ${series.name}`, blurb: "Your saved series template",
    captions: { font: capFont.family, weight: capFont.weight || 600, size: 58, words: 4, upper: false,
      y: series.position === "bottom" ? 0.62 : 0.76, color: "light", highlight: "accent2", stroke: null, strokeW: 0,
      style: "highlight", shadow: true, pop: false, punct: true },
    hook: { style: "series", y: TEXT_POSITIONS[series.position] ?? 0.16, font: fonts.title, subFont: fonts.sub, whole: series.showTitle === "whole",
      color: { pink: "accent", butter: "accent2", white: "light" }[series.titleColor] || "light", case: series.titleCase || "none",
      size: series.titleSize || "l", layout: series.layout || "stack", subStyle: series.subStyle || "pill" },
    zoom: { frequency: series.zoom || "off", strength: 1.08 },
    pacing: { pause: series.pause || 0.6, padding: 0.12 },
  };
  const palette = { id: "series", name: series.name, accent: pal.pink, accent2: pal.butter, ink: pal.deep, light: pal.text };
  LOOKS.unshift(look);
  PALETTES.unshift(palette);
  state.look = look;
  state.palette = palette;
  state.captionsOn = !!series.captions;
  $("optCaptions").checked = state.captionsOn;
  ep.n = series.next || 1;
  renderEpisodeBox();
}

function updateSeriesText() {
  if (!series) return;
  state.hook = fillTemplate(series.title, series, ep);
  state.sub = fillTemplate(series.subtitle, series, ep);
  $("hook").value = state.hook;
}

function renderEpisodeBox() {
  const box = $("episodeBox");
  box.hidden = false;
  const field = (label, key, type = "text", ph = "") => {
    const input = Object.assign(document.createElement("input"), { type, value: ep[key], placeholder: ph });
    input.oninput = () => { ep[key] = type === "number" ? parseInt(input.value || "1", 10) : input.value; updateSeriesText(); };
    const l = document.createElement("label"); l.append(label, input); return l;
  };
  const grid = document.createElement("div"); grid.className = "ep-grid";
  grid.append(field(series.total ? `Episode (of ${series.total})` : "Episode", "n", "number"), field("Date", "date", "date"));
  if (needsWord(series)) grid.append(field("Feeling (one word)", "word", "text", "e.g. strong"));
  if (needsPlace(series)) grid.append(field("Place", "place", "text", "e.g. uluwatu"));
  const h = document.createElement("h2"); h.textContent = `${series.emoji} ${series.name}`;
  box.replaceChildren(h, grid);
  updateSeriesText();
}

(async () => {
  document.head.append(Object.assign(document.createElement("link"), { rel: "stylesheet", href: googleFontsHref() }));
  await addBrandLook();
  const seriesId = new URLSearchParams(location.search).get("series");
  if (seriesId) await applySeries(seriesId);
  renderLooks();
  renderPalettes();
  Promise.all(FONT_LOADS.map((f) => document.fonts.load(f).catch(() => {}))).then(() => player.step());
  // Opened from the studio library?
  const clipId = new URLSearchParams(location.search).get("clip");
  if (clipId) {
    const blob = await getBlob(clipId);
    const meta = (await listMedia()).find((m) => m.id === clipId);
    if (blob) loadClip(new File([blob], meta?.name || "clip.mov", { type: blob.type || meta?.type || "video/quicktime" }));
    else setStatus("That clip isn't in your library any more.");
  }
})();
window.__state = state; // handy for testing
