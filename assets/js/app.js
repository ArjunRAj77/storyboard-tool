/* Storyboard Tool — vanilla JS, no dependencies.
 * State shape: { title: string, panels: [{size,lens,move,dur,notes,dialogue,img}] }
 * img = canvas drawing as dataURL (PNG). Autosaves to localStorage.
 */

const SHOT_SIZES = ["ECU","CU","MCU","MS","MWS","WS","EWS","OTS","POV","INSERT","SCREEN"];
const PEN_COLORS = ["#d8dfe6","#39c0d4","#e0a458","#e0605f","#7ee08a"];
const STORAGE_KEY = "storyboard";
const GRID_KEY = "storyboard-grid";

let state = { title: "Untitled Project", panels: [] };
let tool = "pen", brush = 3, penColor = PEN_COLORS[0];
let lastPanel = 0;            // panel that last received pointer focus (paste target)
const FRAME_AR = 16 / 9;      // canvas/frame aspect ratio
const PHOTO_MAX = 1280;       // downscale imported images to this max dimension

/* ---------- themed dialog (replaces native confirm/alert) ----------
 * uiConfirm(opts) -> Promise<boolean>;  uiAlert(title,msg) -> Promise<void>.
 * Esc / backdrop = cancel, Enter = confirm. Listeners are removed on close. */
function uiConfirm({ title = "Are you sure?", message = "", confirmText = "Confirm", cancelText = "Cancel", danger = false, alert = false } = {}){
  return new Promise(resolve => {
    const m = document.getElementById("modal");
    const ok = document.getElementById("modalOk");
    const cancel = document.getElementById("modalCancel");
    document.getElementById("modalTitle").textContent = title;
    document.getElementById("modalMsg").textContent = message;   // CSS white-space:pre-line keeps \n
    ok.textContent = confirmText;
    cancel.textContent = cancelText;
    ok.className = "btn " + (danger ? "danger" : "primary");
    m.classList.toggle("alert", alert);
    m.classList.add("open");
    m.setAttribute("aria-hidden", "false");

    const close = val => {
      m.classList.remove("open");
      m.setAttribute("aria-hidden", "true");
      ok.removeEventListener("click", onOk);
      cancel.removeEventListener("click", onCancel);
      m.removeEventListener("mousedown", onBackdrop);
      document.removeEventListener("keydown", onKey);
      resolve(val);
    };
    const onOk = () => close(true);
    const onCancel = () => close(false);
    const onBackdrop = e => { if (e.target === m) close(false); };
    const onKey = e => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter"){ e.preventDefault(); close(true); }
    };
    ok.addEventListener("click", onOk);
    cancel.addEventListener("click", onCancel);
    m.addEventListener("mousedown", onBackdrop);
    document.addEventListener("keydown", onKey);
    ok.focus();
  });
}
function uiAlert(title, message){ return uiConfirm({ title, message, confirmText: "OK", alert: true }); }

/* escape for safe interpolation into HTML attributes / text content */
function esc(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function blankPanel(){
  return { size:"MS", lens:"35mm", move:"Locked", dur:"4s", notes:"", dialogue:"", img:null, photo:null };
}

/* normalize any loaded project (import / localStorage / example) into a known-good
 * shape: guarantees every field exists and every photo has valid, finite values so
 * a hand-edited or older file can't crash render(). Drops unknown fields. */
function normPhoto(ph){
  if (!ph || typeof ph.src !== "string") return null;
  const num = (v, d) => Number.isFinite(+v) ? +v : d;
  const ar = num(ph.ar, FRAME_AR);
  return {
    src: ph.src,
    ar: ar > 0 ? ar : FRAME_AR,
    x: num(ph.x, 0),
    y: num(ph.y, 0),
    scale: num(ph.scale, 1) > 0 ? num(ph.scale, 1) : 1,
    opacity: Math.max(0.1, Math.min(1, num(ph.opacity, 0.5))),
    behind: ph.behind !== false,
    edit: false                                   // never restore in edit mode
  };
}
function normPanel(p){
  p = p || {};
  return {
    size: p.size || "MS",
    lens: p.lens != null ? String(p.lens) : "35mm",
    move: p.move != null ? String(p.move) : "Locked",
    dur:  p.dur  != null ? String(p.dur)  : "4s",
    notes: p.notes || "",
    dialogue: p.dialogue || "",
    img: typeof p.img === "string" ? p.img : null,
    photo: normPhoto(p.photo)
  };
}
function normalizeState(s){
  if (!s || typeof s !== "object" || !Array.isArray(s.panels)) return null;
  return {
    title: typeof s.title === "string" ? s.title : "Untitled Project",
    panels: s.panels.map(normPanel)
  };
}

function addPanel(data){ state.panels.push(data || blankPanel()); render(); save(); }

function newProject(){
  uiConfirm({
    title: "Start a new project?",
    message: "This clears ALL panels and starts a blank project.\n\nThis can't be undone — export first if you want to keep this board.",
    confirmText: "New project", danger: true
  }).then(ok => {
    if (!ok) return;
    state = { title: "Untitled Project", panels: [blankPanel()] };
    render(); save();
  });
}

/* quick reset: wipe every sketch + reference image but keep the shot list,
 * specs and notes. Guarded by an approval dialog (can't be undone). */
function resetBoard(){
  if (!state.panels.length) return;
  uiConfirm({
    title: "Reset the board?",
    message: "This clears every sketch and reference image from all " + state.panels.length
      + " shots. Shot specs and notes are kept.\n\nThis can't be undone.",
    confirmText: "Reset", danger: true
  }).then(ok => {
    if (!ok) return;
    state.panels.forEach(p => { p.img = null; p.photo = null; });
    render(); save();
  });
}

/* ---- grid size (UI preference, 2–4 columns, default 4) ---- */
function setGrid(n){
  n = Math.min(4, Math.max(2, n || 4));
  document.documentElement.style.setProperty("--cols", n);
  document.getElementById("gridSize").value = n;
  try { localStorage.setItem(GRID_KEY, n); } catch(e){}
}

/* ---- total runtime: sum the numeric part of each shot's Dur ---- */
function runtime(){
  let s = 0;
  state.panels.forEach(p => { const m = String(p.dur || "").match(/[\d.]+/); if (m) s += parseFloat(m[0]); });
  const mm = Math.floor(s / 60), ss = Math.round(s % 60);
  return mm ? `${mm}m ${ss}s` : `${ss}s`;
}

/* ---- header read-outs (runtime chip + print masthead) ---- */
function refreshMeta(){
  document.getElementById("runtime").textContent = runtime();
  document.getElementById("pmTitle").textContent = state.title;
  document.getElementById("pmMeta").textContent = `${state.panels.length} shots · ~${runtime()} runtime`;
}

let saveT, storageOk = true;
function save(){
  state.title = document.getElementById("title").value;
  refreshMeta();
  const chip = document.getElementById("saveChip");
  const txt = document.getElementById("saveTxt");
  txt.textContent = "Saving…";
  chip.classList.add("saving"); chip.classList.remove("warn");
  // localStorage is capped (~5MB). If a board of sketches + reference photos
  // exceeds it, surface the failure instead of silently losing the autosave.
  storageOk = true;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch(e){ storageOk = false; }
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    chip.classList.remove("saving");
    if (storageOk){ txt.textContent = "Saved"; }
    else { txt.textContent = "Not saved — storage full"; chip.classList.add("warn"); }
  }, storageOk ? 450 : 0);
}

function render(){
  document.getElementById("title").value = state.title;
  refreshMeta();
  const b = document.getElementById("board");
  b.innerHTML = "";
  state.panels.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.i = i;
    const ph = p.photo;
    const hf = ph ? ph.scale * FRAME_AR / ph.ar : 0; // displayed height as fraction of frame
    card.innerHTML = `
      <div class="chead">
        <div class="badge" draggable="true" title="Drag to reorder">${i+1}</div>
        <div class="clabel">Shot ${i+1}</div>
        <div class="ops">
          <button onclick="document.getElementById('pin${i}').click()" title="Add reference image"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="10" r="1.6" fill="currentColor"/><path d="M21 16l-5-5-4 4-2-2-7 7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button onclick="dupPanel(${i})" title="Duplicate"><svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.6"/></svg></button>
          <button onclick="clearCanvas(${i})" title="Clear drawing"><svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 4v4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="del" onclick="delPanel(${i})" title="Delete"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
          <input type="file" id="pin${i}" accept="image/*" style="display:none" onchange="onPhotoPick(${i},event)">
        </div>
      </div>
      <div class="frame${p.img ? ' inked' : ''}${tool === 'eraser' ? ' erase' : ''}${ph ? ' hasphoto' : ''}${ph && !ph.behind ? ' photofront' : ''}${ph && ph.edit ? ' editphoto' : ''}">
        ${ph ? `<img class="photo" src="${ph.src}" draggable="false" style="left:${ph.x*100}%;top:${ph.y*100}%;width:${ph.scale*100}%;opacity:${ph.opacity}">` : ""}
        <canvas width="800" height="450"></canvas>
        <div class="overlay"><span class="ln v1"></span><span class="ln v2"></span><span class="ln h1"></span><span class="ln h2"></span><span class="safe"></span></div>
        <div class="placeholder"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4-1 9-9a2 2 0 00-3-3l-9 9-1 4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>draw here</div>
        ${ph && ph.edit ? `<span class="phandle" style="left:${(ph.x+ph.scale)*100}%;top:${(ph.y+hf)*100}%"></span>` : ""}
      </div>
      ${ph ? `<div class="photobar">
        <button class="pbtn${ph.edit ? ' on' : ''}" onclick="togglePhotoEdit(${i})" title="Move / resize image"><svg viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18M8 7l4-4 4 4M8 17l4 4 4-4M7 8l-4 4 4 4M17 8l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Edit</button>
        <button class="pbtn" onclick="togglePhotoLayer(${i})" title="Layer order vs. drawing">${ph.behind ? "Behind ink" : "Over ink"}</button>
        <label class="popacity">Opacity <input type="range" min="10" max="100" value="${Math.round(ph.opacity*100)}" oninput="setPhotoOpacity(${i},this.value)"></label>
        <button class="pbtn del" onclick="removePhoto(${i})" title="Remove image"><svg viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg></button>
      </div>` : ""}
      <div class="tools">
        <div class="seg">
          <button class="${tool==='pen'?'active':''}" onclick="tool='pen';render()"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4-1 9-9a2 2 0 00-3-3l-9 9-1 4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>Pen</button>
          <button class="${tool==='eraser'?'active':''}" onclick="tool='eraser';render()"><svg viewBox="0 0 24 24" fill="none"><path d="M5 14l6-6 7 7-4 4H9l-4-4z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 19h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>Eraser</button>
        </div>
        <div class="swatches">${PEN_COLORS.map(c => `<span class="swatch${c===penColor?' active':''}" style="background:${c}" onclick="penColor='${c}';tool='pen';render()"></span>`).join("")}</div>
        <div class="brush"><span class="dot" style="width:${brush}px;height:${brush}px"></span><input type="range" min="1" max="20" value="${brush}" oninput="brush=+this.value;this.previousElementSibling.style.width=brush+'px';this.previousElementSibling.style.height=brush+'px'"></div>
      </div>
      <div class="meta">
        <div class="field"><svg viewBox="0 0 24 24" fill="none"><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M4 10h16" stroke="currentColor" stroke-width="1.3"/></svg><div class="col"><label>Size</label><select onchange="state.panels[${i}].size=this.value;save()">${SHOT_SIZES.map(s => `<option ${s===p.size?'selected':''}>${s}</option>`).join("")}</select></div></div>
        <div class="field"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.3"/></svg><div class="col"><label>Lens</label><input list="lenses" value="${esc(p.lens)}" onchange="state.panels[${i}].lens=this.value;save()"></div></div>
        <div class="field"><svg viewBox="0 0 24 24" fill="none"><path d="M4 12h16M16 8l4 4-4 4M8 16l-4-4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="col"><label>Move</label><input list="moves" value="${esc(p.move)}" onchange="state.panels[${i}].move=this.value;save()"></div></div>
        <div class="field"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="13" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M12 9v4l2.5 2M9 3h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg><div class="col"><label>Dur</label><input value="${esc(p.dur)}" onchange="state.panels[${i}].dur=this.value;save()"></div></div>
      </div>
      <textarea placeholder="Action / notes" onchange="state.panels[${i}].notes=this.value;save()">${esc(p.notes)}</textarea>
      <textarea placeholder="Dialogue / sound" onchange="state.panels[${i}].dialogue=this.value;save()">${esc(p.dialogue)}</textarea>`;
    b.appendChild(card);
    bindCanvas(card.querySelector("canvas"), card.querySelector(".frame"), i);
    bindDrag(card, i);
    bindPhoto(card.querySelector(".frame"), i);
  });
}

function bindCanvas(cv, frame, i){
  const ctx = cv.getContext("2d");
  const p = state.panels[i];
  if (p.img){ const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = p.img; }

  let drawing = false, last = null;
  const pos = e => {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x:(t.clientX-r.left)*cv.width/r.width, y:(t.clientY-r.top)*cv.height/r.height };
  };
  const start = e => { drawing = true; last = pos(e); lastPanel = i; frame.classList.add("inked"); e.preventDefault(); };
  const move = e => {
    if (!drawing) return;
    const pt = pos(e);
    // eraser clears to transparency (clean in print/PDF); pen draws in penColor
    ctx.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    ctx.strokeStyle = penColor;
    ctx.lineWidth = tool === "eraser" ? brush*4 : brush;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    ctx.globalCompositeOperation = "source-over";
    last = pt; e.preventDefault();
  };
  const end = () => { if (drawing){ drawing = false; state.panels[i].img = cv.toDataURL(); save(); } };

  // all listeners scoped to this canvas — no global listeners accumulate per render.
  // mouseleave ends the stroke if the pointer is released outside the canvas.
  cv.addEventListener("mousedown", start);
  cv.addEventListener("mousemove", move);
  cv.addEventListener("mouseup", end);
  cv.addEventListener("mouseleave", end);
  cv.addEventListener("touchstart", start);
  cv.addEventListener("touchmove", move);
  cv.addEventListener("touchend", end);
}

/* ---- drag-to-reorder via the shot-number badge ---- */
let dragFrom = null;
function bindDrag(card, i){
  const badge = card.querySelector(".badge");
  badge.addEventListener("dragstart", e => { dragFrom = i; card.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; });
  badge.addEventListener("dragend", () => { card.classList.remove("dragging"); document.querySelectorAll(".card").forEach(c => c.classList.remove("dragover")); });
  card.addEventListener("dragover", e => { e.preventDefault(); card.classList.add("dragover"); });
  card.addEventListener("dragleave", () => card.classList.remove("dragover"));
  card.addEventListener("drop", e => {
    e.preventDefault();
    card.classList.remove("dragover");
    // dropping an image file onto a card loads it as that panel's reference photo
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith("image/")){ loadImageToPanel(i, f); return; }
    if (dragFrom === null || dragFrom === i) return;
    const [m] = state.panels.splice(dragFrom, 1);
    state.panels.splice(i, 0, m);
    dragFrom = null;
    render(); save();
  });
}

/* ---------------- reference photo layer ----------------
 * Stored per panel as: photo = { src, ar, x, y, scale, opacity, behind, edit }
 *   x,y,scale  -> fractions of the frame (resolution-independent)
 *   ar         -> image aspect ratio (w/h)
 * The photo is a DOM <img> behind/over the transparent ink canvas, so the
 * eraser (which clears the canvas) never touches it. */

function onPhotoPick(i, ev){
  const f = ev.target.files[0];
  if (f && f.type.startsWith("image/")) loadImageToPanel(i, f);
  ev.target.value = "";
}

function loadImageToPanel(i, file){
  const fr = new FileReader();
  fr.onload = () => {
    const im = new Image();
    im.onload = () => {
      // downscale to keep localStorage within budget
      let w = im.naturalWidth, h = im.naturalHeight;
      const sc = Math.min(1, PHOTO_MAX / Math.max(w, h));
      w = Math.round(w * sc); h = Math.round(h * sc);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      c.getContext("2d").drawImage(im, 0, 0, w, h);
      const src = c.toDataURL("image/jpeg", 0.85);
      const ar = im.naturalWidth / im.naturalHeight;
      // contain-fit inside the 16:9 frame
      let scale, x, y;
      if (ar > FRAME_AR){ scale = 1; x = 0; y = (1 - FRAME_AR / ar) / 2; }
      else { scale = ar / FRAME_AR; x = (1 - scale) / 2; y = 0; }
      state.panels[i].photo = { src, ar, x, y, scale, opacity: 0.5, behind: true, edit: false };
      render(); save();
      if (!storageOk){
        uiAlert("Storage full", "Image added, but the project is now too large to autosave in this browser. " +
              "Export the project (.json) to keep it safe, or remove some reference images.");
      }
    };
    im.src = fr.result;
  };
  fr.readAsDataURL(file);
}

function togglePhotoEdit(i){ const p = state.panels[i].photo; if (!p) return; p.edit = !p.edit; render(); }
function togglePhotoLayer(i){ const p = state.panels[i].photo; if (!p) return; p.behind = !p.behind; render(); save(); }
function removePhoto(i){
  if (!state.panels[i].photo) return;
  uiConfirm({ title: "Remove reference image?", message: "Remove the reference image from shot " + (i+1) + "? Your sketch is kept.", confirmText: "Remove", danger: true })
    .then(ok => {
      if (!ok) return;
      state.panels[i].photo = null;   // dropping the reference frees its data-URL for GC
      render(); save();
    });
}

let opT;
function setPhotoOpacity(i, v){
  const p = state.panels[i].photo; if (!p) return;
  p.opacity = Math.max(0.1, Math.min(1, v / 100));
  const card = document.querySelectorAll(".card")[i];
  const img = card && card.querySelector(".photo");
  if (img) img.style.opacity = p.opacity;        // live, no re-render
  clearTimeout(opT); opT = setTimeout(save, 300);
}

/* drag-to-move and corner-resize, active only while the panel is in edit mode */
function bindPhoto(frame, i){
  const p = state.panels[i].photo;
  if (!p || !p.edit) return;
  const img = frame.querySelector(".photo");
  const handle = frame.querySelector(".phandle");
  if (!img) return;

  const restyle = () => {
    img.style.left = p.x*100 + "%"; img.style.top = p.y*100 + "%"; img.style.width = p.scale*100 + "%";
    if (handle){ const hf = p.scale*FRAME_AR/p.ar; handle.style.left = (p.x+p.scale)*100 + "%"; handle.style.top = (p.y+hf)*100 + "%"; }
  };
  const frac = e => { const r = frame.getBoundingClientRect(); return { fx:(e.clientX-r.left)/r.width, fy:(e.clientY-r.top)/r.height }; };

  let mode = null, ox = 0, oy = 0;
  const mv = e => {
    const { fx, fy } = frac(e);
    if (mode === "move"){ p.x = fx - ox; p.y = fy - oy; }
    else if (mode === "resize"){ p.scale = Math.max(0.05, Math.min(3, fx - p.x)); }
    restyle(); e.preventDefault();
  };
  const up = () => { mode = null; window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); save(); };
  const down = (e, m) => {
    mode = m; const { fx, fy } = frac(e); ox = fx - p.x; oy = fy - p.y;
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up);
    e.preventDefault(); e.stopPropagation();
  };
  img.addEventListener("mousedown", e => down(e, "move"));
  if (handle) handle.addEventListener("mousedown", e => down(e, "resize"));
}

function dupPanel(i){ state.panels.splice(i+1, 0, JSON.parse(JSON.stringify(state.panels[i]))); render(); save(); }
function delPanel(i){
  uiConfirm({ title: "Delete shot " + (i+1) + "?", message: "This removes the shot, its sketch and any reference image.", confirmText: "Delete", danger: true })
    .then(ok => { if (!ok) return; state.panels.splice(i,1); render(); save(); });
}
function clearCanvas(i){ state.panels[i].img = null; render(); save(); }

function exportJSON(){
  save();
  const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type:"application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = (state.title.replace(/\s+/g, "_") || "storyboard") + ".json";
  a.click();
  // release the blob URL so it isn't pinned in memory after the download
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function importJSON(ev){
  const f = ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    let parsed;
    try { parsed = JSON.parse(r.result); }
    catch(e){ uiAlert("Import failed", "Could not read that file — it isn't valid JSON."); return; }
    const ns = normalizeState(parsed);
    if (!ns){ uiAlert("Import failed", 'That JSON isn\'t a storyboard project (it needs a "panels" list).'); return; }
    if (!ns.panels.length) ns.panels = [blankPanel()];
    state = ns;
    render(); save();
    if (!storageOk){
      uiAlert("Imported, but not saved", "Project imported, but it's too large to autosave in this browser. " +
            "It's loaded for this session — keep the .json file as your master copy.");
    }
  };
  r.readAsText(f);
  ev.target.value = "";
}

document.getElementById("title").addEventListener("change", save);

/* paste an image from the clipboard into the last-focused panel */
document.addEventListener("paste", e => {
  const items = e.clipboardData && e.clipboardData.items;
  if (!items || !state.panels[lastPanel]) return;
  for (const it of items){
    if (it.type.startsWith("image/")){ const f = it.getAsFile(); if (f) loadImageToPanel(lastPanel, f); break; }
  }
});

/* ---- boot: restore session, else try bundled example, else blank ---- */
(function boot(){
  const pmDate = document.getElementById("pmDate");
  if (pmDate) pmDate.textContent = new Date().toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });

  try { setGrid(+localStorage.getItem(GRID_KEY) || 4); } catch(e){ setGrid(4); }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s){ const ns = normalizeState(JSON.parse(s)); if (ns) state = ns; }
  } catch(e){}
  if (state.panels && state.panels.length){ render(); return; }

  // fetch works when served over http(s) (Vercel / local server); falls back on file://
  fetch("examples/playback.json")
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { state = normalizeState(data) || { title:"Untitled Project", panels:[blankPanel()] }; render(); save(); })
    .catch(() => { state = { title:"Untitled Project", panels:[blankPanel()] }; render(); });
})();
