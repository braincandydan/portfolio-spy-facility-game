// Xeno containment: procedural grey alien in a glass cell, idle animation,
// and the dialogue that kicks off the facility progression.

export const ALIEN_SPEAKER = 'SUBJECT J-RÖD — CELL 04';

export const ALIEN_DIALOGUE = [
  'You are not the first to walk in here wearing a visitor badge. You are the first to stop.',
  'They keep me for the propulsion program. Element 115. Gravity wave amplification. The saucer in Hangar-1 — my ride home, technically.',
  'Listen carefully. On the table beside this cell is a keycard, buried under a personnel dossier. That file is about the operative whose work you came to see.',
  'Take the keycard. Read the dossier. Then get yourself into Hangar-1 and check the craft — the projects on that saucer are why you are here.',
  'When you have seen the craft, a maintenance vent will unseal into SIGINT. Find the master key there if you want the rest of the facility.',
  'And before you go — here are the secure channels. Talk to me anytime. Tell them J-Röd sent you.',
];

/**
 * Builds the containment cell + alien in the south wing.
 * Returns { group, animate(dt, t) }.
 */
export function buildContainment(THREE, scene, position = { x: 0, z: 32 }, assets = null) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  // Cell base + top ring
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, 0.4, 12), mat(0x2b3138));
  base.position.y = 0.2;
  group.add(base);

  const topRing = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.2, 0.3, 12), mat(0x2b3138));
  topRing.position.y = 4.4;
  group.add(topRing);

  // Glass cylinder
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(2.1, 2.1, 3.9, 16, 1, true),
    new THREE.MeshLambertMaterial({
      color: 0x7fd4c0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  glass.position.y = 2.4;
  group.add(glass);

  // Cell light
  const cellLight = new THREE.PointLight(0x9fe8d8, 8, 12, 1.8);
  cellLight.position.y = 3.6;
  group.add(cellLight);

  // ---- the alien (classic grey) ----
  const alien = new THREE.Group();
  const alienModel = assets?.get('alien')?.clone();
  let head = null;

  if (alienModel) {
    // Normalize to a target height, then center on X/Z and drop feet to y=0
    // so authored scale/pivot from the source file doesn't matter.
    const rawBox = new THREE.Box3().setFromObject(alienModel);
    const rawHeight = rawBox.max.y - rawBox.min.y;
    const TARGET_HEIGHT = 1.9;
    if (rawHeight > 0) alienModel.scale.multiplyScalar(TARGET_HEIGHT / rawHeight);

    const box = new THREE.Box3().setFromObject(alienModel);
    const center = box.getCenter(new THREE.Vector3());
    alienModel.position.x -= center.x;
    alienModel.position.z -= center.z;
    alienModel.position.y -= box.min.y;

    alien.add(alienModel);
  } else {
    const skin = new THREE.MeshLambertMaterial({ color: 0x9aa89a, flatShading: true });

    head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), skin);
    head.scale.set(1, 1.25, 0.95);
    head.position.y = 2.15;
    alien.add(head);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0a0d10 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), eyeMat);
      eye.scale.set(1.25, 0.7, 0.5);
      eye.position.set(s * 0.2, 2.16, 0.34);
      eye.rotation.z = s * -0.45;
      alien.add(eye);
    }

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.35, 6), skin);
    neck.position.y = 1.72;
    alien.add(neck);

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.16, 0.85, 8), skin);
    torso.position.y = 1.18;
    alien.add(torso);

    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.85, 5), skin);
      arm.position.set(s * 0.3, 1.15, 0);
      arm.rotation.z = s * 0.25;
      alien.add(arm);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.8, 5), skin);
      leg.position.set(s * 0.11, 0.4, 0);
      alien.add(leg);
    }
  }

  alien.position.y = 0.4;
  group.add(alien);

  scene.add(group);

  return {
    group,
    alien,
    animate(dt, t) {
      // Weightless idle: slow bob + gentle sway, head tracks nothing in particular
      alien.position.y = 0.4 + Math.sin(t / 900) * 0.12;
      alien.rotation.y = Math.sin(t / 2400) * 0.35;
      if (head) head.rotation.x = Math.sin(t / 1700) * 0.08;
      cellLight.intensity = 8 + Math.sin(t / 500) * 1.2;
      glass.material.opacity = 0.16 + Math.sin(t / 700) * 0.03;
    },
  };
}
