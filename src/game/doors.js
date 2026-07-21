// Sliding doors at corridor thresholds. GoldenEye Facility style: metal panel
// that rises into the frame. Closed doors block walkability via zones.js gates.

import { setGateOpen } from './zones.js';

/** Door definitions — positions match the corridor thresholds in level.js / zones.js. */
export const DOOR_DEFS = [
  // Atrium → corridor (inner) and corridor → room (outer) for each wing
  { id: 'n-inner', x: 0, z: -8, axis: 'x', width: 6, locked: false },
  { id: 'n-outer', x: 0, z: -20, axis: 'x', width: 6, locked: false },
  { id: 's-inner', x: 0, z: 8, axis: 'x', width: 6, locked: false },
  { id: 's-outer', x: 0, z: 20, axis: 'x', width: 6, locked: false },
  { id: 'e-inner', x: 8, z: 0, axis: 'z', width: 6, locked: false },
  { id: 'e-outer', x: 20, z: 0, axis: 'z', width: 6, locked: false },
  // West wing outer door is keycard-locked (bonus records vault)
  { id: 'w-inner', x: -8, z: 0, axis: 'z', width: 6, locked: false },
  { id: 'w-outer', x: -20, z: 0, axis: 'z', width: 6, locked: true, lockMsg: 'SECURITY CLEARANCE REQUIRED' },
];

const DOOR_HEIGHT = 3.2;
const OPEN_HEIGHT = 3.4;
const OPEN_SPEED = 2.4;
const CLOSE_SPEED = 2.0;
const OPEN_DELAY = 0.18; // GoldenEye's characteristic pause before rising
const PROXIMITY = 3.2;

/**
 * Build door meshes into the scene. Returns a controller with update(dt, px, pz, hasKeycard).
 */
export function buildDoors(THREE, scene, { doorMat, frameMat } = {}) {
  const metal = doorMat || new THREE.MeshLambertMaterial({ color: 0x4a5560, flatShading: true });
  const frame = frameMat || new THREE.MeshLambertMaterial({ color: 0x2a2e34, flatShading: true });
  const accent = new THREE.MeshBasicMaterial({ color: 0x2fd4c6 });
  const lockedAccent = new THREE.MeshBasicMaterial({ color: 0xff5a52 });

  const doors = DOOR_DEFS.map((def) => {
    const group = new THREE.Group();
    group.position.set(def.x, 0, def.z);

    // Frame (two jambs + lintel)
    const thick = 0.18;
    const half = def.width / 2;
    if (def.axis === 'x') {
      // Door faces north/south — jambs along X
      const left = new THREE.Mesh(new THREE.BoxGeometry(thick, DOOR_HEIGHT + 0.3, 0.35), frame);
      left.position.set(-half - thick / 2, (DOOR_HEIGHT + 0.3) / 2, 0);
      const right = left.clone();
      right.position.x = half + thick / 2;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(def.width + thick * 2, 0.3, 0.4), frame);
      lintel.position.set(0, DOOR_HEIGHT + 0.15, 0);
      group.add(left, right, lintel);
    } else {
      const left = new THREE.Mesh(new THREE.BoxGeometry(0.35, DOOR_HEIGHT + 0.3, thick), frame);
      left.position.set(0, (DOOR_HEIGHT + 0.3) / 2, -half - thick / 2);
      const right = left.clone();
      right.position.z = half + thick / 2;
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, def.width + thick * 2), frame);
      lintel.position.set(0, DOOR_HEIGHT + 0.15, 0);
      group.add(left, right, lintel);
    }

    // Sliding panel
    const panelGeo = def.axis === 'x'
      ? new THREE.BoxGeometry(def.width - 0.1, DOOR_HEIGHT, 0.12)
      : new THREE.BoxGeometry(0.12, DOOR_HEIGHT, def.width - 0.1);
    const panel = new THREE.Mesh(panelGeo, metal);
    panel.position.y = DOOR_HEIGHT / 2;

    // Status light strip
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(def.axis === 'x' ? def.width * 0.4 : 0.06, 0.08, def.axis === 'x' ? 0.06 : def.width * 0.4),
      def.locked ? lockedAccent : accent,
    );
    strip.position.set(0, DOOR_HEIGHT * 0.65, def.axis === 'x' ? 0.08 : 0);
    if (def.axis === 'z') strip.position.set(0.08, DOOR_HEIGHT * 0.65, 0);
    panel.add(strip);

    group.add(panel);
    scene.add(group);

    // Gate rectangle for collision (slightly thicker than the panel)
    const gatePad = 0.55;
    let gate;
    if (def.axis === 'x') {
      gate = [def.x - half, def.x + half, def.z - gatePad, def.z + gatePad];
    } else {
      gate = [def.x - gatePad, def.x + gatePad, def.z - half, def.z + half];
    }
    setGateOpen(def.id, false, gate);

    return {
      def,
      group,
      panel,
      strip,
      closedY: DOOR_HEIGHT / 2,
      openY: DOOR_HEIGHT / 2 + OPEN_HEIGHT,
      height: 0, // 0 = closed, 1 = fully open
      delay: 0,
      wantOpen: false,
      unlocked: !def.locked,
    };
  });

  return {
    doors,
    unlock(id) {
      const d = doors.find((x) => x.def.id === id);
      if (!d) return;
      d.unlocked = true;
      d.strip.material = accent;
    },
    isLockedNear(px, pz) {
      for (const d of doors) {
        if (d.unlocked) continue;
        const dist = Math.hypot(px - d.def.x, pz - d.def.z);
        if (dist < PROXIMITY) return d.def;
      }
      return null;
    },
    update(dt, px, pz, hasKeycard) {
      for (const d of doors) {
        // Auto-unlock keycard door when holding keycard
        if (d.def.locked && hasKeycard && !d.unlocked) {
          d.unlocked = true;
          d.strip.material = accent;
        }

        const dist = Math.hypot(px - d.def.x, pz - d.def.z);
        const shouldOpen = dist < PROXIMITY && d.unlocked;

        if (shouldOpen && !d.wantOpen) {
          d.wantOpen = true;
          d.delay = OPEN_DELAY;
        } else if (!shouldOpen) {
          d.wantOpen = false;
          d.delay = 0;
        }

        if (d.wantOpen) {
          if (d.delay > 0) {
            d.delay -= dt;
          } else {
            d.height = Math.min(1, d.height + OPEN_SPEED * dt);
          }
        } else {
          d.height = Math.max(0, d.height - CLOSE_SPEED * dt);
        }

        d.panel.position.y = d.closedY + (d.openY - d.closedY) * d.height;
        // Gate opens once mostly clear
        setGateOpen(d.def.id, d.height > 0.7);
      }
    },
  };
}
