# Exoplanet Detector — desktop app

This is the Orbital Pioneers exoplanet detection tool (ISRO BAH 2026, Challenge 7),
packaged as a standalone Electron desktop app. It's the same tool that ran in the
browser — light curve loading, spectrum simulation, Groq-based LLM classification,
results dashboard, and the PDF export — just running in its own window instead of
a browser tab.

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (includes npm)
- Internet access when you *use* the app — it calls the Groq API for classification
  and loads the PDF export library from a CDN. No internet is needed just to open
  the window and browse existing data.

## Run it in development

```bash
cd exoplanet-app
npm install
npm start
```

This opens the app in its own window. `npm install` only needs to be run once
(it downloads Electron itself, which is a few hundred MB).

## Build an installable app

`electron-builder` packages the app into a real installer/executable for a given
platform. Run the build **on the platform you're targeting** — Windows builds
are made on Windows, macOS builds (including signed/notarized ones) on macOS, etc.
Cross-building sometimes works but isn't guaranteed.

```bash
npm run dist:win     # → dist/*.exe  (NSIS installer)
npm run dist:mac     # → dist/*.dmg
npm run dist:linux   # → dist/*.AppImage
```

Or just `npm run dist` to build for whatever platform you're currently on.
Output lands in `dist/`.

## Project layout

```
exoplanet-app/
├── main.js        Electron main process — creates the window, loads index.html
├── index.html      The whole app (UI, styles, and logic) — unchanged from the
│                   browser version
├── package.json    App metadata + electron-builder packaging config
└── README.md
```

## Notes

- The window opens with Node integration **off** and context isolation **on** —
  the app doesn't need filesystem/OS access, so it runs with the same
  permissions as a browser tab, just in its own window with no browser chrome.
- Your Groq API key is only ever held in the renderer's memory (same as the
  browser version) — it's not written to disk by this app.
- To add a custom icon, drop `icon.ico` (Windows), `icon.icns` (macOS), and
  `icon.png` (Linux, 512×512) into a `build/` folder and reference them under
  `"win"`, `"mac"`, and `"linux"` in `package.json` — see the
  [electron-builder icon docs](https://www.electron.build/icons).
