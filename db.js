// On-device storage (IndexedDB). Your footage, brand brain and projects stay on this device.
// Original files are stored as copies; your Photos library is never touched.

const DB_NAME = "content-studio";
const VERSION = 1;
const STORES = ["kv", "media", "blobs", "folders", "history", "fonts"];
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const s = t.objectStore(store);
    let result;
    const r = fn(s);
    if (r && "onsuccess" in r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error || new Error("Storage was full or blocked"));
  });
}

export const db = {
  get: (store, id) => tx(store, "readonly", (s) => s.get(id)),
  put: (store, obj) => tx(store, "readwrite", (s) => s.put(obj)),
  del: (store, id) => tx(store, "readwrite", (s) => s.delete(id)),
  all: (store) => tx(store, "readonly", (s) => s.getAll()),
  async getValue(key, fallback) {
    const row = await db.get("kv", key);
    return row ? row.value : fallback;
  },
  setValue: (key, value) => db.put("kv", { id: key, value }),
};

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function storageInfo() {
  const est = (await navigator.storage?.estimate?.()) || {};
  const persisted = (await navigator.storage?.persisted?.()) || false;
  return { used: est.usage || 0, quota: est.quota || 0, persisted };
}

export async function askToKeep() {
  try { return await navigator.storage?.persist?.(); } catch { return false; }
}
