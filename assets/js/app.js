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

/* escape for safe interpolation into HTML attributes / text content */
function esc(v){
  return String(v == null ? "" : v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function blankPanel(){
  return { size:"MS", lens:"35mm", move:"Locked", dur:"4s", notes:"", dialogue:"", img:null };
}

function addPanel(data){ state.panels.push(data || blankPanel()); render(); save(); }

function newProject(){
  if (confirm("Clear ALL panels and start a new project?")){
    state = { title: "Untitled Project", panels: [blankPanel()] };
    render(); save();
  }
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

let saveT;
function save(){
  state.title = document.getElementById("title").value;
  refreshMeta();
  const chip = document.getElementById("saveChip");
  document.getElementById("saveTxt").textContent = "Saving…";
  chip.classList.add("saving");
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){ /* storage full/blocked */ }
  clearTimeout(saveT);
  saveT = setTimeout(() => { document.getElementById("saveTxt").textContent = "Saved"; chip.classList.remove("saving"); }, 450);
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
    card.innerHTML = `
      <div class="chead">
        <div class="badge" draggable="true" title="Drag to reorder">${i+1}</div>
        <div class="clabel">Shot ${i+1}</div>
        <div class="ops">
          <button onclick="dupPanel(${i})" title="Duplicate"><svg viewBox="0 0 24 24" fill="none"><rect x="8" y="8" width="12" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" stroke="currentColor" stroke-width="1.6"/></svg></button>
          <button onclick="clearCanvas(${i})" title="Clear drawing"><svg viewBox="0 0 24 24" fill="none"><path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 4v4h4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="del" onclick="delPanel(${i})" title="Delete"><svg viewBox="0 0 24 24" fill="none"><path d="M5 7h14M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m1 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
        </div>
      </div>
      <div class="frame${p.img ? ' inked' : ''}">
        <canvas width="800" height="450"></canvas>
        <div class="overlay"><span class="ln v1"></span><span class="ln v2"></span><span class="ln h1"></span><span class="ln h2"></span><span class="safe"></span></div>
        <div class="placeholder"><svg viewBox="0 0 24 24" fill="none"><path d="M4 20l4-1 9-9a2 2 0 00-3-3l-9 9-1 4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>draw here</div>
      </div>
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
  const start = e => { drawing = true; last = pos(e); frame.classList.add("inked"); e.preventDefault(); };
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
    if (dragFrom === null || dragFrom === i) return;
    const [m] = state.panels.splice(dragFrom, 1);
    state.panels.splice(i, 0, m);
    dragFrom = null;
    render(); save();
  });
}

function dupPanel(i){ state.panels.splice(i+1, 0, JSON.parse(JSON.stringify(state.panels[i]))); render(); save(); }
function delPanel(i){ if (confirm("Delete shot " + (i+1) + "?")){ state.panels.splice(i,1); render(); save(); } }
function clearCanvas(i){ state.panels[i].img = null; render(); save(); }

function exportJSON(){
  save();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type:"application/json" }));
  a.download = (state.title.replace(/\s+/g, "_") || "storyboard") + ".json";
  a.click();
}

function importJSON(ev){
  const f = ev.target.files[0];
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { state = JSON.parse(r.result); render(); save(); }
    catch(e){ alert("Not a valid storyboard JSON file."); }
  };
  r.readAsText(f);
  ev.target.value = "";
}

document.getElementById("title").addEventListener("change", save);

/* ---- boot: restore session, else try bundled example, else blank ---- */
(function boot(){
  const pmDate = document.getElementById("pmDate");
  if (pmDate) pmDate.textContent = new Date().toLocaleDateString(undefined, { year:"numeric", month:"long", day:"numeric" });

  try { setGrid(+localStorage.getItem(GRID_KEY) || 4); } catch(e){ setGrid(4); }
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s){ state = JSON.parse(s); }
  } catch(e){}
  if (state.panels && state.panels.length){ render(); return; }

  // fetch works when served over http(s) (Vercel / local server); falls back on file://
  fetch("examples/playback.json")
    .then(r => r.ok ? r.json() : Promise.reject())
    .then(data => { state = data; render(); save(); })
    .catch(() => { state = { title:"Untitled Project", panels:[blankPanel()] }; render(); });
})();
