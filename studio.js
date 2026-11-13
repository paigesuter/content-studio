// Paige's Content Studio: app shell + Phase 1 screens (Home, My Footage, Create, Brand Brain, Brand Kit).
import { storageInfo, askToKeep } from "./db.js";
import { loadBrand, updateBrand, history, revert, addFeedback, loadKit, saveKit, addCustomFont,
  registerCustomFonts, removeCustomFont, exportBackup, importBackup, resetBrand } from "./brand.js";
import { PALETTES, PAIRINGS, googleFontsHref, activePalette } from "./kit.js";
import { importFiles, listMedia, getBlob, removeMedia, updateMedia, listFolders, addFolder, removeFolder,
  fmtDuration, fmtSize } from "./library.js";

// ---------- tiny helpers ----------
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v === true) n.setAttribute(k, "");
    else n.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return n;
}
const $ = (id) => document.getElementById(id);
let toastT;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2800); }
const get = (obj, path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}
let sheetCleanup = null;
function openSheet(...nodes) {
  $("sheetCard").replaceChildren(...nodes);
  $("sheet").hidden = false;
}
function closeSheet() { $("sheet").hidden = true; sheetCleanup?.(); sheetCleanup = null; }
$("sheet").addEventListener("click", (e) => { if (e.target.id === "sheet") closeSheet(); });

// thumbnails as object URLs (cached)
const thumbUrls = new Map();
const thumbUrl = (m) => {
  if (!m.thumb) return null;
  if (!thumbUrls.has(m.id)) thumbUrls.set(m.id, URL.createObjectURL(m.thumb));
  return thumbUrls.get(m.id);
};

// ---------- state ----------
const S = { brand: null, kit: null, media: [], folders: [], fonts: [], filter: { kind: "all", folder: null, fav: false },
  selecting: false, selected: new Set(), draftKit: null, uploadFolder: null };

async function refreshMedia() { S.media = await listMedia(); S.folders = await listFolders(); }

// ---------- navigation ----------
const NAV = [
  ["home", "Home", "⌂"], ["footage", "My Footage", "▦"], ["create", "Create / Edit", "✂"], ["brain", "Brand Brain", "♡"],
  ["hooks", "Hook Bank", "❝"], ["inspo", "Inspiration", "✧"], ["calendar", "Content Calendar", "▢"], ["kit", "Brand Kit & Settings", "◐"],
];
function renderNav(page) {
  const links = (cls) => NAV.map(([id, name, ic]) => el("a", { href: `#${id}`, class: id === page ? "on" : "" }, el("span", { class: "ic" }, ic), name));
  $("nav").replaceChildren(...links());
  $("mobNav").replaceChildren(...NAV.map(([id, name]) => el("a", { href: `#${id}`, class: id === page ? "on" : "" }, name.split(" ")[0] === "Brand" ? name.replace(" & Settings", "") : name)));
  $("mobNav").querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest" });
}
const VIEWS = {};
async function render() {
  const page = (location.hash.slice(1) || "home").split("?")[0];
  const view = VIEWS[page] ? page : "home";
  renderNav(view);
  const nodes = await VIEWS[view]();
  $("view").replaceChildren(...[nodes].flat(Infinity).filter((n) => n != null && n !== false));
  window.scrollTo(0, 0);
}
window.addEventListener("hashchange", render);

// ---------- uploading ----------
function pickUpload(folderId = null) {
  S.uploadFolder = folderId;
  $("uploadInput").click();
}
$("uploadInput").addEventListener("change", async (e) => {
  const files = [...e.target.files];
  e.target.value = "";
  if (!files.length) return;
  const bar = el("div");
  const label = el("p", { class: "small muted" }, "Getting ready…");
  openSheet(el("h2", {}, "Adding to your studio"), el("p", { class: "muted small" }, "Copies are saved in the app. Your originals in Photos stay exactly as they are."),
    el("div", { class: "progress" }, bar), label);
  const { added, errors } = await importFiles(files, {
    folderId: S.uploadFolder,
    onProgress: ({ index, total, name }) => {
      bar.style.width = `${Math.round((index / total) * 100)}%`;
      label.textContent = index < total ? `Adding ${index + 1} of ${total}: ${name}` : "Done";
    },
  });
  await refreshMedia();
  openSheet(el("h2", {}, added.length ? `Added ${added.length} ✓` : "Nothing was added"),
    errors.length ? el("div", {}, el("p", { class: "muted small" }, "Some files had a problem:"), el("ul", { class: "list small" }, errors.map((x) => el("li", {}, x)))) : null,
    el("div", { class: "row", style: { marginTop: "14px" } }, el("button", { class: "btn-pink", onclick: () => { closeSheet(); location.hash = "#footage"; render(); } }, "See my footage")));
});

// ---------- shared bits ----------
function tile(m, onClick) {
  const url = thumbUrl(m);
  return el("button", { class: "tile" + (S.selected.has(m.id) ? " sel" : ""), onclick: onClick, "aria-label": m.name },
    url ? el("img", { src: url, alt: "", loading: "lazy" }) : el("div", { class: "noimg" }, m.kind === "video" ? "🎬" : "🖼"),
    m.favourite ? el("span", { class: "fav" }, "♥") : null,
    m.kind === "video" ? el("span", { class: "badge" }, fmtDuration(m.duration)) : null,
    S.selecting ? el("span", { class: "check" }) : null);
}

function swatchRow(pal, { labels = true, copy = false } = {}) {
  const roles = [["text", "Text"], ["pink", "Pink"], ["butter", "Butter"], ["soft", "Soft"], ["deep", "Deep"], ["sea", "Sea"]];
  return el("div", { class: "swatches" }, roles.filter(([r]) => pal.colors[r]).map(([r, name]) =>
    el("button", { class: "sw", title: pal.colors[r], onclick: copy ? async (e) => { e.stopPropagation(); if (await copyText(pal.colors[r])) toast(`Copied ${pal.colors[r]}`); } : null },
      el("i", { style: { background: pal.colors[r] } }), labels ? el("span", {}, name) : null, labels ? el("span", { style: { fontWeight: 500 } }, pal.colors[r]) : null)));
}

function previewFrame(pairing, pal, bgUrl, size = "") {
  const f = pairing;
  const style = (x, extra = {}) => ({ fontFamily: `"${x.family}"`, fontWeight: x.weight || 400, fontStyle: x.italic ? "italic" : "normal", ...extra });
  return el("div", { class: "frame916", style: bgUrl ? { backgroundImage: `url(${bgUrl})` } : {} },
    el("div", { class: "shade" }),
    el("div", { class: "t-title", style: style(f.title, { color: pal.colors.text }) }, "week three in bali"),
    el("div", { class: "t-accent", style: style(f.accent, { color: pal.colors.pink }) }, "& i'm not leaving"),
    el("div", { class: "t-cap", style: style(f.primary, { color: pal.colors.text }) },
      "honestly didn't plan to stay ", el("b", { style: { color: pal.colors.butter } }, "this"), " long"));
}

// ============================================================ HOME
VIEWS.home = async () => {
  const pal = activePalette(S.kit);
  const pairing = PAIRINGS.find((p) => p.id === S.kit.pairing) || PAIRINGS[0];
  const recent = S.media.slice(0, 10);
  return [
    el("section", { class: "hero" },
      el("div", { class: "eyebrow" }, "hey paige"),
      el("h1", {}, S.brand.identity.message || "Building a life that feels like you."),
      el("p", { class: "muted" }, "Upload your footage, plan the idea, edit in your brand and export. Your studio, your voice."),
      el("div", { class: "actions" },
        el("button", { class: "btn-pink btn-big", onclick: () => pickUpload() }, "＋ Upload footage"),
        el("a", { class: "btn btn-big", href: "#create" }, "✂ Make a reel"))),
    el("div", { class: "card" },
      el("div", { class: "card-head" }, el("h2", {}, "Recent footage"), el("a", { class: "btn-ghost", href: "#footage" }, "See all →")),
      recent.length ? el("div", { class: "media-grid" }, recent.map((m) => tile(m, () => openMedia(m))))
        : el("div", { class: "drop", onclick: () => pickUpload() }, el("strong", {}, "Nothing here yet."), el("br"), "Tap to add photos and videos from your camera roll.")),
    el("div", { class: "grid cols-2" },
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h2", {}, "Your brand"), el("a", { class: "btn-ghost", href: "#kit" }, "Brand Kit →")),
        swatchRow(pal, { labels: false }),
        el("p", { class: "small", style: { marginTop: "12px" } }, el("b", {}, pairing.name), " · ",
          el("span", { style: { fontFamily: `"${pairing.title.family}"`, fontStyle: pairing.title.italic ? "italic" : "normal", fontSize: "17px" } }, pairing.title.family), " + ",
          el("span", { style: { fontFamily: `"${pairing.primary.family}"`, fontWeight: pairing.primary.weight } }, pairing.primary.family)),
        S.kit.approved ? el("span", { class: "tag" }, "Approved ✓") : el("p", { class: "small muted" }, "Not chosen yet. Pick your palette and fonts in the Brand Kit.")),
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h2", {}, "Content pillars"), el("a", { class: "btn-ghost", href: "#brain" }, "Brand Brain →")),
        el("div", { class: "chips" }, S.brand.pillars.map((p) => el("span", { class: "chip" }, p.name))),
        el("p", { class: "small muted", style: { marginTop: "12px" } }, S.brand.audience.innerThought ? `Talking to the girl thinking: "${S.brand.audience.innerThought}"` : ""))),
    el("div", { class: "card" },
      el("h2", {}, "Folders"),
      el("div", { class: "chips", style: { marginTop: "10px" } }, S.folders.map((f) => {
        const n = S.media.filter((m) => m.folders?.includes(f.id)).length;
        return el("a", { class: "chip", href: "#footage", onclick: () => { S.filter = { kind: "all", folder: f.id, fav: false }; } }, f.name, n ? el("span", { class: "muted" }, n) : null);
      }))),
    el("div", { class: "card soon" },
      el("h3", {}, "Coming next: Phase 2"),
      el("p", { class: "small muted" }, "Content ideas from your actual footage, your personal hook bank, captions in your voice, and the Ask Claude button.")),
  ];
};

// ============================================================ MY FOOTAGE
function filteredMedia() {
  const f = S.filter;
  return S.media.filter((m) => (f.kind === "all" || m.kind === f.kind) && (!f.folder || m.folders?.includes(f.folder)) && (!f.fav || m.favourite));
}

VIEWS.footage = async () => {
  const items = filteredMedia();
  const info = await storageInfo();
  const f = S.filter;
  const setF = (patch) => { S.filter = { ...S.filter, ...patch }; render(); };
  const folderSel = el("select", { style: { width: "auto" } }, el("option", { value: "" }, "Add to folder…"), S.folders.map((x) => el("option", { value: x.id }, x.name)));
  folderSel.onchange = async () => {
    const id = folderSel.value; if (!id) return;
    for (const m of S.media) if (S.selected.has(m.id) && !m.folders.includes(id)) { m.folders.push(id); await updateMedia(m); }
    toast(`Added ${S.selected.size} to ${S.folders.find((x) => x.id === id).name}`);
    S.selected.clear(); S.selecting = false; await refreshMedia(); render();
  };
  return [
    el("div", { class: "page-head" }, el("h1", {}, "My ", el("em", {}, "footage")),
      el("p", {}, "Copies of the photos and videos you add live here, on this device. Your originals in Photos are never changed or deleted.")),
    el("div", { class: "row", style: { marginBottom: "14px" } },
      el("button", { class: "btn-pink", onclick: () => pickUpload(f.folder) }, "＋ Upload", f.folder ? ` to ${S.folders.find((x) => x.id === f.folder)?.name}` : ""),
      el("button", { onclick: () => { S.selecting = !S.selecting; S.selected.clear(); render(); } }, S.selecting ? "Cancel" : "Select"),
      el("span", { class: "spacer" }),
      el("span", { class: "small muted" }, `${S.media.length} items · ${fmtSize(info.used)} used`)),
    el("div", { class: "chips scroll", style: { marginBottom: "10px" } },
      el("button", { class: "chip" + (f.kind === "all" && !f.fav ? " on" : ""), onclick: () => setF({ kind: "all", fav: false }) }, "All"),
      el("button", { class: "chip" + (f.kind === "video" ? " on" : ""), onclick: () => setF({ kind: "video", fav: false }) }, "Videos"),
      el("button", { class: "chip" + (f.kind === "photo" ? " on" : ""), onclick: () => setF({ kind: "photo", fav: false }) }, "Photos"),
      el("button", { class: "chip" + (f.fav ? " on" : ""), onclick: () => setF({ fav: !f.fav, kind: "all" }) }, "♥ Favourites")),
    el("div", { class: "chips scroll", style: { marginBottom: "16px" } },
      el("button", { class: "chip" + (!f.folder ? " on" : ""), onclick: () => setF({ folder: null }) }, "All folders"),
      S.folders.map((x) => el("button", { class: "chip" + (f.folder === x.id ? " on" : ""), onclick: () => setF({ folder: x.id }) }, x.name)),
      el("button", { class: "chip", onclick: async () => { const n = prompt("Folder name"); if (n?.trim()) { await addFolder(n.trim()); await refreshMedia(); render(); } } }, "＋ New folder")),
    S.selecting ? el("div", { class: "card row" }, el("b", {}, `${S.selected.size} selected`), el("span", { class: "spacer" }), folderSel,
      el("button", { class: "btn-danger", onclick: async () => {
        if (!S.selected.size || !confirm(`Remove ${S.selected.size} item(s) from the studio? Your originals in Photos stay safe.`)) return;
        for (const id of S.selected) await removeMedia(id);
        S.selected.clear(); S.selecting = false; await refreshMedia(); render();
      } }, "Remove")) : null,
    items.length ? el("div", { class: "media-grid" }, items.map((m) => tile(m, () => {
      if (S.selecting) { S.selected.has(m.id) ? S.selected.delete(m.id) : S.selected.add(m.id); render(); } else openMedia(m);
    })))
      : el("div", { class: "drop", onclick: () => pickUpload(f.folder) }, el("strong", {}, S.media.length ? "Nothing in this view." : "Your library is empty."), el("br"), "Tap to add photos and videos."),
    f.folder && !S.selecting ? el("p", { style: { marginTop: "20px" } }, el("button", { class: "btn-ghost btn-danger", onclick: async () => {
      if (!confirm("Delete this folder? The footage inside stays in your library.")) return;
      await removeFolder(f.folder); S.filter.folder = null; await refreshMedia(); render();
    } }, "Delete this folder")) : null,
  ];
};

async function openMedia(m) {
  const blob = await getBlob(m.id);
  const url = blob ? URL.createObjectURL(blob) : null;
  sheetCleanup = () => url && URL.revokeObjectURL(url);
  const preview = !url ? el("p", { class: "muted" }, "This file couldn't be loaded.")
    : m.kind === "video" ? el("video", { src: url, controls: true, playsinline: true, preload: "metadata" })
    : el("img", { class: "full", src: url, alt: m.name });
  const folderChips = el("div", { class: "chips" }, S.folders.map((f) => el("button", {
    class: "chip" + (m.folders?.includes(f.id) ? " on" : ""),
    onclick: async (e) => {
      m.folders = m.folders?.includes(f.id) ? m.folders.filter((x) => x !== f.id) : [...(m.folders || []), f.id];
      await updateMedia(m); e.currentTarget.classList.toggle("on");
    } }, f.name)));
  const favBtn = el("button", { onclick: async () => { m.favourite = !m.favourite; await updateMedia(m); favBtn.textContent = m.favourite ? "♥ Favourite" : "♡ Favourite"; } }, m.favourite ? "♥ Favourite" : "♡ Favourite");
  openSheet(
    el("div", { class: "card-head" }, el("h2", {}, m.kind === "video" ? "Video" : "Photo"), el("button", { class: "btn-ghost", onclick: () => { closeSheet(); render(); } }, "Done")),
    preview,
    el("dl", { class: "kv", style: { marginTop: "14px" } },
      el("dt", {}, "File"), el("dd", {}, m.name),
      m.kind === "video" ? [el("dt", {}, "Length"), el("dd", {}, fmtDuration(m.duration))] : null,
      el("dt", {}, "Shape"), el("dd", {}, `${m.orientation} · ${m.width}×${m.height}`),
      el("dt", {}, "Size"), el("dd", {}, fmtSize(m.size)),
      el("dt", {}, "Added"), el("dd", {}, new Date(m.added).toLocaleString())),
    el("h3", {}, "Folders"), folderChips,
    el("div", { class: "row", style: { marginTop: "18px" } },
      m.kind === "video" ? el("a", { class: "btn btn-pink", href: `edit.html?clip=${m.id}` }, "✂ Edit this clip") : null,
      favBtn,
      el("span", { class: "spacer" }),
      el("button", { class: "btn-danger", onclick: async () => {
        if (!confirm("Remove from the studio? Your original in Photos stays safe.")) return;
        await removeMedia(m.id); closeSheet(); await refreshMedia(); render();
      } }, "Remove")));
}

// ============================================================ CREATE
const PRESETS = [
  ["Cinematic Daily Diary", "Everyday lifestyle & travel. Varied pacing, beautiful opener, subtle text, natural audio, satisfying ending."],
  ["Bali / Travel Diaries", "Strong opener, destination + you, details & close-ups, natural story flow, minimal overlays."],
  ["Fashion Edit", "Outfit reveals, detail & walking shots, mirror clips, clean typography, editorial pacing."],
  ["Becoming Her / Storytelling", "Cinematic B-roll under a voiceover, strong opening line, clean subtitles, room to breathe."],
  ["Pilates Series", "Consistent intro/outro, pink accent, class number, optional date & one-word feeling."],
  ["Photo Dump / Photo Reel", "Arrange photos (and clips), gentle movement, consistent type, adjustable slide timing."],
];
VIEWS.create = async () => {
  const videos = S.media.filter((m) => m.kind === "video");
  return [
    el("div", { class: "page-head" }, el("h1", {}, "Create & ", el("em", {}, "edit")),
      el("p", {}, "Right now: the quick reel editor for one talking-to-camera clip (cuts pauses & mistakes, captions, looks, export). The multi-clip timeline and your signature presets arrive in Phase 3.")),
    el("div", { class: "card" },
      el("div", { class: "card-head" }, el("h2", {}, "Quick reel: pick a talking clip"), el("button", { class: "btn-soft", onclick: () => pickUpload() }, "＋ Upload")),
      videos.length ? el("div", { class: "media-grid" }, videos.map((m) => tile(m, () => { location.href = `edit.html?clip=${m.id}`; })))
        : el("p", { class: "muted" }, "No videos yet. Upload one, or ", el("a", { href: "edit.html" }, "open the editor"), " and pick straight from Photos.")),
    el("h2", { style: { margin: "26px 0 12px" } }, "Your signature presets"),
    el("div", { class: "grid cols-3" }, PRESETS.map(([name, desc]) => el("div", { class: "card soon" }, el("h3", {}, name), el("p", { class: "small muted" }, desc), el("span", { class: "tag" }, "Phase 3")))),
  ];
};

// ============================================================ BRAND BRAIN
const SECTIONS = [
  { id: "identity", title: "Who I am", fields: [["identity.oneLiner", "In one line", "text"], ["identity.handles", "Handles", "textarea"], ["identity.message", "Brand message", "text"], ["identity.story", "My story", "textarea"], ["identity.themes", "Themes I come back to", "list"]] },
  { id: "audience", title: "Who I'm talking to", fields: [["audience.who", "Who they are", "textarea"], ["audience.innerThought", "Their biggest thought", "text"], ["audience.traits", "They might…", "list"], ["audience.wants", "What they want from me", "textarea"]] },
  { id: "personality", title: "My personality", fields: [["personality.traits", "Traits", "list"], ["personality.platforms", "Instagram vs TikTok", "textarea"]] },
  { id: "voice", title: "How I write", fields: [["voice.style", "My writing style", "list"], ["voice.examples", "Examples of my tone", "list"], ["voice.examplesNote", "Note", "text"], ["voice.avoidTone", "Never sound like", "list"], ["voice.bannedPhrases", "Banned phrases", "list"], ["voice.punctuation", "Punctuation & emojis", "text"]] },
  { id: "editing", title: "Editing & aesthetic", fields: [["editing.principles", "Editing principles", "list"], ["editing.defaultText", "Default text", "text"], ["editing.formats", "Formats", "text"], ["aesthetic", "Aesthetic", "list"]] },
  { id: "rules", title: "Rules learned from my feedback", fields: [["rules", "Rules", "list"]] },
  { id: "goals", title: "Private goals & notes", note: "Stored only on this device, never in the app's public code.", fields: [["goals.notes", "Goals, numbers, plans, anything private", "textarea"]] },
];
const FEEDBACK_TAGS = ["I love this", "This sounds like me", "This doesn't sound like me", "I hate this font", "This edit is too fast", "I prefer the original clip", "Use more humour", "Make it less polished", "This is too generic"];
let editingSection = null;

function sectionCard(sec) {
  const isEditing = editingSection === sec.id;
  const head = el("div", { class: "card-head" }, el("h2", {}, sec.title),
    isEditing ? null : el("button", { class: "btn-ghost", onclick: () => { editingSection = sec.id; render(); } }, "Edit"));
  if (!isEditing) {
    return el("div", { class: "card section-view", id: `sec-${sec.id}` }, head, sec.note ? el("p", { class: "small muted" }, sec.note) : null,
      el("dl", { class: "kv" }, sec.fields.map(([path, label, type]) => {
        const v = get(S.brand, path);
        const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
        return [el("dt", {}, label), el("dd", {}, empty ? el("span", { class: "muted" }, "Nothing yet")
          : type === "list" ? el("ul", { class: "list" }, v.map((x) => el("li", {}, x))) : v)];
      })));
  }
  const inputs = sec.fields.map(([path, label, type]) => {
    const v = get(S.brand, path);
    const input = type === "text" ? el("input", { type: "text", value: v || "" }) : el("textarea", {}, type === "list" ? (v || []).join("\n") : v || "");
    return { path, type, input, label };
  });
  return el("div", { class: "card", id: `sec-${sec.id}` }, head,
    inputs.map(({ input, label, type }) => el("label", { class: "field" }, label + (type === "list" ? " (one per line)" : ""), input)),
    el("div", { class: "row" },
      el("button", { class: "btn-pink", onclick: async () => {
        for (const { path, type, input } of inputs) {
          const val = type === "list" ? input.value.split("\n").map((s) => s.trim()).filter(Boolean) : input.value.trim();
          await updateBrand(S.brand, path, val, `Edited ${sec.title}`);
        }
        editingSection = null; toast("Saved ✓"); render();
      } }, "Save"),
      el("button", { onclick: () => { editingSection = null; render(); } }, "Cancel")));
}

function pillarsCard() {
  const isEditing = editingSection === "pillars";
  if (isEditing) {
    const forms = S.brand.pillars.map((p) => ({ p, about: el("textarea", {}, p.about), topics: el("textarea", {}, p.topics.join("\n")), name: el("input", { type: "text", value: p.name }) }));
    return el("div", { class: "card" }, el("h2", {}, "Content pillars"),
      forms.map((f) => el("div", { style: { marginTop: "14px" } }, el("label", { class: "field" }, "Name", f.name), el("label", { class: "field" }, "About", f.about), el("label", { class: "field" }, "Topics (one per line)", f.topics))),
      el("div", { class: "row" }, el("button", { class: "btn-pink", onclick: async () => {
        const next = forms.map(({ p, about, topics, name }) => ({ ...p, name: name.value.trim() || p.name, about: about.value.trim(), topics: topics.value.split("\n").map((s) => s.trim()).filter(Boolean) }));
        await updateBrand(S.brand, "pillars", next, "Edited content pillars"); editingSection = null; toast("Saved ✓"); render();
      } }, "Save"), el("button", { onclick: () => { editingSection = null; render(); } }, "Cancel")));
  }
  const colors = { pink: "#F5C4D3", butter: "#F8E3A3", sea: "#A8CFCF", blush: "#F3D9CF" };
  return el("div", { class: "card" },
    el("div", { class: "card-head" }, el("h2", {}, "Content pillars"), el("button", { class: "btn-ghost", onclick: () => { editingSection = "pillars"; render(); } }, "Edit")),
    el("div", { class: "grid cols-2" }, S.brand.pillars.map((p) => el("div", { class: "pillar" },
      el("h3", {}, el("span", { class: "dot", style: { background: colors[p.color] || "#eee" } }), p.name),
      el("p", { class: "small" }, p.about),
      el("div", { class: "chips" }, p.topics.map((t) => el("span", { class: "tag" }, t)))))));
}

function feedbackCard() {
  let tag = null;
  const chips = FEEDBACK_TAGS.map((t) => el("button", { class: "chip", onclick: (e) => {
    tag = tag === t ? null : t;
    chips.forEach((c) => c.classList.toggle("on", c.textContent === tag));
  } }, t));
  const about = el("select", {}, ["Captions", "Hooks", "Fonts", "Colours", "Editing pace", "Clip choice", "Overall vibe", "Other"].map((x) => el("option", {}, x)));
  const note = el("textarea", { placeholder: "Anything else? e.g. 'less exclamation marks', 'love the soft serif titles', 'too many zooms on travel videos'" });
  const recent = [...(S.brand.feedback || [])].reverse().slice(0, 12);
  return el("div", { class: "card", id: "feedback" },
    el("h2", {}, "Teach the studio"),
    el("p", { class: "small muted" }, "Quick feedback gets saved. Then 'Ask Claude to learn from this' turns repeated feedback into real rules for writing and editing."),
    el("div", { class: "chips", style: { margin: "12px 0" } }, chips),
    el("label", { class: "field" }, "About", about),
    el("label", { class: "field" }, "Notes", note),
    el("div", { class: "row" },
      el("button", { class: "btn-pink", onclick: async () => {
        if (!tag && !note.value.trim()) return toast("Pick a reaction or write a note");
        await addFeedback(S.brand, { tag, about: about.value, note: note.value.trim() });
        toast("Saved to your Brand Brain ✓"); render();
      } }, "Save feedback"),
      el("button", { class: "btn-soft", onclick: () => askClaudeLearn() }, "✧ Ask Claude to learn from this")),
    recent.length ? el("div", { style: { marginTop: "16px" } }, el("h3", {}, "Recent feedback"),
      recent.map((f) => el("div", { class: "history-item" }, el("span", { class: "tag pink" }, f.tag || "note"), el("span", {}, `${f.about ? f.about + ": " : ""}${f.note || ""}`), el("span", { class: "spacer" }), el("span", { class: "small muted" }, new Date(f.at).toLocaleDateString())))) : null);
}

function brandForPrompt() {
  const { goals, ...rest } = S.brand;
  return JSON.stringify(rest, null, 1);
}

function askClaudeLearn() {
  const prompt = `I'm Paige. Below is the Brand Brain from my content studio app, including my recent feedback.
Turn my feedback (especially anything repeated) into clear, specific rules for how my content should be written and edited, and suggest any edits to my Brand Brain that would make future hooks, captions and edits sound more like me.

Reply with ONLY one JSON code block in exactly this shape:
\`\`\`json
{"rules": ["short specific rule", "..."],
 "changes": [{"path": "voice.bannedPhrases", "value": ["full new list"], "why": "one line"}]}
\`\`\`
Allowed paths: identity.*, audience.*, personality.*, voice.*, editing.*, aesthetic, pillars. Use full replacement values. Only include changes you're confident about. Never make me sound like a life coach.

MY BRAND BRAIN:
${brandForPrompt()}`;
  claudeSheet("Ask Claude to learn from your feedback", prompt, async (data) => {
    const changes = Array.isArray(data.changes) ? data.changes : [];
    let n = 0;
    const allowed = /^(identity|audience|personality|voice|editing)(\.\w+)?$|^aesthetic$|^pillars$/;
    for (const c of changes) if (c && typeof c.path === "string" && allowed.test(c.path) && c.value !== undefined) {
      await updateBrand(S.brand, c.path, c.value, `Claude: ${c.why || "update"}`); n++;
    }
    if (Array.isArray(data.rules) && data.rules.length) {
      const merged = [...new Set([...(S.brand.rules || []), ...data.rules.map(String)])];
      await updateBrand(S.brand, "rules", merged, `Claude added ${data.rules.length} rule(s)`); n++;
    }
    return n ? `Updated your Brand Brain (${n} change${n > 1 ? "s" : ""}). You can undo any of it in History.` : "Nothing to change.";
  });
}

// The free "Ask Claude" bridge: copy a prompt, paste the reply back.
function claudeSheet(title, prompt, apply) {
  const box = el("textarea", { placeholder: "Paste Claude's whole reply here" });
  const status = el("p", { class: "small muted" });
  openSheet(
    el("div", { class: "card-head" }, el("h2", {}, title), el("button", { class: "btn-ghost", onclick: closeSheet }, "Close")),
    el("p", { class: "small" }, el("b", {}, "1."), " Copy the prompt and paste it into your Claude chat. It uses your existing Claude, so there's no extra cost."),
    el("div", { class: "row", style: { marginBottom: "10px" } }, el("button", { class: "btn-pink", onclick: async () => {
      toast((await copyText(prompt)) ? "Copied. Now paste it into Claude" : "Couldn't copy automatically. Select the text below and copy it");
    } }, "Copy prompt")),
    el("div", { class: "copybox" }, prompt),
    el("p", { class: "small", style: { marginTop: "16px" } }, el("b", {}, "2."), " Copy Claude's reply and paste it here:"),
    box,
    el("div", { class: "row", style: { marginTop: "10px" } }, el("button", { class: "btn-pink", onclick: async () => {
      const text = box.value;
      const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
      try {
        const data = JSON.parse(m ? m[1] : text);
        status.textContent = await apply(data);
        render();
      } catch (e) {
        status.textContent = "That didn't look like Claude's JSON reply. Make sure you copied the whole message, including the code block.";
      }
    } }, "Apply")),
    status);
}

async function historyCard() {
  const items = (await history()).slice(0, 30);
  return el("div", { class: "card" }, el("h2", {}, "History"),
    el("p", { class: "small muted" }, "Every change to your Brand Brain and Brand Kit, newest first. Undo puts the old version back."),
    items.length ? items.map((h) => el("div", { class: "history-item" },
      el("span", { class: "small muted", style: { minWidth: "92px" } }, new Date(h.at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + new Date(h.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })),
      el("span", {}, h.note || h.path),
      el("span", { class: "spacer" }),
      el("button", { class: "btn-ghost", onclick: async () => {
        if (h.path === "kit") { await saveKit(h.before || {}, "Undid a Brand Kit change"); S.kit = await loadKit(); }
        else await revert(S.brand, h);
        toast("Undone ✓"); render();
      } }, "Undo")))
      : el("p", { class: "muted small" }, "No changes yet."));
}

VIEWS.brain = async () => [
  el("div", { class: "page-head" }, el("h1", {}, "Brand ", el("em", {}, "Brain")),
    el("p", {}, "Everything the studio knows about you. It's used for every idea, hook, caption and edit. Edit anything, any time.")),
  el("div", { class: "card", style: { background: "linear-gradient(135deg,#FDEEF3,#FFF8E1)" } },
    el("div", { class: "eyebrow" }, "my message"), el("p", { class: "quote", style: { margin: "6px 0 0" } }, S.brand.identity.message)),
  sectionCard(SECTIONS[0]), sectionCard(SECTIONS[1]), pillarsCard(), sectionCard(SECTIONS[2]), sectionCard(SECTIONS[3]),
  sectionCard(SECTIONS[4]), feedbackCard(), sectionCard(SECTIONS[5]), sectionCard(SECTIONS[6]), await historyCard(),
];

// ============================================================ BRAND KIT & SETTINGS
VIEWS.kit = async () => {
  S.draftKit ??= { ...S.kit };
  const d = S.draftKit;
  const bgItem = S.media.find((m) => m.thumb && m.orientation === "portrait") || S.media.find((m) => m.thumb);
  const bg = bgItem ? thumbUrl(bgItem) : null;
  const pal = PALETTES.find((p) => p.id === d.palette) || PALETTES[0];
  const changed = JSON.stringify({ ...d, approved: true }) !== JSON.stringify({ ...S.kit, approved: true }) || !S.kit.approved;
  const fonts = S.fonts;
  const info = await storageInfo();
  const restoreBox = el("textarea", { placeholder: "Paste a backup here to restore it" });

  const activePairing = () => {
    const base = PAIRINGS.find((p) => p.id === d.pairing) || PAIRINGS[0];
    const out = { ...base };
    for (const r of ["primary", "title", "accent"]) if (d.customFonts?.[r]) out[r] = { family: d.customFonts[r], weight: 400 };
    return out;
  };

  return [
    el("div", { class: "page-head" }, el("h1", {}, "Brand ", el("em", {}, "Kit")),
      el("p", {}, "Choose your palette and fonts. Previews use your own footage once you've uploaded some. Nothing changes in your edits until you tap Approve.")),
    el("div", { class: "card", style: { background: S.kit.approved && !changed ? "#F1F8F4" : "#FFF8E1" } },
      el("div", { class: "row" },
        el("div", {}, el("h3", {}, S.kit.approved && !changed ? "Your brand kit is approved ✓" : "Not approved yet"),
          el("p", { class: "small muted", style: { margin: "4px 0 0" } }, S.kit.approved && !changed ? "Changes will need your OK again." : `Selected: ${pal.name} + ${activePairing().name}`)),
        el("span", { class: "spacer" }),
        el("button", { class: "btn-pink", disabled: !changed, onclick: async () => {
          const kit = { ...d, approved: true };
          await saveKit(kit, `Approved ${pal.name} + ${activePairing().name}`);
          S.kit = kit; S.draftKit = { ...kit }; toast("Brand kit approved ✓"); render();
        } }, "Approve"))),

    el("h2", { style: { margin: "26px 0 4px" } }, "Colour palettes"),
    el("p", { class: "small muted", style: { marginTop: 0 } }, "White is your default text colour. Tap a colour to copy its HEX code."),
    el("div", { class: "grid cols-2" }, PALETTES.map((p) => el("div", { class: "card option" + (d.palette === p.id ? " on" : ""), onclick: () => { d.palette = p.id; render(); } },
      el("div", { class: "card-head" }, el("h3", {}, p.name), d.palette === p.id ? el("span", { class: "tag pink" }, "Selected") : null),
      el("p", { class: "small muted" }, p.note), swatchRow(p, { copy: true })))),

    el("h2", { style: { margin: "26px 0 4px" } }, "Font pairings"),
    el("p", { class: "small muted", style: { marginTop: 0 } }, "Each pairing has a clean primary font for captions, a title font for hooks and editorial moments, and a handwritten accent to use sparingly. All of them work in your exported videos."),
    el("div", { class: "grid cols-3" }, PAIRINGS.map((p) => el("div", { class: "card option pairing-card" + (d.pairing === p.id ? " on" : ""), onclick: () => { d.pairing = p.id; render(); } },
      previewFrame(p, pal, bg),
      el("div", { class: "card-head" }, el("h3", {}, p.name), d.pairing === p.id ? el("span", { class: "tag pink" }, "Selected") : null),
      el("p", { class: "small muted", style: { margin: "0 0 6px" } }, p.vibe),
      el("div", { class: "font-roles" }, "Captions: ", el("b", {}, p.primary.family), el("br"), "Titles: ", el("b", {}, p.title.family, p.title.italic ? " italic" : ""), el("br"), "Accent: ", el("b", {}, p.accent.family))))),

    el("div", { class: "card", style: { marginTop: "18px" } },
      el("div", { class: "card-head" }, el("h2", {}, "Your own fonts"), el("button", { class: "btn-soft", onclick: () => $("fontInput").click() }, "＋ Upload TTF / OTF")),
      el("p", { class: "small muted" }, "Upload a font file (e.g. from Files) and choose where to use it. It replaces that role in the pairing you picked."),
      fonts.length ? fonts.map((f) => {
        const sel = el("select", { style: { width: "auto" } }, ["", "primary", "title", "accent"].map((r) => el("option", { value: r, selected: Object.entries(d.customFonts || {}).some(([k, v]) => k === r && v === f.family) }, r ? `Use for ${r === "primary" ? "captions" : r === "title" ? "titles" : "accent"}` : "Not used")));
        sel.onchange = () => {
          d.customFonts = { ...(d.customFonts || {}) };
          for (const k of Object.keys(d.customFonts)) if (d.customFonts[k] === f.family) delete d.customFonts[k];
          if (sel.value) d.customFonts[sel.value] = f.family;
          render();
        };
        return el("div", { class: "history-item" }, el("span", { style: { fontFamily: `"${f.family}"`, fontSize: "22px" } }, "week three in bali"),
          el("span", { class: "small muted" }, f.file), el("span", { class: "spacer" }), sel,
          el("button", { class: "btn-ghost btn-danger", onclick: async () => { await removeCustomFont(f.family); S.fonts = await registerCustomFonts(); render(); } }, "Remove"));
      }) : el("p", { class: "small muted" }, "No uploaded fonts yet.")),

    el("h2", { style: { margin: "30px 0 12px" } }, "Settings"),
    el("div", { class: "card" },
      el("h3", {}, "Storage on this device"),
      el("p", { class: "small" }, `Using ${fmtSize(info.used)}${info.quota ? ` of about ${fmtSize(info.quota)} available` : ""}. `,
        info.persisted ? "Protected: Safari won't clear it automatically ✓" : "Not yet protected from automatic clean-up."),
      info.persisted ? null : el("button", { class: "btn-soft", onclick: async () => { toast((await askToKeep()) ? "Protected ✓" : "Safari said no. Adding the app to your Home Screen usually helps"); render(); } }, "Keep my files safe"),
      el("p", { class: "small muted" }, "Tip: open the studio from its Home Screen icon. Safari is less likely to clear storage for Home Screen apps, but always keep originals in Photos.")),
    el("div", { class: "card" },
      el("h3", {}, "Backup your Brand Brain & Kit"),
      el("p", { class: "small muted" }, "Copies your brand settings (not your footage) so you can restore them on another device."),
      el("div", { class: "row" },
        el("button", { onclick: async () => toast((await copyText(await exportBackup())) ? "Backup copied. Paste it into Notes to keep it" : "Couldn't copy") }, "Copy backup")),
      el("label", { class: "field", style: { marginTop: "14px" } }, "Restore", restoreBox),
      el("div", { class: "row" },
        el("button", { onclick: async () => { try { await importBackup(restoreBox.value); S.brand = await loadBrand(); S.kit = await loadKit(); S.draftKit = null; toast("Restored ✓"); render(); } catch { toast("That doesn't look like a backup"); } } }, "Restore backup"),
        el("button", { class: "btn-ghost btn-danger", onclick: async () => { if (!confirm("Reset your Brand Brain to the original brief? (Your Brand Kit and footage stay.)")) return; await resetBrand(); S.brand = await loadBrand(); toast("Reset ✓"); render(); } }, "Reset Brand Brain"))),
  ];
};
$("fontInput").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try { const fam = await addCustomFont(f); S.fonts = await registerCustomFonts(); toast(`Added ${fam.replace("Custom ", "")} ✓`); render(); }
  catch { toast("That file doesn't look like a font (use .ttf or .otf)"); }
});

// ============================================================ LATER PHASES (honest placeholders)
function soonView(title, em, intro, phase, items, extra = null) {
  return [
    el("div", { class: "page-head" }, el("h1", {}, title, " ", el("em", {}, em)), el("p", {}, intro)),
    extra,
    el("div", { class: "card soon" }, el("span", { class: "tag" }, phase), el("ul", { class: "list", style: { marginTop: "10px" } }, items.map((i) => el("li", {}, i)))),
  ];
}
VIEWS.hooks = async () => soonView("Hook", "Bank", "Your personal hook bank, written in your voice and sorted into 15 categories.", "Coming in Phase 2",
  ["Dozens of hooks tagged by pillar, video type, tone, platform and intended reaction", "Favourites, edit, add your own", "Hooks that match what you actually said in a clip", "Ask Claude for fresh hooks in your voice (free, via your Claude chat)"]);
VIEWS.inspo = async () => soonView("Inspiration", "Library", "Save reels, screenshots and edits you love, then recreate the feel with your own footage.", "Coming in Phase 4",
  ["Analysis of pacing, clip order, text placement, fonts and colour", "Labels & moodboards", "“Recreate this style” blueprints that assemble your clips"],
  el("div", { class: "card" }, el("h3", {}, "Start collecting now"), el("p", { class: "small muted" }, "Upload screen recordings and screenshots into your Inspiration folder. They'll be ready when this section arrives. You can also send them to me in our chat and I'll break them down."),
    el("button", { class: "btn-pink", onclick: () => pickUpload(S.folders.find((f) => f.name === "Inspiration")?.id) }, "＋ Upload inspiration")));
VIEWS.calendar = async () => soonView("Content", "Calendar", "Plan posts, balance your four pillars and track what's filmed, editing, ready and published.", "Coming in Phase 5",
  ["Ideas, drafts and scheduled posts", "Pillar balance at a glance", "Hooks & captions saved with each post", "Status: filmed → editing → ready → published"]);

// ============================================================ start
(async function start() {
  const link = el("link", { rel: "stylesheet", href: googleFontsHref() });
  document.head.append(link);
  try {
    [S.brand, S.kit, S.fonts] = await Promise.all([loadBrand(), loadKit(), registerCustomFonts()]);
    await refreshMedia();
  } catch (e) {
    $("view").replaceChildren(el("div", { class: "card" }, el("h2", {}, "The studio couldn't open its storage"), el("p", {}, String(e.message || e)),
      el("p", { class: "small muted" }, "If you're in a Private browsing tab, open the studio in a normal Safari tab.")));
    return;
  }
  render();
})();
