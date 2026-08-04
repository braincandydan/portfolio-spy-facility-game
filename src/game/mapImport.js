// Derives a zones.js-style walkable layout from an artist-authored map .glb.
// Every TOP-LEVEL object in the scene becomes one region: its world-space
// XZ bounding box is used as-is, named after the object. No naming
// convention required — whatever you call things in Blender is the id.
//
// Feed the result into zones.js REGIONS (or merge with the hand-authored
// ones) once you're ready to playtest a Blender-built layout.

/**
 * @param {typeof import('three')} THREE
 * @param {import('three').Object3D} root - a loaded gltf.scene
 * @returns {{ id: string, rect: number[] }[]} rect = [minX, maxX, minZ, maxZ]
 */
export function deriveRegionsFromScene(THREE, root) {
  const regions = [];
  for (const child of root.children) {
    child.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(child);
    if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) continue;
    regions.push({
      id: child.name,
      rect: [box.min.x, box.max.x, box.min.z, box.max.z],
    });
  }
  return regions;
}
