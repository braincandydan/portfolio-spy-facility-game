# Field Operative — Portfolio

An interactive first-person portfolio site. Infiltrate the facility, walk the
halls, and recover intel caches that open your projects, skills, bio, and
contact info. Built with vanilla JS + [Three.js](https://threejs.org/) and
[Vite](https://vitejs.dev/) — no framework, no backend.

Originally mocked up as an HTML/CSS/JS prototype in Claude Design (kept for
reference in `design/prototype/`); this repo is the real, from-scratch
implementation.

## Run it

```bash
npm install
npm run dev       # dev server with hot reload
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

## Controls

`WASD` move · mouse look · `E` interact · `Tab` wristwatch (warp menu, intel
tracker, dossier, comms, settings) · `Esc` pause/close

## Make it yours

All placeholder content — your name, bio, links, resume, project list, and
skills — lives in one file:

```
src/content.js
```

Edit that and nothing else needs to change. Screenshots for the project
cards can go in `public/` and be referenced from there.

## Project structure

```
index.html            entry HTML
src/
  main.js              wires the Game engine to the UI
  content.js           <- edit this: your bio/projects/links/resume
  style.css            all visual styling (CRT overlay, HUD, watch, panels)
  ui.js                builds/updates the DOM from Game state
  audio.js             tiny WebAudio blip/hum engine
  game/
    Game.js             Three.js scene, first-person controls, game state
    level.js             facility geometry (walls, rooms, props, signage)
    zones.js             room layout, walkable regions, zone metadata
design/
  prototype/             original Claude Design export, kept for reference
```

## Extending the facility

- **Add a room / zone**: add an entry to `ZONES` and a walkable rect to
  `REGIONS` in `src/game/zones.js`, then add geometry for it in
  `src/game/level.js`.
- **Change the look**: colors, fonts, and the CRT effect are all in
  `src/style.css`.
- **Add a watch tab or panel**: `src/ui.js` renders the wristwatch tabs and
  content panels from small template functions — follow the existing pattern
  for `nav`/`intel`/`dossier`/`comms`/`sys`.

## Deploy

Static output in `dist/` after `npm run build` — deploy to GitHub Pages,
Vercel, Netlify, or any static host.
