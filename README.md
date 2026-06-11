# Storyboard Tool

A zero-dependency, browser-based storyboard app for film pre-production. Draw frames, set shot specs (size / lens / movement / duration), write action and dialogue notes, reorder shots, and export the whole board — all in a single static page. No build step, no backend, no account.

Built as part of the **CiniAssist** pipeline (script → storyboard → shoot → DaVinci Resolve edit/grade/deliver).

## Features

- **Sketch on every frame** — pen/eraser with brush size, mouse and touch support, 16:9 canvas per shot
- **Shot metadata** — size (ECU…EWS, OTS, POV, SCREEN), lens, camera move, duration, action notes, dialogue/sound
- **Reorder / duplicate / delete** panels
- **Autosave** — board persists in the browser (localStorage)
- **Project files** — Export/Import as `.json` to archive boards or move between machines/projects
- **PDF output** — Print → Save as PDF gives a clean printable board (2 panels per row)
- **Example project** — loads `examples/playback.json` (the micro-short *PLAYBACK*, 14 shots) on first visit

## Folder structure

```
storyboard-tool/
├── index.html              # app shell
├── assets/
│   ├── css/styles.css      # theme + print stylesheet
│   └── js/app.js           # all logic (state, canvas, import/export)
├── examples/
│   └── playback.json       # sample project (PLAYBACK micro-short)
├── vercel.json             # Vercel static config + security headers
├── .gitignore
└── README.md
```

## Run locally

Option A — just open it: double-click `index.html`.
(On `file://` the example project can't be fetched; you get a blank board — use Import to load `examples/playback.json`.)

Option B — serve it (example loads automatically):

```bash
cd storyboard-tool
python -m http.server 8000
# open http://localhost:8000
```

## Deploy to Vercel

**Via CLI** (fastest):

```bash
npm i -g vercel
cd storyboard-tool
vercel          # first deploy (accept defaults — it's detected as a static site)
vercel --prod   # production deploy
```

**Via Git**: push this folder to a GitHub/GitLab/Bitbucket repo → [vercel.com/new](https://vercel.com/new) → Import the repo → Framework preset: **Other** → no build command, output directory: root → Deploy.

Every push to the main branch redeploys automatically.

## Project file format

```json
{
  "title": "PROJECT NAME",
  "panels": [
    {
      "shot": "1",
      "size": "WS",
      "lens": "24mm",
      "move": "Locked",
      "dur": "6s",
      "notes": "Action description",
      "dialogue": "Dialogue / sound notes",
      "img": "data:image/png;base64,... or null"
    }
  ]
}
```

`img` stores the sketch as a PNG data-URL, so exported JSON files are fully self-contained.

## Reusing for a new film

1. Open the app → **New project**
2. Add panels, sketch, fill specs
3. **Export project (.json)** → keep it next to your script in the project folder
4. Re-import any time to continue

## Notes & limits

- Autosave is per-browser (localStorage). Export JSON for anything you can't afford to lose.
- Large boards with many detailed sketches grow the JSON (data-URLs); still fine for typical shorts.
- No server = nothing leaves your machine except what you deploy.

## License

MIT — use it on any production.
