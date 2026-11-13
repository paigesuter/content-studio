import { analyseAudio, captureAudio, buildPlan, wordsFromASR } from "./engine.js";
import { LOOKS, PALETTES, FONT_LOADS } from "./looks.js";
import { Player, drawFrame, exportVideo, audioGraph } from "./render.js";

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
  if (!state.hook && state.plan.words.length) {
    // Suggest your first (clean, kept) sentence as the hook
    const first = [];
    for (const w of state.plan.words) { first.push(w.text); if (/[.!?]$/.test(w.text) || first.length >= 9) break; }
    state.hook = first.join(" ").replace(/[.!?,]$/, "");
    $("hook").value = state.hook;
  }
  setStatus(words.length ? "Captions ready ✓ Tap play, or try other looks." : "No speech found, so there are no captions. Pauses are still cut.");
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

renderLooks();
renderPalettes();
Promise.all(FONT_LOADS.map((f) => document.fonts.load(f).catch(() => {}))).then(() => player.step());
window.__state = state; // handy for testing
