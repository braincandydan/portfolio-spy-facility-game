// REC ROOM cabinet mini-game: fly the recovered saucer in a low, fast pass
// over a huge procedural world, flying through ring gates to charge the
// warp drive. At 6 rings, engage warp — the ship flips belly-forward,
// blasts to speed, and the world swaps to an alien planet (and back again
// the same way). No score beyond the warp meter, no crashing.
//
// The flight math still treats each world as a sphere you travel around (so
// steering behaves consistently forever), but the sphere is deliberately
// enormous relative to how close/low the camera flies — combined with fog
// hiding the horizon before curvature would read as "a ball" — so it feels
// like skimming over open terrain, not orbiting a tiny planet.

// The radius is chosen so the horizon (sqrt(2 * R * cameraHeight)) sits well
// past FOG_FAR — the curve mathematically exists, but fog hides the ground
// entirely before it would ever become visible, so it never reads as "a ball,"
// at any altitude in ALT_MIN..ALT_MAX below. Shared by both worlds.
const WORLD_RADIUS = 600;
const ALT_MIN = 1.2; // clearance close enough to the ground to feel fast/low
const ALT_MAX = 30; // still nowhere near far enough to reveal curvature
const START_ALTITUDE = 2;
const SHIP_SPEED = 8; // world units/sec along the surface

// Momentum-based steering: input accelerates a velocity that has to build up
// and bleeds off with drag, instead of snapping straight to an angle — reads
// as an aircraft banking/diving into a turn rather than an instant swivel.
const TURN_MAX = 1.6; // rad/sec ceiling
const TURN_ACCEL = 4.2; // rad/sec^2
const TURN_DAMPING = 3.2; // 1/sec decay toward 0 with no input
const CLIMB_MAX = 7; // units/sec ceiling
const CLIMB_ACCEL = 11; // units/sec^2
const CLIMB_DAMPING = 3.2;

// Purely cosmetic — banks/pitches the rendered ship without touching the
// actual flight-path math, so it can't introduce any drift/instability.
const VISUAL_BANK = 0.6; // rad, at full turn rate
const VISUAL_PITCH = 0.4; // rad, at full climb rate

const DRAG_RANGE = 60; // px of drag for full steering deflection
const CAM_BACK = 4.5; // chase-cam distance behind the ship, along -forward
const CAM_UP = 0.8; // chase-cam height above the ship, along local up — low and close
const FOG_NEAR = 10;
const FOG_FAR = 32;

// ---- ring gates / warp drive ----
const RING_COUNT = 20;
const RING_NEEDED = 6;
const RING_RADIUS = 2.2;
const RING_TUBE = 0.26;
const RING_CATCH_DIST = 2.8; // generous — this is a fun-first toy, not a threading puzzle
const RING_SPREAD = 130; // scattered within this many units either side of the start heading
const RING_ALT_MIN = 5; // clear of the ring's own radius so it never dips into the ground
const RING_ALT_MAX = 18;

// ---- warp sequence timing (seconds) ----
const WARP_ROTATE_TIME = 1.0; // belly-forward flip
const WARP_FLASH_IN = 0.35; // speed ramps up, screen ramps to white
const WARP_HOLD = 0.25; // fully white — world swap happens here, hidden
const WARP_FLASH_OUT = 0.55; // speed and flash both ease back down, arrival
const WARP_SPEED_BOOST = 20; // multiplies SHIP_SPEED at the peak of the jump
const HALF_PI = Math.PI / 2;

/**
 * @param {HTMLElement} container — empty element to render the canvas into
 * @param {typeof import('three')} THREE
 * @param {() => import('three').Object3D | null} getShipModel — returns a fresh clone, or null
 * @param {{ blip?: (freq: number) => void }} [audio] — optional, for ring/warp cues
 */
export function mountArcadeFlight(container, THREE, getShipModel, audio) {
  let disposed = false;
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 280;

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(WORLDS.earth.bg);
  scene.fog = new THREE.Fog(WORLDS.earth.bg, FOG_NEAR, FOG_FAR);
  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 400);

  scene.add(buildStarfield(THREE));

  let groundTexture = buildGroundTexture(THREE, WORLDS.earth);
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(WORLD_RADIUS, 48, 48),
    new THREE.MeshStandardMaterial({ map: groundTexture, roughness: 1, metalness: 0 }),
  );
  scene.add(ground);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(20, 12, 16);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x304055, 0.7));

  // The saucer GLB is modeled at hangar-centerpiece scale (it's a monument prop
  // there); renormalize it here so it reads as a small craft against the world.
  const shipModel = getShipModel();
  const ship = shipModel || buildFallbackShip(THREE);
  fitObjectToSize(THREE, ship, 1.3);
  if (shipModel) applyMetallicLook(THREE, ship); // fallback ship already has its own finish
  scene.add(ship);

  // A cheap reflection source so the metallic hull actually shows highlights
  // instead of going flat black — captures the starfield/sky from the ship's
  // neighborhood rather than a synthetic studio map.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(scene, 0.04);
  scene.environment = envRT.texture;
  pmrem.dispose();

  // ---- ring gates ----
  const ringGeo = new THREE.TorusGeometry(RING_RADIUS, RING_TUBE, 10, 24);
  const ringMat = new THREE.MeshStandardMaterial({
    color: WORLDS.earth.ringColor, emissive: WORLDS.earth.ringColor, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.2,
  });
  let rings = [];
  let ringsCollected = 0;

  // ---- HUD: warp meter (top-left) + engage button (bottom-center) ----
  // Two separate top-level elements, not nested — an absolutely-positioned
  // descendant positions against its nearest positioned ancestor, and the
  // meter box is sized to fit its own content, not the full viewport.
  const hud = document.createElement('div');
  hud.className = 'arcade-hud';
  hud.innerHTML = `
    <div class="arcade-hud__world" data-world-label>${WORLDS.earth.label}</div>
    <div class="arcade-hud__bar-row">
      <span class="arcade-hud__bar-label">WARP DRIVE</span>
      <div class="arcade-hud__bar"><div class="arcade-hud__fill" data-warp-fill></div></div>
    </div>
  `;
  container.appendChild(hud);
  const fillEl = hud.querySelector('[data-warp-fill]');
  const worldLabelEl = hud.querySelector('[data-world-label]');

  const warpBtnEl = document.createElement('button');
  warpBtnEl.type = 'button';
  warpBtnEl.className = 'arcade-hud__warp-btn hidden';
  warpBtnEl.textContent = '⚡ ENGAGE WARP';
  container.appendChild(warpBtnEl);

  const flashEl = document.createElement('div');
  flashEl.className = 'arcade-warp-flash';
  container.appendChild(flashEl);

  function updateHud() {
    fillEl.style.width = `${Math.round((ringsCollected / RING_NEEDED) * 100)}%`;
    warpBtnEl.classList.toggle('hidden', warping || ringsCollected < RING_NEEDED);
  }

  // Flight state: a point on the orbit sphere plus an orthonormal
  // (right / up / forward) frame tangent to it. Yaw steering turns `forward`
  // within that tangent plane; each frame we re-pin the current altitude and
  // re-orthonormalize so the ship always sits flush with the surface at
  // whatever height it's currently climbed/dived to. The sphere is only a
  // math device (see file header) — nothing about it is meant to be
  // visually recognizable as a globe.
  let currentWorldKey = 'earth';
  let altitude = START_ALTITUDE;
  let turnVel = 0; // rad/sec, current yaw rate (momentum)
  let climbVel = 0; // units/sec, current vertical rate (momentum)
  const pos = new THREE.Vector3(0, 0, WORLD_RADIUS + altitude);
  const up = pos.clone().normalize();
  const forward = new THREE.Vector3(1, 0, 0)
    .sub(up.clone().multiplyScalar(up.dot(new THREE.Vector3(1, 0, 0))))
    .normalize();
  const right = new THREE.Vector3();
  right.crossVectors(forward, up).normalize();

  rings = spawnRings(THREE, scene, ringGeo, ringMat, pos, forward, right);

  // ---- warp sequence state ----
  let warping = false;
  let warpT = 0;
  let worldSwapped = false;

  function beginWarp() {
    if (warping || ringsCollected < RING_NEEDED) return;
    warping = true;
    warpT = 0;
    worldSwapped = false;
    turnVel = 0;
    climbVel = 0;
    audio?.blip?.(220);
    updateHud();
  }
  warpBtnEl.addEventListener('click', (e) => { e.stopPropagation(); beginWarp(); });

  // Tears down the current world's ground/rings and rebuilds the other one,
  // resetting the ship to a fresh starting pose. Called once, mid-flash,
  // while the screen is fully white so the swap is never visible.
  function loadWorld(key) {
    currentWorldKey = key;
    const world = WORLDS[key];

    const oldTex = ground.material.map;
    groundTexture = buildGroundTexture(THREE, world);
    ground.material.map = groundTexture;
    ground.material.needsUpdate = true;
    oldTex?.dispose();
    scene.background.set(world.bg);
    scene.fog.color.set(world.bg);
    ringMat.color.set(world.ringColor);
    ringMat.emissive.set(world.ringColor);
    worldLabelEl.textContent = world.label;

    for (const r of rings) scene.remove(r.mesh);
    altitude = START_ALTITUDE;
    turnVel = 0;
    climbVel = 0;
    pos.set(0, 0, WORLD_RADIUS + altitude);
    up.copy(pos).normalize();
    forward.set(1, 0, 0).sub(up.clone().multiplyScalar(up.dot(new THREE.Vector3(1, 0, 0)))).normalize();
    right.crossVectors(forward, up).normalize();
    rings = spawnRings(THREE, scene, ringGeo, ringMat, pos, forward, right);
    ringsCollected = 0;
    updateHud();
  }

  function checkRings() {
    for (const r of rings) {
      if (r.collected) continue;
      if (pos.distanceTo(r.mesh.position) < RING_CATCH_DIST) {
        r.collected = true;
        scene.remove(r.mesh);
        ringsCollected = Math.min(RING_NEEDED, ringsCollected + 1);
        audio?.blip?.(880);
        updateHud();
      }
    }
  }

  // ---- input: pointer-drag (mouse + touch) and arrow/WASD keys ----
  let steerX = 0, steerY = 0;
  let dragging = false, dragStartX = 0, dragStartY = 0;
  const canvas = renderer.domElement;

  const onPointerDown = (e) => {
    dragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!dragging) return;
    steerX = Math.max(-1, Math.min(1, (e.clientX - dragStartX) / DRAG_RANGE));
    steerY = Math.max(-1, Math.min(1, (e.clientY - dragStartY) / DRAG_RANGE));
  };
  const onPointerUp = () => { dragging = false; steerX = 0; steerY = 0; };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);

  const keys = {};
  const onKeyDown = (e) => { keys[e.code] = true; };
  const onKeyUp = (e) => { keys[e.code] = false; };
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const onResize = () => {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);

  const clock = new THREE.Clock();
  const turnQuat = new THREE.Quaternion();
  const baseMatrix = new THREE.Matrix4();
  const baseQuat = new THREE.Quaternion();
  const bankQuat = new THREE.Quaternion();
  const pitchQuat = new THREE.Quaternion();
  const LOCAL_X = new THREE.Vector3(1, 0, 0);
  const LOCAL_Z = new THREE.Vector3(0, 0, 1);
  const camLookTarget = new THREE.Vector3();

  // Moves `pos` forward at `speedMul`x, then re-pins altitude and
  // re-orthonormalizes the tangent frame. Shared by normal flight and the
  // warp sequence (which just flies much faster with input locked out).
  function advanceAlongSurface(dt, speedMul) {
    pos.addScaledVector(forward, SHIP_SPEED * speedMul * dt);
    pos.setLength(WORLD_RADIUS + altitude);
    up.copy(pos).normalize();
    forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
    right.crossVectors(forward, up).normalize();
  }

  function updateFlight(dt) {
    const kx = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
    const ky = ((keys.ArrowDown || keys.KeyS) ? 1 : 0) - ((keys.ArrowUp || keys.KeyW) ? 1 : 0);
    const sx = dragging ? steerX : kx;
    const sy = dragging ? steerY : ky;

    // Momentum: steering input accelerates a turn/climb rate that has to
    // build up, and bleeds off with drag once released — banks into turns
    // and eases out of climbs/dives instead of snapping to an angle.
    if (sx) turnVel = Math.max(-TURN_MAX, Math.min(TURN_MAX, turnVel - sx * TURN_ACCEL * dt));
    else turnVel *= Math.max(0, 1 - TURN_DAMPING * dt);
    if (sy) climbVel = Math.max(-CLIMB_MAX, Math.min(CLIMB_MAX, climbVel - sy * CLIMB_ACCEL * dt));
    else climbVel *= Math.max(0, 1 - CLIMB_DAMPING * dt);

    right.crossVectors(forward, up).normalize();
    if (turnVel) {
      turnQuat.setFromAxisAngle(up, turnVel * dt);
      forward.applyQuaternion(turnQuat);
    }
    altitude = Math.max(ALT_MIN, Math.min(ALT_MAX, altitude + climbVel * dt));

    advanceAlongSurface(dt, 1);

    ship.position.copy(pos);
    baseMatrix.makeBasis(right, up, forward.clone().negate());
    baseQuat.setFromRotationMatrix(baseMatrix);
    // Cosmetic only — banks/pitches the rendered model, doesn't touch forward/up
    // above, so it can never introduce drift into the actual flight path.
    bankQuat.setFromAxisAngle(LOCAL_Z, (turnVel / TURN_MAX) * VISUAL_BANK);
    pitchQuat.setFromAxisAngle(LOCAL_X, (climbVel / CLIMB_MAX) * VISUAL_PITCH);
    ship.quaternion.copy(baseQuat).multiply(pitchQuat).multiply(bankQuat);
  }

  const T_ROTATE_END = WARP_ROTATE_TIME;
  const T_FLASHIN_END = T_ROTATE_END + WARP_FLASH_IN;
  const T_HOLD_END = T_FLASHIN_END + WARP_HOLD;
  const T_FLASHOUT_END = T_HOLD_END + WARP_FLASH_OUT;

  // Scripted, input-locked sequence: flip belly-forward, blast to warp speed
  // as the screen goes white, swap worlds while fully hidden, then ease back
  // in. Still advances `pos` every frame (just much faster during the flash)
  // so there's no discontinuity when the flash fades and normal flight resumes.
  function updateWarp(dt) {
    warpT += dt;
    let pitchExtra, speedMul, flash;
    if (warpT < T_ROTATE_END) {
      const p = warpT / WARP_ROTATE_TIME;
      pitchExtra = p * HALF_PI; speedMul = 1; flash = 0;
    } else if (warpT < T_FLASHIN_END) {
      const p = (warpT - T_ROTATE_END) / WARP_FLASH_IN;
      pitchExtra = HALF_PI; speedMul = 1 + p * (WARP_SPEED_BOOST - 1); flash = p;
    } else if (warpT < T_HOLD_END) {
      pitchExtra = HALF_PI; speedMul = WARP_SPEED_BOOST; flash = 1;
      if (!worldSwapped) { worldSwapped = true; loadWorld(currentWorldKey === 'earth' ? 'alien' : 'earth'); }
    } else if (warpT < T_FLASHOUT_END) {
      const p = (warpT - T_HOLD_END) / WARP_FLASH_OUT;
      pitchExtra = (1 - p) * HALF_PI; speedMul = WARP_SPEED_BOOST - p * (WARP_SPEED_BOOST - 1); flash = 1 - p;
    } else {
      pitchExtra = 0; speedMul = 1; flash = 0;
      warping = false;
      updateHud();
    }

    flashEl.style.opacity = String(flash);
    advanceAlongSurface(dt, speedMul);
    ship.position.copy(pos);
    baseMatrix.makeBasis(right, up, forward.clone().negate());
    baseQuat.setFromRotationMatrix(baseMatrix);
    pitchQuat.setFromAxisAngle(LOCAL_X, pitchExtra);
    ship.quaternion.copy(baseQuat).multiply(pitchQuat);
  }

  function frame() {
    if (disposed) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());

    if (warping) {
      updateWarp(dt);
    } else {
      updateFlight(dt);
      checkRings();
    }

    // Low chase-cam, looking ahead and slightly down at the terrain — a
    // normal flight-cam, not one that tries to frame a "planet."
    camera.position.copy(pos).addScaledVector(forward, -CAM_BACK).addScaledVector(up, CAM_UP);
    camera.up.copy(up);
    camLookTarget.copy(pos).addScaledVector(forward, 8).addScaledVector(up, -1.4);
    camera.lookAt(camLookTarget);

    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  function dispose() {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerUp);
    scene.traverse((obj) => {
      obj.geometry?.dispose?.();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) { m.map?.dispose?.(); m.dispose?.(); }
    });
    groundTexture.dispose();
    envRT.dispose();
    renderer.dispose();
    canvas.remove();
    hud.remove();
    warpBtnEl.remove();
    flashEl.remove();
  }

  return { dispose };
}

function buildStarfield(THREE) {
  const COUNT = 500;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 150 + Math.random() * 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  // fog:false — stars sit far beyond the fog distance and should stay visible.
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.8, fog: false }));
}

// A random horizontal (tangent-to-surface) direction at a given "up" — used
// so ring gates stand up like hoops rather than lying flat on the ground.
function randomTangentDir(THREE, up) {
  const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  v.sub(up.clone().multiplyScalar(v.dot(up)));
  if (v.lengthSq() < 1e-6) { v.set(1, 0, 0).sub(up.clone().multiplyScalar(up.x)); }
  return v.normalize();
}

// Scatters RING_COUNT ring gates in the tangent plane around `originPos`,
// biased ahead of the current heading so a player flying roughly straight
// from a fresh start actually encounters some. A torus's default "through"
// axis is local Z, so aligning that to a random horizontal tangent direction
// makes it stand up like a hoop (roll around that axis doesn't matter —
// the ring is circularly symmetric).
function spawnRings(THREE, scene, geo, mat, originPos, originForward, originRight) {
  const rings = [];
  for (let i = 0; i < RING_COUNT; i++) {
    const dx = (Math.random() * 2 - 1) * RING_SPREAD;
    const dz = 30 + Math.random() * RING_SPREAD;
    const alt = RING_ALT_MIN + Math.random() * (RING_ALT_MAX - RING_ALT_MIN);
    const p = originPos.clone().addScaledVector(originRight, dx).addScaledVector(originForward, dz);
    p.setLength(WORLD_RADIUS + alt);
    const ringUp = p.clone().normalize();
    const heading = randomTangentDir(THREE, ringUp);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(p);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), heading);
    scene.add(mesh);
    rings.push({ mesh, collected: false });
  }
  return rings;
}

// Rough, simplified silhouettes of real continents (normalized 0..1 coords,
// y down). Not surveyed coastlines — just enough shape to read as "Africa,"
// "South America," etc. at a glance while flying past, rather than random
// blobs. Scattered/rotated across the tile below, which then repeats — a
// single non-tiled accurate world map would need a texture tens of
// thousands of pixels wide to hold this much local detail at this radius,
// so this stays a repeating "real-looking" pattern rather than one true map.
const CONTINENT_SHAPES = [
  // Africa
  [[0.55, 0.00], [0.62, 0.05], [0.78, 0.18], [0.95, 0.28], [0.85, 0.35], [0.78, 0.50],
   [0.70, 0.62], [0.66, 0.78], [0.55, 0.95], [0.45, 0.85], [0.38, 0.70], [0.30, 0.60],
   [0.15, 0.45], [0.05, 0.35], [0.10, 0.20], [0.25, 0.08], [0.40, 0.02]],
  // South America
  [[0.35, 0.00], [0.55, 0.05], [0.70, 0.15], [0.80, 0.22], [0.72, 0.35], [0.65, 0.50],
   [0.60, 0.65], [0.50, 0.80], [0.42, 0.92], [0.38, 1.00], [0.30, 0.90], [0.20, 0.75],
   [0.15, 0.55], [0.10, 0.35], [0.18, 0.20], [0.28, 0.08]],
  // Australia — the Gulf of Carpentaria notch + Cape York spike is the giveaway
  [[0.30, 0.05], [0.45, 0.00], [0.55, 0.12], [0.65, 0.02], [0.72, 0.20], [0.90, 0.35],
   [0.88, 0.55], [0.80, 0.75], [0.65, 0.90], [0.45, 0.92], [0.25, 0.85], [0.10, 0.65],
   [0.05, 0.40], [0.15, 0.15]],
  // India — wavy coasts tapering to a point, not a plain triangle
  [[0.10, 0.00], [0.90, 0.00], [0.80, 0.20], [0.85, 0.40], [0.65, 0.55], [0.60, 0.75],
   [0.50, 0.98], [0.42, 0.75], [0.35, 0.55], [0.15, 0.40], [0.20, 0.20]],
  // Italy — the boot
  [[0.35, 0.00], [0.55, 0.05], [0.60, 0.25], [0.50, 0.40], [0.55, 0.55], [0.70, 0.60],
   [0.75, 0.75], [0.60, 0.85], [0.55, 0.95], [0.45, 0.85], [0.40, 0.65], [0.35, 0.45], [0.30, 0.25]],
];

// Jagged, irregular "not from around here" silhouettes for the alien world —
// same drawing mechanism as CONTINENT_SHAPES, deliberately less regular.
const ALIEN_SHAPES = [
  [[0.50, 0.00], [0.65, 0.10], [0.60, 0.25], [0.85, 0.30], [0.70, 0.45], [0.90, 0.55],
   [0.65, 0.60], [0.70, 0.80], [0.50, 0.75], [0.40, 0.95], [0.30, 0.70], [0.15, 0.75],
   [0.25, 0.50], [0.05, 0.40], [0.30, 0.35], [0.20, 0.15], [0.40, 0.20]],
  [[0.40, 0.00], [0.60, 0.05], [0.55, 0.20], [0.75, 0.15], [0.80, 0.35], [0.65, 0.40],
   [0.85, 0.55], [0.60, 0.60], [0.70, 0.80], [0.45, 0.70], [0.40, 0.95], [0.25, 0.75],
   [0.10, 0.80], [0.20, 0.55], [0.05, 0.45], [0.25, 0.35], [0.15, 0.15], [0.35, 0.20]],
];

const WORLDS = {
  earth: {
    label: 'EARTH',
    bg: 0x03040a,
    ocean: '#123a5e',
    land: '#2f7a4f',
    ringColor: 0x2fd4c6,
    shapes: CONTINENT_SHAPES,
  },
  alien: {
    label: 'UNKNOWN WORLD',
    bg: 0x160a1f,
    ocean: '#3a1440',
    land: '#c2542c',
    ringColor: 0xff8f52,
    shapes: ALIEN_SHAPES,
  },
};

function drawSilhouette(ctx, shape, cx, cy, scale, rot) {
  const cos = Math.cos(rot), sin = Math.sin(rot);
  ctx.beginPath();
  shape.forEach(([nx, ny], i) => {
    const x0 = (nx - 0.5) * scale, y0 = (ny - 0.5) * scale;
    const x = cx + x0 * cos - y0 * sin;
    const y = cy + x0 * sin + y0 * cos;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
}

function buildGroundTexture(THREE, world) {
  // Higher-res than the rest of the game's deliberately blocky NearestFilter
  // look — at flight altitude the camera sits close enough to the ground that
  // a coarse/nearest-filtered texture just reads as blocky steps, erasing the
  // silhouettes entirely. Smooth filtering + more source detail is what
  // actually lets the shapes read as shapes while flying past.
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = world.ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = world.land;
  const shapes = world.shapes || CONTINENT_SHAPES;
  for (let i = 0; i < 12; i++) {
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const scale = (45 + Math.random() * 55) * 3;
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const rot = Math.random() * Math.PI * 2;
    drawSilhouette(ctx, shape, cx, cy, scale, rot);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 8; // ground is viewed at a shallow, near-horizontal angle
  // Tile densely — up close (low altitude, huge sphere) a single wrap of this
  // texture would span the entire visible world and look like one blurry blob.
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(90, 45);
  return tex;
}

function fitObjectToSize(THREE, obj, targetSize) {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  obj.scale.multiplyScalar(targetSize / maxDim);
}

// Clones (never mutates shared materials — the GLB is reused from the hangar
// prop) and pushes every mesh toward a shiny, chrome-like finish.
function applyMetallicLook(THREE, ship) {
  ship.traverse((obj) => {
    if (!obj.isMesh) return;
    const srcMats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const newMats = srcMats.map((m) => {
      const clone = m.clone();
      if ('metalness' in clone) {
        clone.metalness = 0.85;
        clone.roughness = 0.28;
        clone.envMapIntensity = 1.3;
      }
      return clone;
    });
    obj.material = Array.isArray(obj.material) ? newMats : newMats[0];
  });
}

function buildFallbackShip(THREE) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.9, 0.3, 16),
    new THREE.MeshStandardMaterial({ color: 0xc7d0d6, metalness: 0.85, roughness: 0.28 }),
  );
  group.add(hull);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x2fd4c6, metalness: 0.4, roughness: 0.2 }),
  );
  dome.position.y = 0.15;
  group.add(dome);
  return group;
}
