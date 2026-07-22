// Builds the facility geometry into a Three.js scene. Doors/windows, canvas
// textures (tile wainscot, concrete, floor tiles), and room props.
// Pure function of (THREE, scene, assets?) — no engine state lives here.

import { buildDoors, DOOR_DEFS } from './doors.js';
import { buildContainment } from './alien.js';
import { setGateOpen, VENT } from './zones.js';
import {
  buildSaucer, buildE115Crates, buildDocsTable, buildRecRoom, buildSigintScreens, buildHazardStrips,
} from './s4props.js';

export function makeLabelTexture(THREE, text, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0e10';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

function canvasTex(THREE, draw, size = 64) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  draw(c.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeFloorTex(THREE) {
  return canvasTex(THREE, (ctx, s) => {
    ctx.fillStyle = '#1a1d21';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#2a2e34';
    ctx.lineWidth = 2;
    const cell = s / 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, s);
      ctx.moveTo(0, i * cell); ctx.lineTo(s, i * cell);
      ctx.stroke();
    }
    // Subtle tile tint variation
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        if ((x + y) % 2 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.03)';
          ctx.fillRect(x * cell + 1, y * cell + 1, cell - 2, cell - 2);
        }
      }
    }
  }, 64);
}

function makeTileWainscot(THREE) {
  return canvasTex(THREE, (ctx, s) => {
    ctx.fillStyle = '#d8dce2';
    ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = '#9aa0a8';
    ctx.lineWidth = 2;
    const cell = s / 4;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, s);
      ctx.moveTo(0, i * cell); ctx.lineTo(s, i * cell);
      ctx.stroke();
    }
  }, 64);
}

function makeConcrete(THREE) {
  return canvasTex(THREE, (ctx, s) => {
    ctx.fillStyle = '#30343b';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 80; i++) {
      const g = 40 + Math.floor(Math.random() * 30);
      ctx.fillStyle = `rgb(${g},${g + 2},${g + 4})`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 2 + Math.random() * 3);
    }
  }, 64);
}

export function buildLevel(THREE, scene, assets = null) {
  const floorTex = makeFloorTex(THREE);
  floorTex.repeat.set(35, 35);
  const tileTex = makeTileWainscot(THREE);
  tileTex.repeat.set(2, 1);
  const concreteTex = makeConcrete(THREE);
  concreteTex.repeat.set(2, 1);

  const floorMat = new THREE.MeshLambertMaterial({ map: floorTex });
  const upperMat = new THREE.MeshLambertMaterial({ map: concreteTex, flatShading: true });
  const lowerMat = new THREE.MeshLambertMaterial({ map: tileTex, flatShading: true });
  const upperMat2 = new THREE.MeshLambertMaterial({
    map: concreteTex.clone(),
    flatShading: true,
    color: 0xb0b4ba,
  });
  upperMat2.map.repeat.set(2, 1);
  const glassMat = new THREE.MeshLambertMaterial({
    color: 0x88aacc,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0x2a2e34, flatShading: true });
  const metalMat = new THREE.MeshLambertMaterial({ color: 0x4a5560, flatShading: true });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshLambertMaterial({ color: 0x141619 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 5;
  scene.add(ceil);

  // Ceiling trim strips over atrium
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(16.5, 0.15, 0.4),
    frameMat,
  );
  trim.position.set(0, 4.9, -8);
  scene.add(trim);
  const trim2 = trim.clone(); trim2.position.z = 8; scene.add(trim2);
  const trim3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.15, 16.5), frameMat);
  trim3.position.set(-8, 4.9, 0); scene.add(trim3);
  const trim4 = trim3.clone(); trim4.position.x = 8; scene.add(trim4);

  /**
   * Solid wall segment with Facility-style lower tile wainscot + upper concrete.
   * Height is split: lower 1.6m tiles, upper remainder concrete.
   */
  const addWall = (cx, cz, w, d, h = 5) => {
    const lowerH = Math.min(1.6, h * 0.32);
    const upperH = h - lowerH;
    const lower = new THREE.Mesh(new THREE.BoxGeometry(w, lowerH, d), lowerMat);
    lower.position.set(cx, lowerH / 2, cz);
    scene.add(lower);
    if (upperH > 0.05) {
      const upper = new THREE.Mesh(
        new THREE.BoxGeometry(w, upperH, d),
        Math.random() > 0.5 ? upperMat : upperMat2,
      );
      upper.position.set(cx, lowerH + upperH / 2, cz);
      scene.add(upper);
    }
  };

  /** Windowed wall along X (faces ±Z): solid segments with a glass pane in the middle. */
  const addWindowedWallX = (z, xa, xb, windowCenter, windowW = 3.2) => {
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb); // wings pass reversed coords on the negative side
    const yGlass = 2.2;
    const glassH = 1.8;
    const half = windowW / 2;
    if (windowCenter - half > x0 + 0.2) {
      addWall((x0 + windowCenter - half) / 2, z, windowCenter - half - x0, 0.5);
    }
    if (x1 - (windowCenter + half) > 0.2) {
      addWall((windowCenter + half + x1) / 2, z, x1 - windowCenter - half, 0.5);
    }
    // Sill
    addWall(windowCenter, z, windowW, 0.5, 1.3);
    // Header above glass
    const headerTop = 5;
    const headerBottom = yGlass + glassH / 2;
    const headerH = headerTop - headerBottom;
    const header = new THREE.Mesh(new THREE.BoxGeometry(windowW, headerH, 0.5), upperMat);
    header.position.set(windowCenter, headerBottom + headerH / 2, z);
    scene.add(header);

    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.12, glassH + 0.2, 0.55), frameMat);
    frameL.position.set(windowCenter - half, yGlass, z);
    const frameR = frameL.clone();
    frameR.position.x = windowCenter + half;
    scene.add(frameL, frameR);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(windowW - 0.15, glassH), glassMat);
    glass.position.set(windowCenter, yGlass, z);
    scene.add(glass);
  };

  /** Windowed wall along Z (faces ±X). */
  const addWindowedWallZ = (x, za, zb, windowCenter, windowW = 3.2) => {
    const z0 = Math.min(za, zb), z1 = Math.max(za, zb); // wings pass reversed coords on the negative side
    const yGlass = 2.2;
    const glassH = 1.8;
    const half = windowW / 2;
    if (windowCenter - half > z0 + 0.2) {
      addWall(x, (z0 + windowCenter - half) / 2, 0.5, windowCenter - half - z0);
    }
    if (z1 - (windowCenter + half) > 0.2) {
      addWall(x, (windowCenter + half + z1) / 2, 0.5, z1 - windowCenter - half);
    }
    addWall(x, windowCenter, 0.5, windowW, 1.3);
    const headerH = 5 - (yGlass + glassH / 2);
    const header = new THREE.Mesh(new THREE.BoxGeometry(0.5, headerH, windowW), upperMat);
    header.position.set(x, yGlass + glassH / 2 + headerH / 2, windowCenter);
    scene.add(header);

    const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.55, glassH + 0.2, 0.12), frameMat);
    frameL.position.set(x, yGlass, windowCenter - half);
    const frameR = frameL.clone();
    frameR.position.z = windowCenter + half;
    scene.add(frameL, frameR);

    const glass = new THREE.Mesh(new THREE.PlaneGeometry(windowW - 0.15, glassH), glassMat);
    glass.position.set(x, yGlass, windowCenter);
    glass.rotation.y = Math.PI / 2;
    scene.add(glass);
  };

  // ---- Atrium corners (solid, leaving door openings on axes) ----
  [-8, 8].forEach((sz) => {
    addWall(-5.5, sz, 5, 0.5);
    addWall(5.5, sz, 5, 0.5);
  });
  [-8, 8].forEach((sx) => {
    addWall(sx, -5.5, 0.5, 5);
    addWall(sx, 5.5, 0.5, 5);
  });

  // ---- Vent walls: like windowed walls, but with a floor-level crawl opening ----
  /** Wall along Z (faces ±X) with a vent opening instead of a window. */
  const addVentWallZ = (x, za, zb, center) => {
    const z0 = Math.min(za, zb), z1 = Math.max(za, zb);
    const half = VENT.width / 2;
    addWall(x, (z0 + center - half) / 2, 0.5, center - half - z0);
    addWall(x, (center + half + z1) / 2, 0.5, z1 - center - half);
    // Lintel above the crawl opening
    const lintelH = 5 - VENT.height;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.5, lintelH, VENT.width), upperMat);
    lintel.position.set(x, VENT.height + lintelH / 2, center);
    scene.add(lintel);
    // Frame posts
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.55, VENT.height, 0.14), frameMat);
    postL.position.set(x, VENT.height / 2, center - half);
    const postR = postL.clone();
    postR.position.z = center + half;
    scene.add(postL, postR);
  };
  /** Wall along X (faces ±Z) with a vent opening instead of a window. */
  const addVentWallX = (z, xa, xb, center) => {
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    const half = VENT.width / 2;
    addWall((x0 + center - half) / 2, z, center - half - x0, 0.5);
    addWall((center + half + x1) / 2, z, x1 - center - half, 0.5);
    const lintelH = 5 - VENT.height;
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(VENT.width, lintelH, 0.5), upperMat);
    lintel.position.set(center, VENT.height + lintelH / 2, z);
    scene.add(lintel);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.14, VENT.height, 0.55), frameMat);
    postL.position.set(center - half, VENT.height / 2, z);
    const postR = postL.clone();
    postR.position.x = center + half;
    scene.add(postL, postR);
  };

  // ---- Wings: corridor walls with windows looking into rooms ----
  const zWing = (s) => {
    const iz = s * 20;
    const oz = s * 40;
    // Inner threshold walls (beside door)
    addWall(-6.5, iz, 7, 0.5);
    addWall(6.5, iz, 7, 0.5);
    // Outer room end wall
    addWall(0, oz, 20, 0.5);
    // Side walls of room — windowed (north wing east wall carries the vent instead)
    addWindowedWallZ(-10, s * 20, s * 40, s * 30);
    if (s === -1) addVentWallZ(10, s * 20, s * 40, s * 30);
    else addWindowedWallZ(10, s * 20, s * 40, s * 30);
    // Corridor side walls
    addWall(-3, s * 14, 0.5, 12);
    addWall(3, s * 14, 0.5, 12);
  };
  const xWing = (s) => {
    const ix = s * 20;
    const ox = s * 40;
    addWall(ix, -6.5, 0.5, 7);
    addWall(ix, 6.5, 0.5, 7);
    addWall(ox, 0, 0.5, 20);
    // East wing north wall carries the vent exit
    if (s === 1) addVentWallX(-10, s * 20, s * 40, s * 30);
    else addWindowedWallX(-10, s * 20, s * 40, s * 30);
    addWindowedWallX(10, s * 20, s * 40, s * 30);
    addWall(s * 14, -3, 12, 0.5);
    addWall(s * 14, 3, 12, 0.5);
  };
  zWing(-1); zWing(1); xWing(1); xWing(-1);

  // ---- Maintenance vent duct: Hangar-1 → SIGINT (L-shape, low ceiling) ----
  const ductMat = new THREE.MeshLambertMaterial({ color: 0x3a4048, flatShading: true });
  const addDuctWall = (cx, cz, w, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, VENT.height, d), ductMat);
    m.position.set(cx, VENT.height / 2, cz);
    scene.add(m);
  };
  // E-W leg (interior z −31.2..−28.8, x 10..31.2)
  addDuctWall(20.85, -31.45, 21.7, 0.5); // north side
  addDuctWall(19.15, -28.55, 18.3, 0.5); // south side (stops at the corner)
  // N-S leg (interior x 28.8..31.2, z −31.2..−10)
  addDuctWall(31.45, -20.6, 0.5, 21.2);  // east side
  addDuctWall(28.55, -19.15, 0.5, 18.3); // west side
  // Low ceiling slabs
  const ductCeil1 = new THREE.Mesh(new THREE.BoxGeometry(21.9, 0.2, 3.4), ductMat);
  ductCeil1.position.set(20.85, VENT.height + 0.1, -30);
  scene.add(ductCeil1);
  const ductCeil2 = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.2, 18.9), ductMat);
  ductCeil2.position.set(30, VENT.height + 0.1, -19.5);
  scene.add(ductCeil2);
  // Dim duct lights so it reads as a crawlspace, not the void
  const ductLight1 = new THREE.PointLight(0x2fd4c6, 5, 14, 1.6);
  ductLight1.position.set(20, VENT.height - 0.4, -30);
  scene.add(ductLight1);
  const ductLight2 = new THREE.PointLight(0xffb000, 5, 14, 1.6);
  ductLight2.position.set(30, VENT.height - 0.4, -20);
  scene.add(ductLight2);

  // Grate over the hangar-side mouth — slides up once PROJECTS intel is recovered
  const grate = new THREE.Group();
  grate.position.set(VENT.entry.x, 0, VENT.entry.z);
  {
    const barMat = new THREE.MeshLambertMaterial({ color: 0x596470, flatShading: true });
    const half = VENT.width / 2;
    for (let i = 0; i <= 6; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, VENT.height - 0.2, 0.12), barMat);
      bar.position.set(0, VENT.height / 2, -half + 0.2 + (i / 6) * (VENT.width - 0.4));
      grate.add(bar);
    }
    for (const y of [0.25, VENT.height - 0.25]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, VENT.width - 0.15), barMat);
      rail.position.set(0, y, 0);
      grate.add(rail);
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.24, 0.3), new THREE.MeshBasicMaterial({ color: 0xff5a52 }));
    lock.position.set(0, VENT.height / 2, 0);
    grate.add(lock);
    grate.userData.lock = lock;
  }
  scene.add(grate);
  setGateOpen('vent', false, VENT.gateRect);

  const vent = {
    isOpen: false,
    _h: 0,
    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      grate.userData.lock.material.color.set(0x2fd4c6);
    },
    update(dt) {
      if (!this.isOpen || this._h >= 1) return;
      this._h = Math.min(1, this._h + dt * 1.1);
      grate.position.y = this._h * (VENT.height + 0.3);
      if (this._h > 0.7) setGateOpen('vent', true);
    },
  };

  // Doors at thresholds
  const doorSystem = buildDoors(THREE, scene, { doorMat: metalMat, frameMat });

  scene.add(new THREE.AmbientLight(0x3a4048, 1.2));
  scene.add(new THREE.HemisphereLight(0x8fb0c0, 0x1a1d21, 0.55));

  const lamp = (x, z, col, intensity) => {
    const p = new THREE.PointLight(col, intensity, 34, 1.6);
    p.position.set(x, 4.4, z);
    scene.add(p);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.6), new THREE.MeshBasicMaterial({ color: col }));
    b.position.set(x, 4.85, z);
    scene.add(b);
  };
  lamp(0, 0, 0x2fd4c6, 14);
  lamp(0, -30, 0xffb000, 16); lamp(0, 30, 0x2fd4c6, 16); lamp(30, 0, 0xffb000, 16); lamp(-30, 0, 0x2fd4c6, 16);
  lamp(0, -13, 0x2fd4c6, 8); lamp(0, 13, 0x2fd4c6, 8); lamp(13, 0, 0x2fd4c6, 8); lamp(-13, 0, 0x2fd4c6, 8);

  const sign = (x, y, z, text, ry, col) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 1),
      new THREE.MeshBasicMaterial({ map: makeLabelTexture(THREE, text, col), transparent: false }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  sign(0, 3.4, -20.2, 'HANGAR-1', 0, '#ffb000');
  sign(0, 3.4, 20.2, 'XENO-LAB', Math.PI, '#2fd4c6');
  sign(20.2, 3.4, 0, 'SIGINT', -Math.PI / 2, '#ffb000');
  sign(-20.2, 3.4, 0, 'REC ROOM', Math.PI / 2, '#2fd4c6');
  // Vent mouth signage (hangar side, above the grate)
  sign(VENT.entry.x - 0.4, VENT.height + 0.9, VENT.entry.z, 'MAINTENANCE', -Math.PI / 2, '#ffb000');
  // Black-site warnings in the atrium
  sign(0, 4.3, -7.75, 'S-4 · RESTRICTED', 0, '#ff5a52');
  sign(0, 4.3, 7.75, 'USE OF DEADLY FORCE AUTHORIZED', Math.PI, '#ff5a52');

  // Hazard stripes at every door threshold
  buildHazardStrips(THREE, scene, DOOR_DEFS);

  // HANGAR-1 (N): the recovered saucer + anti-grav pylons + element 115
  const saucer = buildSaucer(THREE, scene, { x: 0, z: -32 }, assets);
  buildE115Crates(THREE, scene, assets);
  const mat = (col) => new THREE.MeshLambertMaterial({ color: col, flatShading: true });
  // Craft-analysis terminal (the intel interactable sits here)
  const term = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.9), mat(0x2b3138));
  term.position.set(0, 0.65, -25.5);
  scene.add(term);
  const termScr = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.8), new THREE.MeshBasicMaterial({ color: 0xffb000 }));
  termScr.position.set(0, 1.15, -25.04);
  scene.add(termScr);
  // Slow red warning beacon
  const beacon = new THREE.PointLight(0xff3020, 6, 26, 1.6);
  beacon.position.set(0, 4.5, -30);
  scene.add(beacon);

  // SIGINT (E): consoles + MAJESTIC display + briefing static monitor
  for (let i = 0; i < 4; i++) {
    const con = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1), mat(0x2b3138));
    con.position.set(34, 0.7, -6 + i * 4);
    scene.add(con);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ color: 0x2fd4c6 }));
    scr.position.set(33.4, 1.2, -6 + i * 4);
    scr.rotation.y = Math.PI / 2;
    scene.add(scr);
  }
  const sigint = buildSigintScreens(THREE, scene);

  // XENO-LAB (S): containment cell + docs table (keycard / about me)
  const containment = buildContainment(THREE, scene, { x: 0, z: 32 }, assets);
  buildDocsTable(THREE, scene, { x: 4.5, z: 29.5 });

  // REC ROOM (W): arcade + couch + shooting range (unlocked by master key)
  const recRoom = buildRecRoom(THREE, scene);

  // DATA CORE (atrium): glowing data pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.2, 8), mat(0x2b3138));
  ped.position.set(0, 0.6, 3);
  scene.add(ped);
  const core = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.7),
    new THREE.MeshBasicMaterial({ color: 0x2fd4c6, wireframe: true }),
  );
  core.position.set(0, 1.9, 3);
  scene.add(core);

  return { core, doorSystem, saucer, sigint, containment, beacon, vent, recRoom };
}
