// Paige's Content Studio: app shell + Phase 1 screens (Home, My Footage, Create, Brand Brain, Brand Kit).
import { storageInfo, askToKeep, db } from "./db.js";
const dbValue = (k) => db.getValue(k, null);
const dbSet = (k, v) => db.setValue(k, v);
import { loadBrand, updateBrand, history, revert, addFeedback, loadKit, saveKit, addCustomFont,
  registerCustomFonts, removeCustomFont, exportBackup, importBackup, resetBrand } from "./brand.js";
import { PALETTES, PAIRINGS, googleFontsHref, activePalette, FONT_LIBRARY, fontKey } from "./kit.js";
import { listSeries, saveSeries, deleteSeries, newSeries, fillTemplate, seriesFonts } from "./series.js";
import { HOOKS, FORMATS, CAPTION_OPENERS, herBlock, HER_RULES } from "./hooks.js";
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
  ["home", "Dashboard", "🏠"], ["series", "My Series", "🌸"], ["footage", "My Footage", "🎞️"], ["create", "Create / Edit", "✂️"], ["brain", "Brand Brain", "💗"],
  ["hooks", "Hook Bank", "💬"], ["inspo", "Inspiration", "✨"], ["calendar", "Content Calendar", "🗓️"], ["kit", "Brand Kit & Settings", "🎀"],
];
function renderNav(page) {
  const links = (cls) => NAV.map(([id, name, ic]) => el("a", { href: `#${id}`, class: id === page ? "on" : "" }, el("span", { class: "ic" }, ic), name));
  $("nav").replaceChildren(...links());
  $("mobNav").replaceChildren(...NAV.map(([id, name]) => el("a", { href: `#${id}`, class: id === page ? "on" : "" }, name.split(" ")[0] === "Brand" ? name.replace(" & Settings", "") : name)));
  $("mobNav").querySelector(".on")?.scrollIntoView({ inline: "center", block: "nearest" });
  const item = NAV.find((n) => n[0] === page);
  $("tbTitle").textContent = item[1].replace(" & Settings", "");
  $("tbIcon").textContent = item[2];
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
  const roles = [["text", "Text"], ["pink", "Pink"], ["butter", "Butter"], ["sage", "Sage"], ["sagedeep", "Sage deep"], ["soft", "Soft"], ["deep", "Deep"], ["sea", "Sea"]];
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
// ---- follower goal (private, on this device) ----
async function loadGrowth() { return (await dbValue("growth")) || { target: null, points: [] }; }
async function saveGrowth(g) { await dbSet("growth", g); }

function growthChart(g) {
  const pts = [...g.points].sort((a, b) => a.date.localeCompare(b.date));
  const W = 560, H = 210, P = 30;
  if (!pts.length) return el("div", { class: "drop", style: { padding: "34px" } }, "Add your follower count now and then. Your growth line appears here.");
  const target = g.target || Math.max(...pts.map((p) => p.followers)) * 1.2;
  const min = Math.min(...pts.map((p) => p.followers)) * 0.9;
  const max = Math.max(target, ...pts.map((p) => p.followers));
  const t0 = new Date(pts[0].date).getTime(), t1 = Math.max(t0 + 864e5, new Date(pts[pts.length - 1].date).getTime());
  const x = (d) => P + ((new Date(d).getTime() - t0) / (t1 - t0)) * (W - P * 2);
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - P * 2);
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`); svg.setAttribute("class", "chart");
  const add = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); svg.append(n); return n; };
  for (let i = 0; i <= 3; i++) add("line", { x1: P, x2: W - P, y1: P + i * (H - 2 * P) / 3, y2: P + i * (H - 2 * P) / 3, stroke: "#F6DDE5", "stroke-width": 1 });
  if (g.target) { add("line", { x1: P, x2: W - P, y1: y(g.target), y2: y(g.target), stroke: "#F8E3A3", "stroke-width": 2, "stroke-dasharray": "6 6" });
    const t = add("text", { x: W - P, y: y(g.target) - 6, "text-anchor": "end", fill: "#B89A3E", "font-size": 12, "font-weight": 700 }); t.textContent = `goal ${g.target.toLocaleString()}`; }
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.date).toFixed(1)},${y(p.followers).toFixed(1)}`).join(" ");
  add("path", { d: `${d} L${x(pts[pts.length - 1].date)},${H - P} L${x(pts[0].date)},${H - P} Z`, fill: "rgba(245,196,211,.35)" });
  add("path", { d, fill: "none", stroke: "#E796B0", "stroke-width": 3, "stroke-linecap": "round", "stroke-linejoin": "round" });
  pts.forEach((p, i) => add("circle", { cx: x(p.date), cy: y(p.followers), r: i === pts.length - 1 ? 6 : 4, fill: i === pts.length - 1 ? "#F8E3A3" : "#fff", stroke: "#E796B0", "stroke-width": 2 }));
  return svg;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function moodboard(pal, pairing, limit = 7) {
  // Your own photos (Brand assets / Inspiration first) mixed with colour tiles and a type sample, masonry style.
  const pref = S.folders.filter((f) => ["Brand assets", "Inspiration"].includes(f.name)).map((f) => f.id);
  const pics = [...S.media.filter((m) => m.thumb && m.folders?.some((id) => pref.includes(id))), ...S.media.filter((m) => m.thumb)]
    .filter((m, i, a) => a.findIndex((x) => x.id === m.id) === i).slice(0, limit);
  const colorTiles = ["pink", "sage", "butter", "sagedeep", "soft", "text"].filter((r) => pal.colors[r])
    .map((r) => el("div", { class: "mb-tile mb-color", style: { background: pal.colors[r] } }, el("span", {}, pal.colors[r])));
  const typeTile = el("div", { class: "mb-tile mb-type" },
    el("span", { style: { fontFamily: `"${pairing.title.family}"`, fontStyle: pairing.title.italic ? "italic" : "normal" } }, "paige"),
    el("small", {}, `${pairing.title.family} · ${pairing.primary.family}`));
  const tiles = [];
  pics.forEach((m, i) => {
    tiles.push(el("button", { class: "mb-tile mb-photo" + (i % 3 === 0 ? " tall" : ""), onclick: () => openMedia(m) }, el("img", { src: thumbUrl(m), alt: "" })));
    if (colorTiles.length && i % 2 === 0) tiles.push(colorTiles.shift());
    if (i === 1) tiles.push(typeTile);
  });
  if (pics.length < 2) tiles.push(typeTile);
  tiles.push(...colorTiles);
  if (!pics.length) tiles.push(el("button", { class: "mb-tile mb-add", onclick: () => pickUpload(S.folders.find((f) => f.name === "Brand assets")?.id) }, "＋ Add your photos"));
  return el("div", { class: "moodboard" }, tiles);
}

const AFFIRMATIONS = () => [S.brand.identity.message, ...(S.brand.identity.themes || [])].filter(Boolean);

VIEWS.home = async () => {
  const pal = activePalette(S.kit);
  const pairing = PAIRINGS.find((p) => p.id === S.kit.pairing) || PAIRINGS[0];
  const recent = S.media.slice(0, 8);
  const videos = S.media.filter((m) => m.kind === "video");
  const photos = S.media.length - videos.length;
  const weekAgo = Date.now() - 7 * 864e5;
  const thisWeek = S.media.filter((m) => new Date(m.added).getTime() > weekAgo);
  const totalSecs = videos.reduce((a, m) => a + (m.duration || 0), 0);
  const growth = await loadGrowth();
  const last = [...growth.points].sort((a, b) => a.date.localeCompare(b.date)).pop();
  const stat = (label, value, trend, icon, href) => el("a", { class: "stat", href },
    el("div", {}, el("small", {}, label), el("b", {}, value), el("span", { class: "trend" }, trend)), el("i", { class: "stat-ic" }, icon));
  const affs = AFFIRMATIONS();
  const aff = affs[new Date().getDate() % affs.length];
  const followerInput = el("input", { type: "text", inputmode: "numeric", placeholder: last ? `Now: ${last.followers.toLocaleString()}` : "Followers today, e.g. 8400" });
  const targetInput = el("input", { type: "text", inputmode: "numeric", placeholder: growth.target ? `Goal: ${growth.target.toLocaleString()}` : "Your goal, e.g. 20000" });
  const num = (v) => parseInt(String(v).replace(/[^\d]/g, ""), 10);
  return [
    el("section", { class: "greet" },
      el("h1", { class: "greet-h" }, `${greeting()}, Paige `, el("span", { class: "heart" }, "💗"), el("span", { class: "greet-sub" }, " your little studio is ready")),
    ),
    el("div", { class: "stats" },
      stat("Videos", videos.length, `${fmtDuration(totalSecs)} filmed`, "🎬", "#footage"),
      stat("Photos", photos, `${thisWeek.length ? "+" + thisWeek.length : "0"} added this week`, "📸", "#footage"),
      stat("Instagram", last ? last.followers.toLocaleString() : "Add", growth.target && last ? `${Math.round((last.followers / growth.target) * 100)}% of your goal` : "track your growth below", "✨", "#home"),
      stat("Brand kit", S.kit.approved ? "Ready" : "To do", S.kit.approved ? pal.name : "pick colours & fonts", "🎀", "#kit")),
    el("div", { class: "home-grid" },
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h2", {}, "Recent footage"), el("a", { class: "btn-ghost", href: "#footage" }, "See all →")),
        recent.length ? el("div", { class: "media-grid" }, recent.map((m) => tile(m, () => openMedia(m))))
          : el("div", { class: "drop", onclick: () => pickUpload() }, el("strong", {}, "Nothing here yet."), el("br"), "Tap to add photos and videos from your camera roll.")),
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h2", {}, "Road to your goal"), el("span", { class: "pill-soft" }, last ? last.followers.toLocaleString() + " 💗" : "private")),
        growthChart(growth),
        el("div", { class: "goal-row" }, followerInput, targetInput,
          el("button", { class: "btn-soft", onclick: async () => {
            const f = num(followerInput.value), t = num(targetInput.value);
            if (!f && !t) return toast("Type your follower count or goal");
            if (t) growth.target = t;
            if (f) { const today = new Date().toISOString().slice(0, 10); growth.points = growth.points.filter((p) => p.date !== today); growth.points.push({ date: today, followers: f }); }
            await saveGrowth(growth); toast("Saved on this device only ✓"); render();
          } }, "Save")),
        el("p", { class: "small muted", style: { margin: "6px 0 0" } }, "Only stored on this device."))),
    el("div", { class: "home-grid alt" },
      el("div", { class: "card" },
        el("div", { class: "card-head" }, el("h2", {}, "Moodboard"), el("a", { class: "btn-ghost", href: "#kit" }, "Brand Kit →")),
        moodboard(pal, pairing, 5)),
      el("div", { class: "stack" },
        el("div", { class: "card" },
          el("h2", {}, "Quick actions"),
          el("div", { class: "quick" },
            el("button", { class: "qa", onclick: () => pickUpload() }, el("i", {}, "📤"), "Upload footage"),
            el("a", { class: "qa", href: "#series" }, el("i", {}, "🌸"), "New episode"),
            el("a", { class: "qa", href: "#create" }, el("i", {}, "🎬"), "Make a reel"),
            el("a", { class: "qa", href: "#brain" }, el("i", {}, "💗"), "Teach the studio"),
            el("a", { class: "qa", href: "#kit" }, el("i", {}, "🎀"), "Brand kit"))),
        el("div", { class: "card pillars-card" },
          el("div", { class: "card-head" }, el("h2", {}, "Content pillars"), el("a", { class: "btn-ghost", href: "#brain" }, "Brand Brain →")),
          el("div", { class: "pillar-pills" }, S.brand.pillars.map((p, i) => el("span", { class: `pp pp${i}` }, p.name)))),
        el("div", { class: "card affirm" },
          el("p", { class: "affirm-h" }, aff, " 💗"),
          el("p", { class: "affirm-s" }, "Talking to the girl thinking: “", S.brand.audience.innerThought, "”")))),
  ];
};


// ============================================================ MY SERIES
let seriesDraft = null;

function seriesFrame(sr, bgUrl, vals = {}) {
  const fonts = seriesFonts(sr, PAIRINGS);
  const pal = (PALETTES.find((p) => p.id === sr.palette) || PALETTES[0]).colors;
  const f = (x, extra = {}) => ({ fontFamily: `"${x.family}"`, fontWeight: x.weight || 400, fontStyle: x.italic ? "italic" : "normal", ...extra });
  const top = { top: "11%", middle: "36%", bottom: "62%" }[sr.position] || "11%";
  const sample = { n: sr.next || 1, word: vals.word ?? "strong", place: vals.place ?? "uluwatu" };
  let title = fillTemplate(sr.title, sr, sample);
  if (sr.titleCase === "upper") title = title.toUpperCase(); else if (sr.titleCase === "lower") title = title.toLowerCase();
  const sub = fillTemplate(sr.subtitle, sr, sample);
  const color = { pink: pal.pink, butter: pal.butter, white: pal.text }[sr.titleColor] || pal.text;
  const size = { m: 0.8, l: 1, xl: 1.3 }[sr.titleSize] || 1;
  const titleNode = (sr.layout === "stagger")
    ? (() => { const [first, ...rest] = title.split(/\s+/); return el("div", { class: "sf-title stagger", style: { "--fs": size } },
        el("span", { style: f({ ...fonts.title, italic: true }, { color }) }, first), el("span", { style: f({ ...fonts.title, italic: false }, { color }) }, rest.join(" "))); })()
    : el("div", { class: "sf-title", style: f(fonts.title, { color, "--fs": size }) }, title);
  const subNode = !sub ? null
    : sr.subStyle === "pill" ? el("span", { class: "sf-sub pill", style: f(fonts.sub, { background: pal.pink, color: pal.deep }) }, sub)
    : sr.subStyle === "script" ? el("span", { class: "sf-sub script", style: f(fonts.sub, { color: pal.text }) }, sub)
    : el("span", { class: "sf-sub small", style: f(fonts.sub, { color: pal.text }) }, sub);
  return el("div", { class: "frame916 series-frame", style: bgUrl ? { backgroundImage: `url(${bgUrl})` } : {} },
    el("div", { class: "shade" }),
    el("div", { class: "sf-text", style: { top } }, titleNode, subNode),
    sr.captions ? el("div", { class: "t-cap", style: f({ family: "DM Sans", weight: 600 }, { color: pal.text }) }, "honestly this ", el("b", { style: { color: pal.butter } }, "changed"), " everything") : null);
}

function seriesBg(sr) {
  const inFolder = sr.folder ? S.media.find((m) => m.thumb && m.folders?.includes(sr.folder)) : null;
  const lastEp = sr.episodes?.length ? S.media.find((m) => m.id === sr.episodes[sr.episodes.length - 1].clip) : null;
  const m = lastEp || inFolder || S.media.find((x) => x.thumb && x.orientation === "portrait");
  return m ? thumbUrl(m) : null;
}

function pickEpisodeClip(sr) {
  const all = S.media.filter((m) => m.kind === "video" || m.kind === "photo");
  const inFolder = sr.folder ? all.filter((m) => m.folders?.includes(sr.folder)) : [];
  const list = inFolder.length ? inFolder : all;
  const picked = [];
  const go = el("button", { class: "btn-pink", disabled: true }, "🎬 Make episode");
  const single = el("button", { disabled: true }, "Talking-clip editor (1 clip, captions)");
  const update = () => {
    go.disabled = !picked.length;
    go.textContent = `🎬 Make episode${picked.length ? ` from ${picked.length} clip${picked.length > 1 ? "s" : ""}` : ""}`;
    const v = picked.length === 1 && S.media.find((m) => m.id === picked[0])?.kind === "video";
    single.disabled = !v;
  };
  go.onclick = () => { location.href = `montage.html?clips=${picked.join(",")}&series=${sr.id}`; };
  single.onclick = () => { location.href = `edit.html?clip=${picked[0]}&series=${sr.id}`; };
  openSheet(
    el("div", { class: "card-head" }, el("h2", {}, `${sr.emoji} New episode`), el("button", { class: "btn-ghost", onclick: closeSheet }, "Close")),
    el("p", { class: "small muted" }, `Tap the clips for ${sr.name} #${sr.next || 1} in order. Your saved template is applied automatically.`),
    list.length ? el("div", { class: "media-grid" }, list.map((m) => {
      const t = tile(m, () => {
        const i = picked.indexOf(m.id);
        i >= 0 ? picked.splice(i, 1) : picked.push(m.id);
        t.classList.toggle("sel", picked.includes(m.id));
        update();
      });
      return t;
    })) : el("p", { class: "muted" }, "No footage yet."),
    el("div", { class: "row", style: { marginTop: "14px" } }, go, single,
      el("button", { class: "btn-ghost", onclick: () => { closeSheet(); pickUpload(sr.folder); } }, "＋ Upload new")));
}

VIEWS.series = async () => {
  const list = await listSeries();
  if (seriesDraft) return seriesEditor(seriesDraft);
  return [
    el("div", { class: "page-head row" }, el("div", {}, el("h1", {}, "My ", el("em", {}, "Series")),
      el("p", {}, "Each series remembers its own fonts, colours, text and pacing. New episode = pick your clip, done.")),
      el("span", { class: "spacer" }),
      el("button", { class: "btn-pink", onclick: () => { seriesDraft = newSeries(); render(); } }, "＋ New series")),
    el("div", { class: "series-grid" }, list.map((sr) => {
      const pal = PALETTES.find((p) => p.id === sr.palette) || PALETTES[0];
      const fonts = seriesFonts(sr, PAIRINGS);
      const count = sr.episodes?.length || 0;
      const progress = sr.total ? Math.min(100, Math.round((count / sr.total) * 100)) : null;
      return el("div", { class: "card series-card" },
        seriesFrame(sr, seriesBg(sr)),
        el("div", { class: "series-info" },
          el("h2", {}, `${sr.emoji} ${sr.name}`),
          el("p", { class: "small muted" }, sr.about),
          el("div", { class: "row small" },
            el("span", { class: "tag pink" }, sr.total ? `${count}/${sr.total} done` : `${count} episode${count === 1 ? "" : "s"}`),
            el("span", { class: "tag" }, `next: #${sr.next || 1}`)),
          progress != null ? el("div", { class: "progress" }, el("div", { style: { width: `${progress}%` } })) : null,
          swatchRow(pal, { labels: false }),
          el("p", { class: "small", style: { margin: "8px 0 12px" } }, el("b", {}, fonts.title.family), fonts.sub && sr.subtitle ? ` + ${fonts.sub.family}` : ""),
          el("div", { class: "row" },
            el("button", { class: "btn-pink", onclick: () => pickEpisodeClip(sr) }, "＋ New episode"),
            el("button", { onclick: () => { seriesDraft = JSON.parse(JSON.stringify(sr)); render(); } }, "Edit template")),
          count ? el("details", { style: { marginTop: "12px" } }, el("summary", { class: "small" }, "Episode log"),
            [...sr.episodes].reverse().map((e) => el("div", { class: "history-item small" }, el("b", {}, `#${e.n}`), el("span", {}, e.title || ""), el("span", { class: "spacer" }), el("span", { class: "muted" }, new Date(e.at).toLocaleDateString())))) : null));
    })),
  ];
};

function seriesEditor(d) {
  const preview = el("div");
  const refresh = () => preview.replaceChildren(seriesFrame(d, seriesBg(d)));
  refresh();
  const input = (key, opts = {}) => {
    const n = el("input", { type: opts.type || "text", value: d[key] ?? "", placeholder: opts.ph || "" });
    n.oninput = () => { d[key] = opts.type === "number" ? (n.value ? parseInt(n.value, 10) : null) : n.value; refresh(); };
    return n;
  };
  const select = (key, options) => {
    const n = el("select", {}, options.map(([v, t]) => el("option", { value: v, selected: String(d[key]) === String(v) }, t)));
    n.onchange = () => { d[key] = n.value === "true" ? true : n.value === "false" ? false : n.value; refresh(); };
    return n;
  };
  if (!d.fonts?.title) d.fonts = seriesFonts(d, PAIRINGS);
  const fontSelect = (role) => {
    const cur = fontKey(d.fonts[role]);
    const custom = S.fonts.map((f) => ({ label: `${f.family.replace("Custom ", "")} (your font)`, family: f.family, weight: 400 }));
    const opts = [...FONT_LIBRARY, ...custom];
    if (!opts.some((o) => fontKey(o) === cur)) opts.unshift({ label: d.fonts[role].family, ...d.fonts[role] });
    const n = el("select", {}, opts.map((o) => el("option", { value: fontKey(o), selected: fontKey(o) === cur }, o.label)));
    n.onchange = () => { const o = opts.find((x) => fontKey(x) === n.value); d.fonts = { ...d.fonts, [role]: { family: o.family, weight: o.weight, italic: !!o.italic } }; refresh(); };
    return n;
  };
  const choice = (key, items, label) => el("div", { class: "chips scroll" }, items.map((it) => el("button", {
    class: "chip" + (d[key] === it.id ? " on" : ""), onclick: (e) => { d[key] = it.id; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); e.currentTarget.classList.add("on"); refresh(); } }, label(it))));
  return [
    el("div", { class: "page-head row" }, el("div", {}, el("h1", {}, d.emoji, " ", el("em", {}, d.name || "Series")), el("p", {}, "Set it once. Every episode uses this template.")),
      el("span", { class: "spacer" }),
      el("button", { onclick: () => { seriesDraft = null; render(); } }, "Cancel"),
      el("button", { class: "btn-pink", onclick: async () => { await saveSeries(d); seriesDraft = null; toast("Series saved ✓"); render(); } }, "Save series")),
    el("div", { class: "series-edit" },
      el("div", { class: "series-preview" }, preview, el("p", { class: "small muted", style: { textAlign: "center" } }, "Live preview with example details")),
      el("div", {},
        el("div", { class: "card" }, el("h2", {}, "The basics"),
          el("div", { class: "grid", style: { gridTemplateColumns: "80px 1fr" } }, el("label", { class: "field" }, "Emoji", input("emoji")), el("label", { class: "field" }, "Series name", input("name"))),
          el("label", { class: "field" }, "What it's about", input("about")),
          el("label", { class: "field" }, "Content pillar", select("pillar", S.brand.pillars.map((p) => [p.id, p.name]))),
          el("label", { class: "field" }, "Footage folder (clips for this series)", select("folder", [["", "Any folder"], ...S.folders.map((f) => [f.id, f.name])]))),
        el("div", { class: "card" }, el("h2", {}, "Text on screen"),
          el("p", { class: "small muted" }, "Use {n} for the episode number, {total}, {date}, {word} for a one-word feeling, {place}."),
          el("label", { class: "field" }, "Title", input("title", { ph: "e.g. pilates class {n}/{total}" })),
          el("label", { class: "field" }, "Little label underneath (optional)", input("subtitle", { ph: "e.g. {date} · {word}" })),
          el("div", { class: "grid cols-3" },
            el("label", { class: "field" }, "Title colour", select("titleColor", [["white", "White"], ["pink", "Pink"], ["butter", "Butter"]])),
            el("label", { class: "field" }, "Capitals", select("titleCase", [["none", "As typed"], ["upper", "ALL CAPS"], ["lower", "all lowercase"]])),
            el("label", { class: "field" }, "Title size", select("titleSize", [["m", "Medium"], ["l", "Large"], ["xl", "Extra large"]])),
            el("label", { class: "field" }, "Layout", select("layout", [["stack", "Centred"], ["stagger", "Staggered (italic first word)"]])),
            el("label", { class: "field" }, "Label style", select("subStyle", [["script", "White script"], ["small", "Small white text"], ["pill", "On a pink label"]])),
            el("label", { class: "field" }, "Position", select("position", [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]])),
            el("label", { class: "field" }, "Show title", select("showTitle", [["start", "First 3 seconds"], ["whole", "Whole video"]])),
            el("label", { class: "field" }, "Captions", select("captions", [[true, "On"], [false, "Off"]])))),
        el("div", { class: "card" }, el("h2", {}, "Colours"), choice("palette", PALETTES, (p) => p.name)),
        el("div", { class: "card" }, el("h2", {}, "Fonts"),
          el("div", { class: "grid cols-2" },
            el("label", { class: "field" }, "Title font", fontSelect("title")),
            el("label", { class: "field" }, "Label font", fontSelect("sub"))),
          el("p", { class: "small muted" }, "Or start from one of your Brand Kit pairings:"),
          el("div", { class: "chips scroll" }, PAIRINGS.map((p) => el("button", { class: "chip", onclick: () => { d.fonts = { title: p.title, sub: p.primary }; render(); } }, p.name)))),
        el("div", { class: "card" }, el("h2", {}, "Editing"),
          el("div", { class: "grid cols-3" },
            el("label", { class: "field" }, "Zoom-ins", select("zoom", [["off", "None"], ["low", "Now and then"], ["medium", "Regularly"], ["high", "Lots"]])),
            el("label", { class: "field" }, "Cut pauses longer than (s)", input("pause", { type: "number" })),
            el("label", { class: "field" }, "Total episodes (blank = ongoing)", input("total", { type: "number" })),
            el("label", { class: "field" }, "Next episode number", input("next", { type: "number" })))),
        el("button", { class: "btn-ghost btn-danger", onclick: async () => {
          if (!confirm(`Delete the ${d.name} series template? Your footage and exported videos aren't affected.`)) return;
          await deleteSeries(d.id); seriesDraft = null; render();
        } }, "Delete this series"))),
  ];
}

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
    S.selecting ? el("div", { class: "card row" }, el("b", {}, `${S.selected.size} selected`), el("span", { class: "spacer" }),
      el("button", { class: "btn-pink", disabled: !S.selected.size, onclick: () => {
        const ids = [...S.selected]; // the order you tapped them
        location.href = `montage.html?clips=${ids.join(",")}`;
      } }, `🎬 Make a video${S.selected.size ? ` (${S.selected.size})` : ""}`),
      folderSel,
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
  const draft = await dbValue("montageDraft");
  return [
    el("div", { class: "page-head" }, el("h1", {}, "Create & ", el("em", {}, "edit")),
      el("p", {}, "Several clips → one smooth video, or one talking clip with automatic captions.")),
    el("div", { class: "card make-card" },
      el("div", {}, el("h2", {}, "🎬 Make a video from several clips"),
        el("p", { class: "small muted" }, "Pick clips & photos. It makes a smooth first edit (best bits, crossfades, gentle zooms) in your style. Then trim, reorder, add music and export.")),
      el("div", { class: "row" },
        el("button", { class: "btn-pink", onclick: () => { S.selecting = true; S.selected.clear(); location.hash = "#footage"; toast("Tap the clips you want, then 🎬 Make a video"); } }, "Choose clips"),
        draft?.clips?.length ? el("a", { class: "btn", href: "montage.html" }, `Continue draft (${draft.clips.length} clips)`) : null)),
    el("div", { class: "card" },
      el("div", { class: "card-head" }, el("h2", {}, "🎙 Talking clip: captions & cuts (one clip)"), el("button", { class: "btn-soft", onclick: () => pickUpload() }, "＋ Upload")),
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
  { id: "instagram", title: "From my Instagram", note: "What Claude learned from your profile, grid and series. Edit anything that's off.", fields: [["instagram.bio", "Bio", "textarea"], ["instagram.highlights", "Highlights", "list"], ["instagram.series", "My recurring series", "list"], ["instagram.textStyles", "How I use text on screen", "list"], ["instagram.visual", "Visual style", "list"], ["instagram.performance", "What performs", "list"]] },
  { id: "her", title: "My girl: who I'm talking to", note: "Every hook and caption is about HER life, not mine. Edit this as you learn more about her.", fields: [["her.who", "Everything I know about her", "list"], ["her.watches", "Why she watches", "textarea"], ["her.saves", "Why she saves", "textarea"], ["her.shares", "Why she shares", "textarea"], ["her.follows", "Why she follows", "textarea"], ["her.comments", "Why she comments", "textarea"]] },
  { id: "strategy", title: "Hook strategy", note: "How hooks get written for you. Method inspired by @its.amyjames.", fields: [["strategy.principles", "Principles", "list"], ["strategy.herLife", "Her life (what she's thinking about)", "list"]] },
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
  sectionCard(SECTIONS[0]), sectionCard(SECTIONS[1]), sectionCard(SECTIONS[6]), pillarsCard(), sectionCard(SECTIONS[2]), sectionCard(SECTIONS[3]),
  sectionCard(SECTIONS[4]), sectionCard(SECTIONS[7]), sectionCard(SECTIONS[5]), feedbackCard(), sectionCard(SECTIONS[8]), sectionCard(SECTIONS[9]), await historyCard(),
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

    el("div", { class: "card" }, el("div", { class: "card-head" }, el("h2", {}, "Your moodboard"),
      el("button", { class: "btn-soft", onclick: () => pickUpload(S.folders.find((f) => f.name === "Brand assets")?.id) }, "＋ Add photos")),
      el("p", { class: "small muted", style: { marginTop: 0 } }, "Built from your Brand assets & Inspiration photos plus the palette and fonts you've selected."),
      moodboard(pal, activePairing(), 9)),
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
let hookFilter = "all";
async function hookBank() { return (await dbValue("hookbank")) || { favs: [], mine: [] }; }
async function saveHookBank(h) { await dbSet("hookbank", h); }

VIEWS.hooks = async () => {
  const bank = await hookBank();
  const pillarName = (id) => S.brand.pillars.find((p) => p.id === id)?.name || "";
  const all = [...bank.mine.map((h) => ({ ...h, mine: true })), ...HOOKS];
  const list = all.filter((h) => hookFilter === "all" || (hookFilter === "fav" && bank.favs.includes(h.text)) || (hookFilter === "mine" && h.mine)
    || h.p === hookFilter || h.f === hookFilter || (hookFilter.startsWith("r:") && h.r === hookFilter.slice(2)));
  const chip = (id, label) => el("button", { class: "chip" + (hookFilter === id ? " on" : ""), onclick: () => { hookFilter = id; render(); } }, label);
  const hookCard = (h) => {
    const fav = bank.favs.includes(h.text);
    return el("div", { class: "hook-card" },
      el("p", { class: "hook-text" }, h.text),
      h.her ? el("p", { class: "hook-her" }, "she's thinking: “", h.her, "”") : null,
      el("div", { class: "row small" },
        h.f ? el("span", { class: "tag pink" }, FORMATS.find((x) => x.id === h.f)?.name) : null,
        h.t && !h.f ? el("span", { class: "tag" }, h.t) : null,
        h.p ? el("span", { class: "tag" }, pillarName(h.p)) : null,
        h.mine ? el("span", { class: "tag" }, "mine") : null,
        h.r ? el("span", { class: "tag resp" }, { save: "makes her save", share: "makes her share", comment: "makes her comment", follow: "makes her follow" }[h.r] || h.r) : null,
        el("span", { class: "spacer" }),
        el("button", { class: "btn-ghost", onclick: async () => { toast((await copyText(h.text)) ? "Copied ✓" : "Couldn't copy"); } }, "Copy"),
        el("button", { class: "btn-ghost", onclick: async () => {
          bank.favs = fav ? bank.favs.filter((t) => t !== h.text) : [...bank.favs, h.text]; await saveHookBank(bank); render();
        } }, fav ? "♥" : "♡"),
        h.mine ? el("button", { class: "btn-ghost btn-danger", onclick: async () => { bank.mine = bank.mine.filter((x) => x.id !== h.id); await saveHookBank(bank); render(); } }, "Delete") : null));
  };
  const addBox = el("input", { type: "text", placeholder: "Write your own hook…" });
  const addPillar = el("select", { style: { width: "auto" } }, S.brand.pillars.map((p) => el("option", { value: p.id }, p.name)));
  const addFormat = el("select", { style: { width: "auto" } }, el("option", { value: "" }, "No format"), FORMATS.map((f) => el("option", { value: f.id }, f.name)));
  return [
    el("div", { class: "page-head row" }, el("div", {}, el("h1", {}, "Hook ", el("em", {}, "Bank")),
      el("p", {}, "Every hook is about HER life, not yours: her 2am thoughts, her money, her future, the girl she's becoming. Your life is the proof. Tap ♡ to favourite.")),
      el("span", { class: "spacer" }),
      el("button", { class: "btn-pink", onclick: () => askClaudeHooks(bank) }, "✧ Ask Claude for more")),
    el("h2", { style: { margin: "6px 0 4px" } }, "The 6 hook formats"),
    el("p", { class: "small muted", style: { marginTop: 0 } }, "Method inspired by @its.amyjames. Tap a format to see your hooks for it."),
    el("div", { class: "format-grid" }, FORMATS.map((f, i) => el("button", { class: "format-card" + (hookFilter === f.id ? " on" : ""), onclick: () => { hookFilter = hookFilter === f.id ? "all" : f.id; render(); } },
      el("span", { class: "format-n" }, `hook 0${i + 1}`),
      el("b", { class: "format-name" }, f.name + "."),
      el("i", { class: "format-goal" }, f.goal),
      el("span", { class: "format-formula" }, f.formula),
      el("span", { class: "format-why" }, f.why)))),
    el("div", { class: "card", style: { marginTop: "18px" } },
      el("h3", {}, "Caption first lines (a second hook)"),
      el("div", { class: "chips", style: { marginTop: "8px" } }, CAPTION_OPENERS.map((c) => el("button", { class: "chip", onclick: async () => toast((await copyText(c)) ? "Copied ✓" : "Couldn't copy") }, c)))),
    el("div", { class: "card" },
      el("h3", {}, "Add your own"),
      el("div", { class: "row", style: { marginTop: "8px" } }, addBox, addPillar, addFormat,
        el("button", { class: "btn-pink", onclick: async () => {
          if (!addBox.value.trim()) return;
          bank.mine.unshift({ id: Date.now().toString(36), text: addBox.value.trim(), p: addPillar.value, f: addFormat.value || null, t: "my hook", k: [] });
          await saveHookBank(bank); toast("Added ✓"); render();
        } }, "Add"))),
    el("div", { class: "chips scroll", style: { margin: "16px 0 12px" } },
      chip("all", `All (${all.length})`), chip("fav", "♥ Favourites"), chip("mine", "My hooks"),
      chip("r:save", "Makes her save"), chip("r:share", "Makes her share"), chip("r:comment", "Makes her comment"), chip("r:follow", "Makes her follow"),
      S.brand.pillars.map((p) => chip(p.id, p.name)), FORMATS.map((f) => chip(f.id, f.name))),
    el("div", { class: "hook-list" }, list.map(hookCard)),
  ];
};

function askClaudeHooks(bank) {
  const b = S.brand;
  const prompt = `I'm Paige (@paigesuterx). Write 15 NEW hooks for my Reels in my voice.

ABOUT ME: ${b.identity.oneLiner} Message: ${b.identity.message}
${herBlock(b)}
My pillars: ${b.pillars.map((p) => `${p.name} (${p.topics.slice(0, 5).join(", ")})`).join("; ")}
How I write: ${(b.voice.style || []).join("; ")}
Tone examples (don't reuse): ${(b.voice.examples || []).join(" / ")}
Banned phrases: ${(b.voice.bannedPhrases || []).join(", ")}
Hook strategy: ${(b.strategy?.principles || []).join("; ")}
${(b.rules || []).length ? "Rules from my feedback: " + b.rules.join("; ") : ""}

${HER_RULES}
Use the 6 formats (age-based, list, emotive quote, identity maxxing, algorithm call-out, strong language), spread across my 4 pillars. Max ~14 words each, lowercase is fine.
Reply with ONLY one JSON code block:
\`\`\`json
{"hooks": [{"text": "...", "format": "age|list|emotive|identity|callout|strong", "pillar": "style|becoming|experiencing|little", "her": "the exact thought of hers it hits", "does": "save|share|comment|follow"}]}
\`\`\``;
  claudeSheet("Ask Claude for more hooks", prompt, async (data) => {
    const hooks = (data.hooks || []).filter((h) => h && h.text);
    hooks.forEach((h, i) => bank.mine.unshift({ id: Date.now().toString(36) + i, text: String(h.text), p: h.pillar || null, f: FORMATS.some((f) => f.id === h.format) ? h.format : null, t: "from Claude", her: h.her || "", r: h.does || "", k: [] }));
    await saveHookBank(bank);
    return hooks.length ? `Added ${hooks.length} hooks to "My hooks" ✓` : "No hooks found in that reply.";
  });
}

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
