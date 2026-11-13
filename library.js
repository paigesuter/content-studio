// My Footage: imports photos & videos (as copies), makes thumbnails, reads length/size/orientation.
import { db, uid, askToKeep } from "./db.js";

const THUMB_W = 360;

function orientationOf(w, h) {
  if (!w || !h) return "unknown";
  const r = w / h;
  if (r < 0.9) return "portrait";
  if (r > 1.1) return "landscape";
  return "square";
}

function canvasToBlob(canvas) {
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.8));
}

function drawThumb(src, w, h) {
  const scale = THUMB_W / w;
  const c = document.createElement("canvas");
  c.width = THUMB_W;
  c.height = Math.round(h * scale);
  c.getContext("2d").drawImage(src, 0, 0, c.width, c.height);
  return canvasToBlob(c);
}

async function videoInfo(file) {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true; v.playsInline = true; v.preload = "auto"; v.src = url;
  try {
    await new Promise((res, rej) => {
      v.onloadedmetadata = res;
      v.onerror = () => rej(new Error("This video couldn't be opened"));
      setTimeout(() => rej(new Error("This video took too long to open")), 20000);
    });
    const info = { duration: v.duration, width: v.videoWidth, height: v.videoHeight, thumb: null };
    // grab a frame ~10% in (iPhone Safari sometimes needs a moment)
    try {
      await new Promise((res) => {
        v.onseeked = res;
        v.currentTime = Math.min(1, (v.duration || 1) * 0.1);
        setTimeout(res, 4000);
      });
      if (v.videoWidth) info.thumb = await drawThumb(v, v.videoWidth, v.videoHeight);
    } catch {}
    return info;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function photoInfo(file) {
  let bmp;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    const url = URL.createObjectURL(file);
    try {
      bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("This photo couldn't be opened")); i.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
  }
  const w = bmp.width, h = bmp.height;
  const thumb = await drawThumb(bmp, w, h);
  bmp.close?.();
  return { width: w, height: h, thumb, duration: 0 };
}

// Imports files one by one, reporting progress. Returns the new items.
export async function importFiles(files, { folderId = null, onProgress } = {}) {
  await askToKeep();
  const added = [];
  const errors = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    onProgress?.({ index: i, total: files.length, name: f.name });
    const isVideo = f.type.startsWith("video/") || /\.(mov|mp4|m4v|webm)$/i.test(f.name);
    const isPhoto = f.type.startsWith("image/") || /\.(jpe?g|png|heic|heif|webp)$/i.test(f.name);
    if (!isVideo && !isPhoto) { errors.push(`${f.name}: not a photo or video`); continue; }
    try {
      const info = isVideo ? await videoInfo(f) : await photoInfo(f);
      const id = uid();
      await db.put("blobs", { id, blob: f });
      const item = {
        id, kind: isVideo ? "video" : "photo", name: f.name, type: f.type, size: f.size,
        added: new Date().toISOString(), taken: f.lastModified ? new Date(f.lastModified).toISOString() : null,
        duration: info.duration || 0, width: info.width, height: info.height,
        orientation: orientationOf(info.width, info.height), thumb: info.thumb,
        folders: folderId ? [folderId] : [], tags: [], favourite: false,
      };
      await db.put("media", item);
      added.push(item);
    } catch (e) {
      errors.push(`${f.name}: ${e.message || "couldn't be added"}${/quota|full/i.test(String(e)) ? " (storage full)" : ""}`);
    }
  }
  onProgress?.({ index: files.length, total: files.length });
  return { added, errors };
}

export async function listMedia() {
  const items = await db.all("media");
  return items.sort((a, b) => (a.added < b.added ? 1 : -1));
}

export async function getBlob(id) {
  return (await db.get("blobs", id))?.blob || null;
}

export async function removeMedia(id) {
  await db.del("media", id);
  await db.del("blobs", id);
}

export async function updateMedia(item) {
  await db.put("media", item);
}

// ---------- folders ----------

export const DEFAULT_FOLDERS = ["Bali", "Australia", "Travel", "Fashion", "Pilates", "Daily vlogs", "Brand collabs", "Inspiration", "Brand assets"];

export async function listFolders() {
  let folders = await db.all("folders");
  if (!folders.length) {
    const t0 = Date.now();
    folders = DEFAULT_FOLDERS.map((name, i) => ({ id: uid() + i, name, created: new Date(t0 + i).toISOString() }));
    for (const f of folders) await db.put("folders", f);
  }
  return folders.sort((a, b) => a.created.localeCompare(b.created));
}

export async function addFolder(name) {
  const f = { id: uid(), name, created: new Date().toISOString() };
  await db.put("folders", f);
  return f;
}

export async function removeFolder(id) {
  await db.del("folders", id);
  for (const m of await db.all("media")) {
    if (m.folders?.includes(id)) { m.folders = m.folders.filter((x) => x !== id); await db.put("media", m); }
  }
}

export const fmtDuration = (s) => { s = Math.round(s || 0); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
export const fmtSize = (b) => (b > 1e9 ? `${(b / 1e9).toFixed(1)} GB` : b >= 1e6 ? `${Math.round(b / 1e6)} MB` : `${Math.max(1, Math.round(b / 1e3))} KB`);
