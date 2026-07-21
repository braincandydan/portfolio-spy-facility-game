// Gadget / inventory system. Pickups spin in the world; collected items go into
// an inventory the player cycles with the A-button equivalent. Each gadget can
// supply a world mesh, a viewmodel, and a primary-fire action.
//
// Models prefer the asset registry (GLB) and fall back to procedural builders.

import { GUN_PICKUP_POSITION, buildPickupGun, buildViewmodelGun } from './gun.js';

const ACCENT = 0x2fd4c6;
const AMBER = 0xffb000;

export const ITEM_IDS = {
  PISTOL: 'pistol',
  KEYCARD: 'keycard',
  CAMERA: 'camera',
};

/** Pickup spawn points in the facility. */
export const PICKUP_DEFS = [
  {
    id: ITEM_IDS.PISTOL,
    name: 'PP7',
    verb: 'TAKE',
    position: { ...GUN_PICKUP_POSITION },
  },
  {
    id: ITEM_IDS.KEYCARD,
    name: 'KEYCARD',
    verb: 'TAKE',
    // Archive wing — find this before unlocking the Records vault
    position: { x: 6, y: 1, z: -34 },
  },
  {
    id: ITEM_IDS.CAMERA,
    name: 'SPY CAM',
    verb: 'TAKE',
    // Comms wing
    position: { x: 4, y: 1, z: 34 },
  },
];

function addBobRing(THREE, group) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.62, 24),
    new THREE.MeshBasicMaterial({ color: ACCENT, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = -0.9;
  group.add(ring);
  group.userData.ring = ring;
  return group;
}

function buildProceduralKeycard(THREE) {
  const g = new THREE.Group();
  const card = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.04, 1.1),
    new THREE.MeshLambertMaterial({ color: 0x1a3040, flatShading: true }),
  );
  g.add(card);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.7, 0.045, 0.18),
    new THREE.MeshBasicMaterial({ color: AMBER }),
  );
  stripe.position.z = 0.3;
  g.add(stripe);
  const chip = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.05, 0.22),
    new THREE.MeshBasicMaterial({ color: ACCENT }),
  );
  chip.position.set(-0.15, 0.01, -0.2);
  g.add(chip);
  return g;
}

function buildProceduralCamera(THREE) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.55, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x2b2e34, flatShading: true }),
  );
  g.add(body);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 0.35, 10),
    new THREE.MeshLambertMaterial({ color: 0x1a1d22, flatShading: true }),
  );
  lens.rotation.x = Math.PI / 2;
  lens.position.z = -0.4;
  g.add(lens);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.14, 12),
    new THREE.MeshBasicMaterial({ color: 0x88ccee }),
  );
  glass.position.z = -0.58;
  g.add(glass);
  const flash = new THREE.Mesh(
    new THREE.BoxGeometry(0.25, 0.12, 0.12),
    new THREE.MeshBasicMaterial({ color: 0xe8ebf0 }),
  );
  flash.position.set(0.35, 0.2, -0.15);
  g.add(flash);
  return g;
}

function buildViewmodelKeycard(THREE) {
  const g = buildProceduralKeycard(THREE);
  g.scale.setScalar(0.35);
  g.position.set(0.28, -0.28, -0.5);
  g.rotation.set(0.4, -0.5, 0.2);
  g.visible = false;
  return { group: g, muzzle: null };
}

function buildViewmodelCamera(THREE) {
  const g = buildProceduralCamera(THREE);
  g.scale.setScalar(0.45);
  g.position.set(0.3, -0.25, -0.55);
  g.rotation.set(0.15, Math.PI + 0.1, 0);
  g.visible = false;
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.05, -0.7);
  g.add(muzzle);
  return { group: g, muzzle };
}

/**
 * Build world pickups and viewmodels. `assets` is the registry from assets.js
 * (may be null during early boot — procedural only).
 */
export function buildItems(THREE, scene, assets = null) {
  const pickups = [];
  const viewmodels = {};

  for (const def of PICKUP_DEFS) {
    let mesh;
    if (def.id === ITEM_IDS.PISTOL) {
      const fromAsset = assets?.get('pistol')?.clone();
      if (fromAsset) {
        fromAsset.scale.setScalar(3.4);
        fromAsset.rotation.z = Math.PI / 10;
        addBobRing(THREE, fromAsset);
        fromAsset.position.set(def.position.x, def.position.y, def.position.z);
        mesh = fromAsset;
      } else {
        mesh = buildPickupGun(THREE);
      }
    } else if (def.id === ITEM_IDS.KEYCARD) {
      const fromAsset = assets?.get('keycard')?.clone() || buildProceduralKeycard(THREE);
      fromAsset.scale.setScalar(fromAsset.scale.x === 1 ? 1.6 : fromAsset.scale.x);
      addBobRing(THREE, fromAsset);
      fromAsset.position.set(def.position.x, def.position.y, def.position.z);
      mesh = fromAsset;
    } else if (def.id === ITEM_IDS.CAMERA) {
      const fromAsset = assets?.get('camera')?.clone() || buildProceduralCamera(THREE);
      fromAsset.scale.setScalar(fromAsset.scale.x === 1 ? 1.8 : fromAsset.scale.x);
      addBobRing(THREE, fromAsset);
      fromAsset.position.set(def.position.x, def.position.y, def.position.z);
      mesh = fromAsset;
    }

    mesh.userData.itemId = def.id;
    mesh.userData.baseY = def.position.y;
    scene.add(mesh);
    pickups.push({ def, mesh });
  }

  // Viewmodels
  {
    const fromAsset = assets?.get('pistol')?.clone();
    if (fromAsset) {
      fromAsset.position.set(0.32, -0.3, -0.55);
      fromAsset.rotation.y = Math.PI + 0.06;
      fromAsset.visible = false;
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0.05, -0.3);
      fromAsset.add(muzzle);
      viewmodels[ITEM_IDS.PISTOL] = { group: fromAsset, muzzle };
    } else {
      viewmodels[ITEM_IDS.PISTOL] = buildViewmodelGun(THREE);
    }
  }
  viewmodels[ITEM_IDS.KEYCARD] = buildViewmodelKeycard(THREE);
  {
    const fromAsset = assets?.get('camera')?.clone();
    if (fromAsset) {
      fromAsset.position.set(0.3, -0.25, -0.55);
      fromAsset.rotation.y = Math.PI + 0.1;
      fromAsset.visible = false;
      const muzzle = new THREE.Object3D();
      muzzle.position.set(0, 0.05, -0.4);
      fromAsset.add(muzzle);
      viewmodels[ITEM_IDS.CAMERA] = { group: fromAsset, muzzle };
    } else {
      viewmodels[ITEM_IDS.CAMERA] = buildViewmodelCamera(THREE);
    }
  }

  return { pickups, viewmodels };
}

export function updatePickups(pickups, dt) {
  const t = performance.now();
  for (const { mesh } of pickups) {
    if (!mesh.parent) continue;
    mesh.rotation.y += dt * 1.4;
    mesh.position.y = mesh.userData.baseY + Math.sin(t / 450) * 0.15;
    if (mesh.userData.ring) mesh.userData.ring.rotation.z += dt * 0.8;
  }
}

export function nearestPickup(pickups, px, pz, radius = 4) {
  let best = null;
  let bestD = radius;
  for (const p of pickups) {
    if (!p.mesh.parent) continue;
    const d = Math.hypot(px - p.def.position.x, pz - p.def.position.z);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

/** Procedural crate builder used as asset registry fallback. */
export function buildProceduralCrate(THREE, size = 1.4) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x3a3f2e, flatShading: true });
  const c = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), mat);
  return c;
}
