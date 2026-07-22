# Blender → Field Operative Asset Pipeline

How to author props, weapons, and gadgets in Blender and drop them into this Three.js game.

The game always boots without custom assets. Each entry in [`src/game/assets.js`](../src/game/assets.js) has a **procedural fallback**. When you add a `.glb`, the loader prefers it and applies nearest-neighbor filtering for the N64 look.

---

## 1. Modeling conventions

| Rule | Why |
|------|-----|
| **1 Blender unit = 1 meter** | Matches the facility scale (player eye height ≈ 1.7 m, doors ≈ 3.2 m) |
| **Origin at the object's "feet"** | Props sit correctly on the floor when `position.y = height/2` or when the mesh origin is on the ground plane |
| **Low poly: ~200–800 tris per prop** | N64 / PS1 aesthetic; the renderer is intentionally pixelated |
| **Apply scale / rotation** (`Ctrl+A`) before export | Avoids weird transforms in Three.js |
| **+Y up, -Z forward** | Blender glTF export default; matches Three.js |

Weapon / viewmodel tips:
- Model the pistol pointing down **-Z** (barrel toward -Z).
- Keep the grip near the origin so the viewmodel offset in code (`0.32, -0.3, -0.55`) still looks right.
- Separate a small empty named `muzzle` at the barrel tip if you want precise muzzle flashes later (optional — code also places a default muzzle).

---

## 2. Texturing

1. **UV unwrap** (`U` → Unwrap / Smart UV Project).
2. Prefer a **single 128×128 or 256×256** image texture per object.
3. Paint in Texture Paint, or bake from a higher-res source.
4. **No PBR needed.** The game uses Lambert / Basic materials. A diffuse (Base Color) map is enough. Skip roughness/metal/normal maps unless you specifically want them.
5. Keep contrast high and colors limited — they read better under the CRT pixelation filter.

In Blender's material:
- Principled BSDF → plug your image into **Base Color** only.
- The loader will force `NearestFilter` on every texture so it stays crunchy.

---

## 3. Export as glTF 2.0 (`.glb`)

1. Select the object(s) to export.
2. **File → Export → glTF 2.0**
3. Recommended settings:

| Setting | Value |
|---------|-------|
| Format | **glTF Binary (.glb)** |
| Include | Selected Objects (or Visible) |
| Transform | +Y Up |
| Geometry → Apply Modifiers | **On** |
| Geometry → UVs / Normals | On |
| Materials | Export |
| Images | Automatic / embed in glb |

4. Name the file to match the manifest key:
   - `pistol.glb`
   - `crate.glb`
   - `keycard.glb`
   - `camera.glb`
   - `spaceship.glb`

---

## 4. Drop into the project

```
portfolio-spy-facility-game/
  public/
    models/
      pistol.glb      ← put files here
      crate.glb
      keycard.glb
      camera.glb
      spaceship.glb
    textures/         ← only if you need standalone images
```

Vite serves `public/` at the site root, so `/models/pistol.glb` resolves automatically. No import path changes needed.

Restart `npm run dev` (or hard-refresh) after adding files.

---

## 5. Register a new asset

Edit the `MANIFEST` in [`src/game/assets.js`](../src/game/assets.js):

```js
const MANIFEST = {
  pistol: { url: '/models/pistol.glb', scale: 1 },
  crate:  { url: '/models/crate.glb',  scale: 1 },
  // add yours:
  desk:   { url: '/models/desk.glb',   scale: 1 },
};
```

Then either:

- Wire it where props are spawned (e.g. `level.js` crates already call `assets.get('crate')`), or
- Pass a procedural fallback into `loadAssets()` from `Game.init()` so missing files still work:

```js
this._assets = await loadAssets(THREE, {
  crate: (T) => buildProceduralCrate(T, 1),
  desk:  (T) => buildProceduralDesk(T),
});
```

If the `.glb` fails to load (404 / bad export), the fallback mesh is used silently.

---

## 6. Suggested first projects

1. **Crate** — box with a painted stencil; easiest UV practice.
2. **PP7 pistol** — replace the procedural sidearm (world pickup + viewmodel share the same GLB).
3. **Keycard** — flat card with a magnetic stripe texture.
4. **Spy camera** — box body + cylinder lens.

Keep each under ~50 KB `.glb` when possible so the portfolio stays fast on mobile.

---

## 7. Troubleshooting

| Symptom | Fix |
|---------|-----|
| Model is tiny / huge | Check Blender scale; use `scale` in the manifest, or re-export at real-world meters |
| Model is rotated wrong | Apply rotation in Blender; ensure barrel points -Z for guns |
| Textures look blurry | Confirm loader ran (`NearestFilter`); avoid mipmaps in export if possible |
| Pink / missing texture | Embed images in the `.glb` (don't rely on external `.png` paths) |
| Nothing changes | Hard-refresh; confirm filename matches `MANIFEST` url exactly |
| Console 404 on `/models/...` | File must live under `public/models/`, not `src/` |
