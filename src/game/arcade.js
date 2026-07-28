// REC ROOM cabinet mini-game: fly the recovered saucer in a lazy orbit
// around a little procedural Earth. No score, no crashing — just a chill
// toy dropped into the "COMING ONLINE" cabinet screen. Mounted/disposed by
// the panel UI each time the ARCADE panel opens/closes so it never runs (or
// holds a WebGL context) while the cabinet isn't in view.

const EARTH_RADIUS = 6;
const ORBIT_RADIUS = EARTH_RADIUS + 5.5; // high enough that the globe reads as a globe, not a wall
const SHIP_SPEED = 3.6; // world units/sec along the sphere surface
const TURN_RATE = 1.6; // rad/sec at full steering deflection
const DRAG_RANGE = 60; // px of drag for full steering deflection
const CAM_BACK = 4.5; // chase-cam distance behind the ship, along -forward
const CAM_UP = 1.3; // chase-cam height above the ship, along local up

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

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03040a);
  const camera = new THREE.PerspectiveCamera(65, width / height, 0.1, 200);

  scene.add(buildStarfield(THREE));

  const earthTexture = buildEarthTexture(THREE);
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(EARTH_RADIUS, 32, 32),
    new THREE.MeshStandardMaterial({ map: earthTexture, roughness: 1, metalness: 0 }),
  );
  scene.add(earth);

  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(20, 12, 16);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x304055, 0.7));

  // The saucer GLB is modeled at hangar-centerpiece scale (it's a monument prop
  // there); renormalize it here so it reads as a small craft against the globe,
  // independent of whatever scale its other use case assumes.
  const ship = getShipModel() || buildFallbackShip(THREE);
  fitObjectToSize(THREE, ship, 1.3);
  scene.add(ship);
  const EARTH_CENTER = new THREE.Vector3(0, 0, 0);

  // Flight state: a point on the orbit sphere plus an orthonormal
  // (right / up / forward) frame tangent to it. Steering nudges `forward`
  // and `up` within that tangent plane; each frame we re-pin the altitude
  // and re-orthonormalize so the ship always sits flush with the surface.
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

  const clock = new THREE.Clock();
  const turnQuat = new THREE.Quaternion();

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

    camera.position.copy(pos).addScaledVector(forward, -CAM_BACK).addScaledVector(up, CAM_UP);
    camera.up.copy(up);
    // Bias the look-at slightly toward the planet center (not just the ship)
    // so the globe reads as a constant presence in frame, not a sliver at the edge.
    camera.lookAt(pos.clone().lerp(EARTH_CENTER, 0.25));

    earth.rotation.y += dt * 0.015;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);

  function dispose() {
    disposed = true;
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
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
    earthTexture.dispose();
    renderer.dispose();
    canvas.remove();
  }

  return { dispose };
}

function buildStarfield(THREE) {
  const COUNT = 500;
  const positions = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 60 + Math.random() * 30;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6 }));
}

function buildEarthTexture(THREE) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#123a5e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#2f7a4f';
  for (let i = 0; i < 16; i++) {
    const cx = Math.random() * canvas.width;
    const cy = Math.random() * canvas.height;
    const r = 22 + Math.random() * 46;
    ctx.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.35) {
      const rr = r * (0.7 + Math.random() * 0.6);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.6;
      a === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter; // low-fi to match the rest of the game
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

function fitObjectToSize(THREE, obj, targetSize) {
  const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  obj.scale.multiplyScalar(targetSize / maxDim);
}

function buildFallbackShip(THREE) {
  const group = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.9, 0.3, 16),
    new THREE.MeshLambertMaterial({ color: 0x9fb4c0, flatShading: true }),
  );
  group.add(hull);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x2fd4c6, flatShading: true }),
  );
  dome.position.y = 0.15;
  group.add(dome);
  return group;
}
