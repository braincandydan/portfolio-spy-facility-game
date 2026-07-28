// REC ROOM cabinet mini-game: fly the recovered saucer in a low, fast pass
// over a huge procedural world. No score, no crashing — just a chill toy.
//
// The flight math still treats the world as a sphere you travel around (so
// steering behaves consistently forever), but the sphere is deliberately
// enormous relative to how close/low the camera flies — combined with fog
// hiding the horizon before curvature would read as "a ball" — so it feels
// like skimming over open terrain, not orbiting a tiny planet.

// The radius is chosen so the horizon (sqrt(2 * R * cameraHeight)) sits well
// past FOG_FAR — the curve mathematically exists, but fog hides the ground
// entirely before it would ever become visible, so it never reads as "a ball."
const EARTH_RADIUS = 600;
const ORBIT_ALTITUDE = 2; // fly low and close to the "ground"
const ORBIT_RADIUS = EARTH_RADIUS + ORBIT_ALTITUDE;
const SHIP_SPEED = 6; // world units/sec along the surface
const TURN_RATE = 1.6; // rad/sec at full steering deflection
const DRAG_RANGE = 60; // px of drag for full steering deflection
const CAM_BACK = 4.5; // chase-cam distance behind the ship, along -forward
const CAM_UP = 0.8; // chase-cam height above the ship, along local up — low and close
const FOG_NEAR = 10;
const FOG_FAR = 32;

/**
 * @param {HTMLElement} container — empty element to render the canvas into
 * @param {typeof import('three')} THREE
 * @param {() => import('three').Object3D | null} getShipModel — returns a fresh clone, or null
 */
export function mountArcadeFlight(container, THREE, getShipModel) {
  let disposed = false;
  const width = container.clientWidth || 480;
  const height = container.clientHeight || 280;

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const bgColor = 0x03040a;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(bgColor);
  scene.fog = new THREE.Fog(bgColor, FOG_NEAR, FOG_FAR);
  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 400);

  scene.add(buildStarfield(THREE));

  const groundTexture = buildGroundTexture(THREE);
  const ground = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 48, 48),
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

  // Flight state: a point on the orbit sphere plus an orthonormal
  // (right / up / forward) frame tangent to it. Steering nudges `forward`
  // and `up` within that tangent plane; each frame we re-pin the altitude
  // and re-orthonormalize so the ship always sits flush with the surface.
  // The sphere is only a math device (see file header) — nothing about it
  // is meant to be visually recognizable as a globe.
  const pos = new THREE.Vector3(0, 0, ORBIT_RADIUS);
  const up = pos.clone().normalize();
  const forward = new THREE.Vector3(1, 0, 0)
    .sub(up.clone().multiplyScalar(up.dot(new THREE.Vector3(1, 0, 0))))
    .normalize();
  const right = new THREE.Vector3();

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
  const camLookTarget = new THREE.Vector3();

  function frame() {
    if (disposed) return;
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());

    const kx = ((keys.ArrowRight || keys.KeyD) ? 1 : 0) - ((keys.ArrowLeft || keys.KeyA) ? 1 : 0);
    const ky = ((keys.ArrowDown || keys.KeyS) ? 1 : 0) - ((keys.ArrowUp || keys.KeyW) ? 1 : 0);
    const sx = dragging ? steerX : kx;
    const sy = dragging ? steerY : ky;

    right.crossVectors(forward, up).normalize();
    if (sx) {
      turnQuat.setFromAxisAngle(up, -sx * TURN_RATE * dt);
      forward.applyQuaternion(turnQuat);
    }
    if (sy) {
      turnQuat.setFromAxisAngle(right, -sy * TURN_RATE * dt);
      forward.applyQuaternion(turnQuat);
      up.applyQuaternion(turnQuat);
    }

    // Advance along the surface, then re-pin altitude + re-square the frame.
    pos.addScaledVector(forward, SHIP_SPEED * dt);
    pos.setLength(ORBIT_RADIUS);
    up.copy(pos).normalize();
    forward.sub(up.clone().multiplyScalar(forward.dot(up))).normalize();
    right.crossVectors(forward, up).normalize();

    ship.position.copy(pos);
    ship.quaternion.setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(right, up, forward.clone().negate()),
    );

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

function buildGroundTexture(THREE) {
  // Higher-res than the rest of the game's deliberately blocky NearestFilter
  // look — at flight altitude the camera sits close enough to the ground that
  // a coarse/nearest-filtered texture just reads as blocky steps, erasing the
  // silhouettes entirely. Smooth filtering + more source detail is what
  // actually lets the continent shapes read as shapes while flying past.
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 768;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#123a5e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2f7a4f';
  for (let i = 0; i < 12; i++) {
    const shape = CONTINENT_SHAPES[Math.floor(Math.random() * CONTINENT_SHAPES.length)];
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
