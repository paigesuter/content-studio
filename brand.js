// Loads/saves the Brand Brain + Brand Kit, keeps a history of every change (so you can undo),
// and registers your own uploaded fonts.
import { db, uid } from "./db.js";
import { BRAND_SEED } from "./brand-seed.js";
import { DEFAULT_KIT } from "./kit.js";

const clone = (o) => JSON.parse(JSON.stringify(o));

export async function loadBrand() {
  const saved = await db.getValue("brand", null);
  if (!saved) return clone(BRAND_SEED);
  // add any new sections from future updates without overwriting your edits
  const out = clone(BRAND_SEED);
  for (const k of Object.keys(saved)) out[k] = saved[k];
  return out;
}

// path like "voice.examples"; records the before/after in history
export async function updateBrand(brand, path, value, note = "") {
  const keys = path.split(".");
  let obj = brand;
  for (const k of keys.slice(0, -1)) obj = obj[k] ??= {};
  const last = keys[keys.length - 1];
  const before = obj[last];
  if (JSON.stringify(before) === JSON.stringify(value)) return brand;
  obj[last] = value;
  await db.setValue("brand", brand);
  await db.put("history", { id: Date.now() + "-" + uid(), at: new Date().toISOString(), path, before: clone(before ?? null), after: clone(value), note });
  return brand;
}

export async function history() {
  const rows = await db.all("history");
  return rows.sort((a, b) => (a.id < b.id ? 1 : -1));
}

export async function revert(brand, entry) {
  return updateBrand(brand, entry.path, entry.before, `Undid change from ${new Date(entry.at).toLocaleString()}`);
}

export async function addFeedback(brand, item) {
  const list = [...(brand.feedback || []), { id: uid(), at: new Date().toISOString(), ...item }];
  return updateBrand(brand, "feedback", list, `Feedback: ${item.tag || "note"}`);
}

export async function resetBrand() {
  await db.setValue("brand", clone(BRAND_SEED));
}

// ---------- kit ----------

export async function loadKit() {
  return { ...DEFAULT_KIT, ...(await db.getValue("kit", {})) };
}
export async function saveKit(kit, note) {
  const before = await db.getValue("kit", DEFAULT_KIT);
  await db.setValue("kit", kit);
  await db.put("history", { id: Date.now() + "-" + uid(), at: new Date().toISOString(), path: "kit", before, after: clone(kit), note: note || "Brand Kit change" });
}

// ---------- your own fonts ----------

export async function addCustomFont(file) {
  const name = file.name.replace(/\.(ttf|otf|woff2?)$/i, "").replace(/[^\w -]+/g, " ").trim() || "My font";
  const family = `Custom ${name}`;
  const buf = await file.arrayBuffer();
  const face = new FontFace(family, buf);
  await face.load(); // throws if the file isn't a valid font
  document.fonts.add(face);
  await db.put("fonts", { id: family, family, file: file.name, blob: new Blob([buf], { type: file.type || "font/ttf" }) });
  return family;
}

export async function registerCustomFonts() {
  const fonts = await db.all("fonts");
  await Promise.all(fonts.map(async (f) => {
    try {
      const face = new FontFace(f.family, await f.blob.arrayBuffer());
      await face.load();
      document.fonts.add(face);
    } catch {}
  }));
  return fonts;
}

export async function removeCustomFont(family) {
  await db.del("fonts", family);
}

// ---------- backup ----------

export async function exportBackup() {
  return JSON.stringify({ app: "content-studio", exported: new Date().toISOString(),
    brand: await loadBrand(), kit: await loadKit() }, null, 2);
}
export async function importBackup(text) {
  const data = JSON.parse(text);
  if (data.brand) await db.setValue("brand", data.brand);
  if (data.kit) await db.setValue("kit", data.kit);
}
