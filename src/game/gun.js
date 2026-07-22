// Sidearm: world pickup, first-person viewmodel, practice targets, and the
// transient visual effects (muzzle flash / tracer / hit spark) spawned on fire.
// Kept separate from Game.js so the weapon can be reworked without touching
// input/state plumbing.

// REC ROOM shooting range (west wing — unlocked by master key)
export const GUN_PICKUP_POSITION = { x: -34, y: 1, z: -3 };
const TARGET_POSITIONS = [
  { x: -37, y: 1.6, z: -6 },
  { x: -37, y: 1.6, z: 0 },
  { x: -37, y: 1.6, z: 6 },
];

const GUNMETAL = 0x2b2e34;
const GRIP = 0x1a1d22;
const ACCENT = 0x2fd4c6;
// Viewmodel sits centimeters from the camera in a dark facility — Lambert-lit
// world colors read as pure black there, so it gets its own brighter, unlit palette.
const VM_GUNMETAL = 0x7b818c;
const VM_GRIP = 0x3d4148;

function buildPistol(THREE, scale = 1, unlit = false) {
  const group = new THREE.Group();
  const gunmetal = unlit
    ? new THREE.MeshBasicMaterial({ color: VM_GUNMETAL })
    : new THREE.MeshLambertMaterial({ color: GUNMETAL, flatShading: true });
  const grip = unlit
    ? new THREE.MeshBasicMaterial({ color: VM_GRIP })
    : new THREE.MeshLambertMaterial({ color: GRIP, flatShading: true });
  const accent = new THREE.MeshBasicMaterial({ color: ACCENT });

  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.32), gunmetal);
  slide.position.set(0, 0.05, -0.05);
  group.add(slide);

  const muzzleTip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.06), accent);
  muzzleTip.position.set(0, 0.05, -0.25);
  group.add(muzzleTip);

  const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.2, 0.1), grip);
  gripMesh.position.set(0, -0.1, 0.08);
  gripMesh.rotation.x = 0.2;
  group.add(gripMesh);

  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 10, Math.PI), gunmetal);
  guard.position.set(0, -0.02, -0.02);
  guard.rotation.x = Math.PI / 2;
  group.add(guard);

  group.scale.setScalar(scale);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.05 * scale, -0.3 * scale);
  group.add(muzzle);

  return { group, muzzle };
}

export function buildPickupGun(THREE) {
  const { group } = buildPistol(THREE, 3.4);
  group.rotation.z = Math.PI / 10;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.62, 24),
    new THREE.MeshBasicMaterial({ color: ACCENT, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.9;
  group.add(ring);
  group.userData.ring = ring;

  group.position.set(GUN_PICKUP_POSITION.x, GUN_PICKUP_POSITION.y, GUN_PICKUP_POSITION.z);
  return group;
}

export function buildViewmodelGun(THREE) {
  const { group, muzzle } = buildPistol(THREE, 1, true);
  group.position.set(0.32, -0.3, -0.55);
  group.rotation.y = Math.PI + 0.06;
  group.visible = false;
  return { group, muzzle };
}

export function buildTargets(THREE, scene) {
  const targets = [];
  for (const pos of TARGET_POSITIONS) {
    const tex = ringTexture();
    const mesh = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 24),
      new THREE.MeshBasicMaterial({ map: tex, color: 0xffffff, side: THREE.DoubleSide, transparent: true }),
    );
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.rotation.y = Math.PI / 2;
    mesh.userData.isTarget = true;
    mesh.userData.baseColor = 0xffffff;
    mesh.raycast = THREE.Mesh.prototype.raycast;
    scene.add(mesh);
    targets.push(mesh);
  }
  return targets;

  function ringTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);
    const rings = [[62, '#ffb000'], [46, '#0b0e10'], [30, '#ffb000'], [14, '#0b0e10']];
    for (const [r, color] of rings) {
      ctx.beginPath();
      ctx.arc(64, 64, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    }
    return new THREE.CanvasTexture(c);
  }
}

function disposeEffect(scene, mesh) {
  scene.remove(mesh);
  mesh.geometry?.dispose();
  if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
  else mesh.material?.dispose();
}

export function spawnMuzzleFlash(THREE, scene, position) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.09, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 1 }),
  );
  mesh.position.copy(position);
  mesh.raycast = () => {};
  scene.add(mesh);
  const life = 0.08;
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      mesh.material.opacity = Math.max(0, 1 - t / life);
      mesh.scale.setScalar(1 + t * 6);
      if (t >= life) { disposeEffect(scene, mesh); return false; }
      return true;
    },
  };
}

export function spawnTracer(THREE, scene, from, to) {
  const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
  const mat = new THREE.LineBasicMaterial({ color: 0x2fd4c6, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Line(geo, mat);
  mesh.raycast = () => {};
  scene.add(mesh);
  const life = 0.1;
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      mat.opacity = Math.max(0, 0.9 * (1 - t / life));
      if (t >= life) { disposeEffect(scene, mesh); return false; }
      return true;
    },
  };
}

export function spawnHitSpark(THREE, scene, position) {
  const count = 8;
  const positions = new Float32Array(count * 3);
  const velocities = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = position.x;
    positions[i * 3 + 1] = position.y;
    positions[i * 3 + 2] = position.z;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    const speed = 1.5 + Math.random() * 1.5;
    velocities.push([
      Math.sin(phi) * Math.cos(theta) * speed,
      Math.sin(phi) * Math.sin(theta) * speed,
      Math.cos(phi) * speed,
    ]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffb000, size: 0.06, transparent: true, opacity: 1 });
  const mesh = new THREE.Points(geo, mat);
  mesh.raycast = () => {};
  scene.add(mesh);
  const life = 0.35;
  let t = 0;
  return {
    mesh,
    update(dt) {
      t += dt;
      const pos = geo.attributes.position;
      for (let i = 0; i < count; i++) {
        pos.array[i * 3] += velocities[i][0] * dt;
        pos.array[i * 3 + 1] += velocities[i][1] * dt - 2 * dt * t; // gravity
        pos.array[i * 3 + 2] += velocities[i][2] * dt;
      }
      pos.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - t / life);
      if (t >= life) { disposeEffect(scene, mesh); return false; }
      return true;
    },
  };
}

export function flashTarget(THREE, mesh) {
  const mat = mesh.material;
  const life = 0.25;
  let t = 0;
  const baseScale = mesh.scale.x || 1;
  const white = new THREE.Color(0xffffff);
  const amber = new THREE.Color(0xffb000);
  return {
    mesh,
    update(dt) {
      t += dt;
      const k = Math.min(1, t / life);
      mat.color.copy(amber).lerp(white, k);
      mesh.scale.setScalar(baseScale * (1 + 0.25 * (1 - k)));
      if (t >= life) { mat.color.copy(white); mesh.scale.setScalar(baseScale); return false; }
      return true;
    },
  };
}
