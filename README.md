<div align="center">

# 🎬 Storyboard Tool

**Browser-based storyboarding for film pre-production**

*Draw it before you shoot it.*

Sketching · reference images · shot specs · runtime totals · drag-to-reorder · JSON project files · print-ready PDF — all in one static page. No build step, no backend, no account.

`HTML` · `CSS` · `Vanilla JS` · `Canvas API` · `localStorage` · `Zero dependencies`

**[Live app →](https://storyboard-tool-seven.vercel.app/)**

</div>

---
<img width="1895" height="938" alt="image" src="https://github.com/user-attachments/assets/3e87fb9d-9f7f-4131-bf57-38949232641c" />

## Table of contents

1. [Features](#features)
2. [Quick start](#quick-start)
3. [Deploying to Vercel](#deploying-to-vercel)
4. [Folder structure](#folder-structure)
5. [Project file format](#project-file-format)
6. [Reference images](#reference-images)
7. [Reusing for a new film](#reusing-for-a-new-film)
8. [Troubleshooting](#troubleshooting)
9. [Notes & limits](#notes--limits)
10. [License](#license)

---

## Features

- **Sketch on every frame** — pen (5 colours) / eraser with brush size, mouse and touch support, 16:9 canvas per shot, rule-of-thirds + title-safe guides.
- **Reference images** — drop a file on a frame, use the image button, or paste from the clipboard; move/resize, set opacity, and choose whether it sits behind or over your sketch (see [Reference images](#reference-images)).
- **Shot metadata** — size (ECU…EWS, OTS, POV, SCREEN), lens, camera move, duration, action notes, dialogue/sound (lens & move have autocomplete presets).
- **Runtime total** — the header sums every shot's duration.
- **Reorder / duplicate / delete** panels — drag the shot-number badge to reorder.
- **Reset & New** — Reset (with a confirm dialog) clears every sketch and reference image while keeping the shot list and specs; **New** wipes the whole board to a blank project.
- **Adjustable grid** — 2, 3 or 4 panels per row (default 4); remembered between sessions.
- **Autosave** — board persists in the browser (localStorage), with a status indicator that warns if storage is full.
- **Project files** — Export/Import as `.json` to archive boards or move between machines/projects (imports are validated and normalized).
- **PDF output** — Print → Save as PDF gives a clean printable board with a project masthead (2 panels per row), preserving sketch colours and reference images.
- **Example project** — loads `examples/playback.json` (the micro-short *PLAYBACK*, 14 shots) on first visit.

## Quick start

**Prerequisites:** a browser. That's it.

**Option A — just open it:** double-click `index.html`.
(On `file://` the example project can't be fetched; you get a blank board — use Import to load `examples/playback.json`.)

**Option B — serve it** (example loads automatically):

```bash
cd storyboard-tool
python -m http.server 8000
# open http://localhost:8000
```

No API keys. No environment variables. Nothing leaves your machine.

## Deploying to Vercel

**Option A — CLI** (fastest):

```bash
npm i -g vercel
cd storyboard-tool
vercel          # first deploy (accept defaults — it's detected as a static site)
vercel --prod   # production deploy
```

**Option B — Git:** push this folder to a GitHub/GitLab/Bitbucket repo → import it at [vercel.com/new](https://vercel.com/new) → Framework preset: **Other** → no build command, output directory: root → Deploy.

Every push to the main branch redeploys automatically. `vercel.json` ships the static config plus security headers.

## Folder structure

```
storyboard-tool/
├── index.html              # app shell
├── assets/
│   ├── favicon.svg         # site icon (film-frame mark)
│   ├── css/styles.css      # theme + print stylesheet
│   └── js/app.js           # all logic (state, canvas, photos, import/export)
├── examples/
│   └── playback.json       # sample project (PLAYBACK micro-short)
├── vercel.json             # Vercel static config + security headers
├── .gitignore
└── README.md
```

## Project file format

```json
{
  "title": "PROJECT NAME",
  "panels": [
    {
      "size": "WS",
      "lens": "24mm",
      "move": "Locked",
      "dur": "6s",
      "notes": "Action description",
      "dialogue": "Dialogue / sound notes",
      "img": "data:image/png;base64,... or null",
      "photo": {
        "src": "data:image/jpeg;base64,...",
        "ar": 1.777,
        "x": 0, "y": 0, "scale": 1,
        "opacity": 0.5,
        "behind": true
      }
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `img` | The **sketch** as a transparent PNG data-URL |
| `photo` | Optional (`null` when absent) — a **reference image** plus its placement |
| `photo.ar` | Image aspect ratio |
| `photo.x` / `y` / `scale` | Placement as fractions of the frame (resolution-independent) |
| `photo.opacity` | 0.1–1 |
| `photo.behind` | `true` = under the sketch, `false` = over it |

Both images are embedded data-URLs, so exported JSON files are fully self-contained. On import the file is validated (it must have a `panels` array) and every field is normalized, so older files (no `photo`) and hand-edited files load safely. Unknown fields (e.g. a legacy `shot`) are ignored.

## Reference images

Each panel can hold one reference image — a location photo, a frame grab, a lighting reference — to sketch over or annotate.

**Add:** click the image button in a panel's hover toolbar, **drag-and-drop** an image file onto the frame, or **paste** (Ctrl/Cmd-V) an image into the panel you last drew on.

**Adjust** (controls appear in the bar under the frame):

- **Edit** — drag the image to move it; drag the corner handle to resize. Drawing is paused while Edit is on, so you can position freely.
- **Behind ink / Over ink** — whether the photo sits under your sketch (default) or over it.
- **Opacity** — dim the photo (defaults to 50%) to trace over it.
- **✕** — remove the image (asks to confirm).

**Memory safeguards:** imported images are downscaled to 1280px max and re-encoded as JPEG before storage, so a single reference is small. Removing a photo (or deleting a panel) frees it for garbage collection. The autosave indicator turns red with *"Not saved — storage full"* if a board ever exceeds the browser's localStorage budget (~5MB) — export the `.json` and trim or drop a few references if you hit it. Export blob URLs are revoked after download so nothing is pinned in memory.

## Reusing for a new film

1. Open the app → **New project**
2. Add panels, sketch, fill specs
3. **Export project (.json)** → keep it next to your script in the project folder
4. Re-import any time to continue

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Blank board on first open | You opened via `file://` — the example project can't be fetched. Serve the folder (`python -m http.server`) or use Import to load `examples/playback.json`. |
| *"Not saved — storage full"* indicator | The board exceeds the browser's localStorage budget (~5MB). Export the `.json`, then trim panels or drop a few reference images. |
| Board missing after switching browsers | Autosave is per-browser. Export/Import the `.json` to move boards between machines or browsers. |
| Paste doesn't add an image | Paste targets the panel you last drew on — click/draw in the intended panel first, then Ctrl/Cmd-V. |
| Can't draw over a reference image | **Edit** mode is on (drawing pauses while positioning). Toggle Edit off to resume sketching. |
| PDF looks cramped | Print output intentionally uses 2 panels per row for readability, regardless of the on-screen grid. |

## Notes & limits

- Autosave is per-browser (localStorage, ~5MB). Export JSON for anything you can't afford to lose — the indicator warns when a board no longer fits.
- Sketches and reference images are stored as embedded data-URLs, so boards with many of them grow the JSON. Reference images are auto-downscaled to keep this in check; very large boards should be kept as exported `.json` master copies.
- No server = nothing leaves your machine except what you deploy.

## License

MIT — use it on any production.

---

<div align="center">Made by <strong>AJ</strong></div>
