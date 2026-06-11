/* Storyboard Tool — vanilla JS, no dependencies.
 * State shape: { title: string, panels: [{shot,size,lens,move,dur,notes,dialogue,img}] }
 * img = canvas drawing as dataURL (PNG). Autosaves to localStorage.
 */

const SHOT_SIZES = ["ECU","CU","MCU","MS","MWS","WS","EWS","OTS","POV","INSERT","SCREEN"];
const STORAGE_KEY = "storyboard";

let state = { title: "Untitled Project", panels: [] };
let tool = "pen", brush = 3;

function blankPanel(){
  return { shot:"", size:"MS", lens:"35mm", move:"Locked", dur:"4s", notes:"", dialogue:"", img:null };
}

function addPanel(data){ state.panels.push(data || blankPanel()); render(); save(); }

function newProject(){
  if (confirm("Clear ALL panels and start a new project?")){
    state = { title: "Untitled Project", panels: [blankPanel()] };
    render(); save();
  }
}

function render(){
  document.getElementById("title").value = state.title;
  const b = document.getElementById("board");
  b.innerHTML = "";
  state.panels.forEach((p, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3><span>SHOT ${i+1}</span>
        <span class="ops">
          <button onclick="movePanel(${i},-1)" title="Move left">&#8592;</button>
          <button onclick="movePanel(${i},1)" title="Move right">&#8594;</button>
          <button onclick="dupPanel(${i})" title="Duplicate">&#10697;</button>
          <button onclick="clearCanvas(${i})" title="Clear drawing">&#10227;</button>
          <button onclick="delPanel(${i})" title="Delete">&#10005;</button>
        </span></h3>
      <canvas width="800" height="450" id="cv${i}"></canvas>
      <div class="tools">
        <button class="${tool==='pen'?'active':''}" onclick="tool='pen';render()">Pen</button>
        <button class="${tool==='eraser'?'active':''}" onclick="tool='eraser';render()">Eraser</button>
        <label style="font-size:11px;color:var(--dim)">Size
          <input type="range" min="1" max="20" value="${brush}" oninput="brush=+this.value">
        </label>
      </div>
      <div class="meta">
        <div><label>Size</label><select onchange="state.panels[${i}].size=this.value;save()">
          ${SHOT_SIZES.map(s => `<option ${s===p.size?'selected':''}>${s}</option>`).join("")}
        </select></div>
        <div><label>Lens</label><input value="${p.lens}" onchange="state.panels[${i}].lens=this.value;save()"></div>
        <div><label>Move</label><input value="${p.move}" onchange="state.panels[${i}].move=this.value;save()"></div>
        <div><label>Dur</label><input value="${p.dur}" onchange="state.panels[${i}].dur=this.value;save()"></div>
      </div>
      <textarea placeholder="Action / notes" onchange="state.panels[${i}].notes=this.value;save()">${p.notes}</textarea>
      <textarea placeholder="Dialogue / sound" onchange="state.panels[${i}].dialogue=this.value;save()">${p.dialogue}</textarea>`;
    b.appendChild(card);
    bindCanvas(card.querySelector("canvas"), i);
  });
}

function bindCanvas(cv, i){
  const ctx = cv.getContext("2d");
  const p = state.panels[i];
  if (p.img){ const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0); im.src = p.img; }

  let drawing = false, last = null;
  const pos = e => {
    const r = cv.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x:(t.clientX-r.left)*cv.width/r.width, y:(t.clientY-r.top)*cv.height/r.height };
  };
  const start = e => { drawing = true; last = pos(e); e.preventDefault(); };
  const move = e => {
    if (!drawing) return;
    const pt = pos(e);
    ctx.strokeStyle = tool === "eraser" ? "#0a0d10" : "#c8cfd6";
    ctx.lineWidth = tool === "eraser" ? brush*4 : brush;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(pt.x, pt.y); ctx.stroke();
    last = pt; e.preventDefault();
  };
  const end = () => { if (drawing){ drawing = false; state.panels[i].img = cv.toDataURL(); save(); } };

  cv.addEventListener("mousedown", start);
  cv.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
  cv.addEventListener("touchstart", start);
  cv.addEventListener("touchmove", move);
  cv.addEventListener("touchend", end);
}

function movePanel(i, d){
  const j = i + d;
  if (j < 0 || j >= state.panels.length) return;
  [state.panels[i], state.panels[j]] = [state.panels[j], state.panels[i]];
  render(); save();
}
function dupPanel(i){ state.panels.splice(i+1, 0, JSON.parse(JSON.stringify(state.panels[i]))); render(); save(); }
function delPanel(i){ if (confirm("Delete shot " + (i+1) + "?")){ state.panels.splice(i,1); render(); save(); } }
function clearCanvas(i){ state.panels[i].img = null; render(); save(); }

function save(){
  state.title = document.getElementById("title").value;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch(e){ /* storage full/blocked */ }
}

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
