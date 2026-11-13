// The editing brain: reads the sound + words of a clip and decides what to cut and where to zoom.
// Everything runs on the phone. No servers, no cost.

// ---------- sound ----------

// Quick way: decode the sound straight from the file (works for many files, not all).
export async function analyseAudio(file) {
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  let audio;
  try {
    audio = await ctx.decodeAudioData(await file.arrayBuffer());
  } finally {
    ctx.close?.();
  }
  return analyseBuffer(audio);
}

// Turns any decoded sound into the 16 kHz copy + loudness map the editor needs.
export async function analyseBuffer(audio) {
  const len = Math.max(1, Math.ceil(audio.duration * 16000));
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  return { ...analysePCM(pcm, audio.duration), full: audio };
}

export function analysePCM(pcm, duration) {
  const hop = 320; // 20 ms at 16 kHz
  const n = Math.floor(pcm.length / hop);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = i * hop; j < (i + 1) * hop; j++) sum += pcm[j] * pcm[j];
    env[i] = 10 * Math.log10(sum / hop + 1e-10);
  }
  return { pcm, env, hop: hop / 16000, duration };
}

// Backup way (works on every iPhone video): quietly play the clip once and record its sound.
// `graph` comes from render.js audioGraph(video). Must be started from a tap.
export async function captureAudio(video, graph, onProgress) {
  const { ctx, src, monitor } = graph;
  if (ctx.state === "suspended") await ctx.resume();
  const proc = ctx.createScriptProcessor(4096, 1, 1);
  const parts = [];
  let recording = false;
  proc.onaudioprocess = (e) => { if (recording) parts.push(new Float32Array(e.inputBuffer.getChannelData(0))); };
  src.connect(proc);
  proc.connect(ctx.destination); // outputs silence; needed to keep it running
  monitor.gain.value = 0; // don't play out loud
  try {
    video.pause();
    if (video.currentTime > 0.01) {
      await new Promise((r) => { video.addEventListener("seeked", r, { once: true }); video.currentTime = 0; });
    }
    recording = true;
    await video.play();
    await new Promise((res, rej) => {
      let lastPos = -1, stuckSince = Date.now();
      const tick = () => {
        if (video.ended || video.currentTime >= video.duration - 0.05) return res();
        if (video.error) return rej(new Error("playback stopped"));
        if (video.currentTime !== lastPos) { lastPos = video.currentTime; stuckSince = Date.now(); }
        else if (Date.now() - stuckSince > 2500) {
          if (Date.now() - stuckSince > 12000) return rej(new Error("the video stopped playing"));
          if (video.paused) video.play().catch(() => {});   // nudge it if something paused it
        }
        onProgress?.(video.currentTime / video.duration);
        setTimeout(tick, 250);
      };
      tick();
    });
  } finally {
    recording = false;
    video.pause();
    src.disconnect(proc);
    proc.disconnect();
    monitor.gain.value = 1;
  }
  const total = parts.reduce((a, p) => a + p.length, 0);
  if (!total) throw new Error("no sound was recorded");
  const buf = ctx.createBuffer(1, total, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  let o = 0;
  for (const p of parts) { ch.set(p, o); o += p.length; }
  const analysis = await analyseBuffer(buf);
  analysis.duration = video.duration; // trust the video's own length
  return analysis;
}

function percentile(arr, p) {
  const s = Array.from(arr).sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * (s.length - 1))))];
}

// Quiet stretches longer than `pause` seconds become cuts (keeping `padding` either side).
export function silenceCuts(analysis, pacing) {
  const { env, hop, duration } = analysis;
  if (!env.length) return [];
  const floor = percentile(env, 0.1);
  const loud = percentile(env, 0.95);
  const thr = Math.max(floor + 0.3 * (loud - floor), -65);
  const minGap = pacing.pause, pad = pacing.padding;
  const cuts = [];
  let runStart = null;
  for (let i = 0; i <= env.length; i++) {
    const quiet = i < env.length && env[i] < thr;
    if (quiet && runStart === null) runStart = i;
    if (!quiet && runStart !== null) {
      const s = runStart * hop, e = Math.min(duration, i * hop);
      const atStart = runStart === 0, atEnd = i >= env.length;
      if (e - s >= (atStart || atEnd ? Math.min(minGap, 0.3) : minGap)) {
        const cs = atStart ? 0 : s + pad;
        const ce = atEnd ? duration : e - pad;
        if (ce - cs > 0.1) cuts.push({ start: cs, end: ce, reason: "pause" });
      }
      runStart = null;
    }
  }
  return cuts;
}

// ---------- words: free rules for bloopers ----------

const FILLERS = new Set(["um", "umm", "uh", "uhh", "uhm", "er", "erm", "hmm", "mm", "ah", "eh"]);
const STRONG_CUES = ["let me start again", "let me start over", "start again", "start over",
  "let me try again", "try that again", "let me redo that", "one more time", "take two",
  "cut that", "scratch that"];
const WEAK_CUES = ["hold on", "wait", "sorry", "oops", "whoops", "no no", "ugh"];
const CUES = [...STRONG_CUES, ...WEAK_CUES].map((c) => c.split(" "));

const norm = (t) => t.toLowerCase().replace(/[^a-z0-9']+/g, "");
const endsSentence = (t) => /[.!?…]\s*$/.test(t);

function splitPhrases(words) {
  const phrases = [];
  let cur = [];
  words.forEach((w, i) => {
    if (cur.length) {
      const prev = words[cur[cur.length - 1]];
      if (w.start - prev.end > 0.35 || endsSentence(prev.text)) { phrases.push(cur); cur = []; }
    }
    cur.push(i);
  });
  if (cur.length) phrases.push(cur);
  return phrases;
}

function similarity(a, b) { // share of matching words, in order (simple LCS ratio)
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return (2 * dp[m][n]) / (m + n || 1);
}

export function blooperCuts(words, pacing) {
  if (!words.length) return [];
  const n = words.map((w) => norm(w.text));
  const phrases = splitPhrases(words);
  const marked = new Map();
  const mark = (idxs, reason, note) => idxs.forEach((i) => { if (!marked.has(i)) marked.set(i, { reason, note }); });

  if (pacing.bloopers) {
    phrases.forEach((ph, pi) => {
      const toks = ph.map((i) => n[i]);
      // 1. restart cue at the end of a phrase
      for (const cue of CUES) {
        let found = -1;
        for (let p = toks.length - cue.length; p >= 0; p--) {
          if (cue.every((c, k) => toks[p + k] === c)) { found = p; break; }
        }
        if (found < 0 || toks.length - (found + cue.length) > 2) continue;
        let botched = ph.slice(0, found);
        if (!botched.some((i) => !FILLERS.has(n[i])) && pi > 0) botched = phrases[pi - 1];
        const next = phrases[pi + 1] || [];
        const overlap = new Set(botched.map((i) => n[i]).filter((t) => next.some((j) => n[j] === t) && !FILLERS.has(t)));
        const strong = STRONG_CUES.includes(cue.join(" "));
        if (strong || overlap.size >= 2) {
          mark([...botched, ...ph], "restart", `Restarted ("${words[ph[found]].text.replace(/[,.!?]/g, "").trim()}")`);
          return;
        }
        break;
      }
      // 2. repeated take: a later phrase starts the same way -> keep the later one
      const mine = ph.filter((i) => !FILLERS.has(n[i])).map((i) => n[i]);
      if (mine.length >= 2) {
        for (const later of phrases.slice(pi + 1, pi + 4)) {
          const theirs = later.filter((i) => !FILLERS.has(n[i])).map((i) => n[i]).slice(0, mine.length);
          if (theirs.length >= 2 && mine[0] === theirs[0] && mine[1] === theirs[1] && similarity(mine, theirs) >= 0.7) {
            mark(ph, "repeat", "Said again just after, kept the later take");
            return;
          }
        }
      }
      // 3. cut-off word like "gonna-"
      if (/[-–—]$/.test(words[ph[ph.length - 1]].text.trim()) && ph.length <= 6) mark(ph, "restart", "Cut off part-way");
    });
  }
  if (pacing.fillers) n.forEach((t, i) => { if (FILLERS.has(t)) mark([i], "filler", `"${words[i].text.trim()}"`); });

  // runs of marked words -> time ranges
  const idx = [...marked.keys()].sort((a, b) => a - b);
  const cuts = [];
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const f = run[0], l = run[run.length - 1];
    const prevEnd = f > 0 ? words[f - 1].end : 0;
    const nextStart = l + 1 < words.length ? words[l + 1].start : words[l].end + 0.3;
    cuts.push({ start: Math.max(prevEnd, words[f].start - 0.06), end: Math.min(nextStart, words[l].end + 0.06),
      reason: marked.get(f).reason, note: marked.get(f).note });
    run = [];
  };
  for (const i of idx) {
    if (run.length && (i !== run[run.length - 1] + 1 || marked.get(i).reason !== marked.get(run[0]).reason)) flush();
    run.push(i);
  }
  flush();
  return cuts;
}

// ---------- timeline ----------

const MIN_PIECE = 0.15;

export function keepSegments(duration, cuts) {
  const active = cuts.filter((c) => c.end > c.start).map((c) => [Math.max(0, c.start), Math.min(duration, c.end)])
    .sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of active) {
    if (merged.length && s <= merged[merged.length - 1][1] + 0.01) merged[merged.length - 1][1] = Math.max(merged[merged.length - 1][1], e);
    else merged.push([s, e]);
  }
  const keeps = [];
  let t = 0;
  for (const [s, e] of merged) { if (s - t >= MIN_PIECE) keeps.push({ start: t, end: s }); t = Math.max(t, e); }
  if (duration - t >= MIN_PIECE) keeps.push({ start: t, end: duration });
  return keeps;
}

// Jump-cut zooms: alternate punch-ins between kept sections, like most talking edits.
export function assignZooms(keeps, zoom) {
  const every = { off: 0, low: 3, medium: 2, high: 1 }[zoom.frequency] ?? 2;
  keeps.forEach((k, i) => {
    k.zoom = every && i % (every + 1) === every ? zoom.strength : 1;
    // long sections get a punch-in half way through
    if (every && k.end - k.start > 6 && k.zoom === 1) k.midZoom = (k.start + k.end) / 2;
  });
  return keeps;
}

export function zoomAt(keeps, t, strength) {
  const k = keeps.find((k) => t >= k.start - 0.02 && t <= k.end + 0.02);
  if (!k) return 1;
  if (k.midZoom && t >= k.midZoom) return strength;
  return k.zoom || 1;
}

export function outputTime(keeps, t) {
  let acc = 0;
  for (const k of keeps) {
    if (t < k.start) return acc;
    if (t <= k.end) return acc + (t - k.start);
    acc += k.end - k.start;
  }
  return acc;
}

export const totalLength = (keeps) => keeps.reduce((a, k) => a + (k.end - k.start), 0);

export function keptWords(words, keeps) {
  return words.filter((w) => {
    const mid = (w.start + w.end) / 2;
    return keeps.some((k) => mid >= k.start && mid <= k.end);
  });
}

export function groupWords(words, per) {
  const groups = [];
  let cur = [];
  for (const w of words) {
    if (cur.length) {
      const last = cur[cur.length - 1];
      if (cur.length >= per || w.start - last.end > 0.6 || endsSentence(last.text)) { groups.push(cur); cur = []; }
    }
    cur.push(w);
  }
  if (cur.length) groups.push(cur);
  groups.forEach((g, i) => {
    g.start = g[0].start;
    g.end = Math.min(g[g.length - 1].end + 0.3, groups[i + 1] ? groups[i + 1][0].start : Infinity);
  });
  return groups;
}

export function buildPlan({ analysis, words, pacing, look }) {
  const cuts = [...silenceCuts(analysis, pacing), ...blooperCuts(words || [], pacing)];
  const keeps = assignZooms(keepSegments(analysis.duration, cuts), look.zoom);
  const kept = keptWords(words || [], keeps);
  const counts = {};
  cuts.forEach((c) => (counts[c.reason] = (counts[c.reason] || 0) + 1));
  return { cuts, keeps, words: kept, groups: groupWords(kept, look.captions.words), counts,
    length: totalLength(keeps), original: analysis.duration };
}

// Turns the speech model's output into a clean word list.
export function wordsFromASR(out, duration) {
  const chunks = out?.chunks || [];
  const words = [];
  for (const c of chunks) {
    const text = (c.text || "").trim();
    if (!text) continue;
    let [s, e] = c.timestamp || [];
    if (s == null) continue;
    if (e == null) e = Math.min(duration, s + 0.4);
    words.push({ text, start: s, end: Math.max(e, s + 0.05) });
  }
  return words;
}
