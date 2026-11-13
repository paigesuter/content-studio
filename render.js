// Draws each frame (video + zoom + captions + hook), plays the edit, and records the final MP4.
import { zoomAt, outputTime, totalLength } from "./engine.js";

const HOOK_SECONDS = 3.2;

// ---------- text helpers ----------

function wrap(ctx, words, maxW) {
  const lines = [];
  let line = [];
  for (const w of words) {
    const test = [...line, w].map((x) => x.text).join(" ");
    if (line.length && ctx.measureText(test).width > maxW) { lines.push(line); line = []; }
    line.push(w);
  }
  if (line.length) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setShadow(ctx, on, k) {
  ctx.shadowColor = on ? "rgba(0,0,0,0.55)" : "transparent";
  ctx.shadowBlur = on ? 14 * k : 0;
  ctx.shadowOffsetY = on ? 3 * k : 0;
}

function cleanWord(text, cap) {
  let t = text.replace(/[{}\\]/g, "");
  if (!cap.punct) t = t.replace(/[.,!?;:…"]+$/g, "").replace(/^"+/, "");
  return cap.upper ? t.toUpperCase() : t;
}

// ---------- captions ----------

function drawCaptions(ctx, W, H, st, t) {
  const { plan, look, palette } = st;
  const cap = look.captions;
  if (!st.captionsOn || !plan.groups.length) return;
  const g = plan.groups.find((g) => t >= g.start && t < g.end);
  if (!g) return;
  const k = W / 1080;
  let active = -1;
  g.forEach((w, i) => { if (t >= w.start - 0.02) active = i; });
  const size = cap.size * k;
  ctx.font = `${cap.weight} ${size}px "${cap.font}"`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const items = g.map((w, i) => ({ text: cleanWord(w.text, cap), i }));
  const lines = wrap(ctx, items, W * 0.84);
  const lh = size * 1.18;
  const y0 = cap.y * H - ((lines.length - 1) * lh) / 2;
  const space = ctx.measureText(" ").width;

  ctx.save();
  if (cap.pop) {
    const p = Math.min(1, (t - g.start) / 0.12);
    const s = 1.12 - 0.12 * p;
    ctx.translate(W / 2, cap.y * H);
    ctx.scale(s, s);
    ctx.translate(-W / 2, -cap.y * H);
  }
  lines.forEach((line, li) => {
    const widths = line.map((it) => ctx.measureText(it.text).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (line.length - 1);
    let x = (W - total) / 2;
    const y = y0 + li * lh;
    line.forEach((it, j) => {
      const isActive = it.i === active && cap.style !== "plain";
      if (cap.style === "box" && isActive) {
        const pad = size * 0.16;
        ctx.fillStyle = palette[cap.box];
        roundRect(ctx, x - pad, y - size * 0.62, widths[j] + pad * 2, size * 1.2, size * 0.2);
        ctx.fill();
      }
      if (cap.stroke && !(cap.style === "box" && isActive)) {
        ctx.lineJoin = "round";
        ctx.lineWidth = cap.strokeW * k;
        ctx.strokeStyle = palette[cap.stroke];
        ctx.strokeText(it.text, x, y);
      }
      setShadow(ctx, cap.shadow, k);
      ctx.fillStyle = isActive ? palette[cap.highlight] : palette[cap.color];
      ctx.fillText(it.text, x, y);
      setShadow(ctx, false, k);
      x += widths[j] + space;
    });
  });
  ctx.restore();
}

// ---------- hook text ----------

function drawHook(ctx, W, H, st, outT) {
  const text = (st.hook || "").trim();
  if (!text) return;
  const style = st.look.hook.style;
  if (style !== "story" && outT > HOOK_SECONDS) return;
  const k = W / 1080;
  const p = st.palette;
  const words = text.split(/\s+/).map((t) => ({ text: t }));
  const alpha = style === "story" ? 1 : Math.min(1, outT / 0.2, (HOOK_SECONDS - outT) / 0.3 + 0.0001);
  ctx.save();
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let y = st.look.hook.y * H;

  const block = (font, color, lineH, list, opts = {}) => {
    ctx.font = font;
    const lines = wrap(ctx, list, W * (opts.maxW || 0.84));
    lines.forEach((ln) => {
      const s = ln.map((x) => x.text).join(" ");
      if (opts.label) {
        const w = ctx.measureText(s).width;
        ctx.fillStyle = opts.label;
        roundRect(ctx, (W - w) / 2 - 22 * k, y - lineH * 0.48, w + 44 * k, lineH * 0.96, 14 * k);
        ctx.fill();
      }
      if (opts.stroke) {
        ctx.lineJoin = "round"; ctx.lineWidth = opts.stroke * k; ctx.strokeStyle = p.ink; ctx.strokeText(s, W / 2, y);
      }
      setShadow(ctx, opts.shadow, k);
      ctx.fillStyle = color;
      ctx.fillText(s, W / 2, y);
      setShadow(ctx, false, k);
      y += lineH;
    });
  };

  if (style === "bold") {
    block(`900 ${72 * k}px Montserrat`, p.light, 84 * k, words.map((w) => ({ text: w.text.toUpperCase() })), { stroke: 14 });
  } else if (style === "label") {
    block(`800 ${58 * k}px Montserrat`, p.ink, 80 * k, words.map((w) => ({ text: w.text.toUpperCase() })), { label: p.accent, maxW: 0.8 });
  } else if (style === "serif") {
    const cut = Math.max(1, Math.round(words.length * 0.45));
    block(`italic 400 ${62 * k}px 'Playfair Display'`, p.accent, 72 * k, words.slice(0, cut), { shadow: true });
    block(`400 ${86 * k}px 'DM Serif Display'`, p.light, 92 * k, words.slice(cut), { shadow: true });
  } else if (style === "story") {
    block(`400 ${70 * k}px 'DM Serif Display'`, p.light, 74 * k, words.map((w) => ({ text: w.text.toLowerCase() })), { shadow: true, maxW: 0.86 });
  } else {
    block(`800 ${50 * k}px Inter`, p.light, 62 * k, words.map((w) => ({ text: w.text.toLowerCase() })), { shadow: true });
  }
  ctx.restore();
}

// ---------- one frame ----------

export function drawFrame(ctx, W, H, video, st, t = video.currentTime) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  if (!st.plan || !video.videoWidth) return;
  const z = zoomAt(st.plan.keeps, t, st.look.zoom.strength);
  const vw = video.videoWidth, vh = video.videoHeight;
  const scale = Math.max(W / vw, H / vh) * z;
  const dw = vw * scale, dh = vh * scale;
  const fy = z > 1 ? 0.38 : 0.5; // punch in slightly towards your face
  ctx.drawImage(video, (W - dw) * 0.5, (H - dh) * fy, dw, dh);
  drawCaptions(ctx, W, H, st, t);
  drawHook(ctx, W, H, st, outputTime(st.plan.keeps, t));
}

// ---------- sound routing (so the export can record the audio) ----------

export function audioGraph(video) {
  if (video._graph) {
    if (video._graph.ctx.state === "suspended") video._graph.ctx.resume();
    return video._graph;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const src = ctx.createMediaElementSource(video);
  const monitor = ctx.createGain();
  const dest = ctx.createMediaStreamDestination();
  src.connect(monitor).connect(ctx.destination);
  src.connect(dest);
  video._graph = { ctx, src, monitor, dest };
  return video._graph;
}

const seekTo = (video, t) => new Promise((res) => {
  if (Math.abs(video.currentTime - t) < 0.01) return res();
  const done = () => { video.removeEventListener("seeked", done); res(); };
  video.addEventListener("seeked", done);
  video.currentTime = t;
});

// ---------- preview player ----------

export class Player {
  constructor(video, canvas, getState, onEnd) {
    this.v = video; this.c = canvas; this.ctx = canvas.getContext("2d");
    this.getState = getState; this.onEnd = onEnd;
    this.playing = false; this.seeking = false; this.busy = false;
    this.v.addEventListener("seeked", () => { this.seeking = false; });
    const tick = () => {
      if (!this.busy) this.step();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  step() {
    const st = this.getState();
    const keeps = st.plan?.keeps;
    if (this.playing && keeps && !this.seeking) {
      const t = this.v.currentTime;
      const inside = keeps.find((k) => t >= k.start - 0.04 && t < k.end - 0.02);
      if (!inside) {
        const next = keeps.find((k) => k.start > t - 0.04);
        if (next) { this.seeking = true; this.v.currentTime = next.start; } else this.pause(true);
      }
    }
    drawFrame(this.ctx, this.c.width, this.c.height, this.v, st);
  }
  async play() {
    const keeps = this.getState().plan?.keeps;
    if (!keeps?.length) return;
    audioGraph(this.v);
    if (this.v.currentTime >= keeps[keeps.length - 1].end - 0.05) await seekTo(this.v, keeps[0].start);
    this.playing = true;
    try { await this.v.play(); } catch (e) { this.playing = false; throw e; }
  }
  pause(ended = false) {
    this.playing = false;
    this.v.pause();
    if (ended) this.onEnd?.();
  }
  async seekStart() {
    const keeps = this.getState().plan?.keeps;
    if (keeps?.length) await seekTo(this.v, keeps[0].start);
  }
}

// ---------- export ----------

export function pickMime() {
  const options = ["video/mp4;codecs=avc1.640028,mp4a.40.2", "video/mp4;codecs=avc1,mp4a", "video/mp4",
    "video/webm;codecs=vp9,opus", "video/webm"];
  return options.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "";
}

export async function exportVideo(video, getState, onProgress) {
  const st = getState();
  const keeps = st.plan.keeps;
  const total = totalLength(keeps);
  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const graph = audioGraph(video);
  graph.monitor.gain.value = 0; // export silently

  const mime = pickMime();
  const stream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...graph.dest.stream.getAudioTracks()]);
  const rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 160_000 });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((res) => (rec.onstop = res));

  let drawing = true;
  const draw = () => { if (!drawing) return; drawFrame(ctx, W, H, video, st); requestAnimationFrame(draw); };

  video.pause();
  await seekTo(video, keeps[0].start);
  draw();
  rec.start(1000);
  let done = 0;
  try {
    for (let i = 0; i < keeps.length; i++) {
      const k = keeps[i];
      if (i > 0) {
        rec.pause();
        await seekTo(video, k.start);
        drawFrame(ctx, W, H, video, st);
        await new Promise((r) => setTimeout(r, 40));
        rec.resume();
      }
      await video.play();
      await new Promise((res) => {
        const check = () => {
          if (video.currentTime >= k.end - 0.03 || video.ended) { video.pause(); res(); return; }
          onProgress?.(Math.min(0.99, (done + video.currentTime - k.start) / total));
          requestAnimationFrame(check);
        };
        check();
      });
      done += k.end - k.start;
    }
  } finally {
    rec.stop();
    await stopped;
    drawing = false;
    graph.monitor.gain.value = 1;
  }
  onProgress?.(1);
  const type = (mime || "video/mp4").split(";")[0];
  return { blob: new Blob(chunks, { type }), ext: type.includes("webm") ? "webm" : "mp4" };
}
