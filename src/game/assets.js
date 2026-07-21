// Manifest-based asset registry. Each entry can point at a .glb under /models/
// and/or provide a procedural fallback builder. Missing files silently fall
// back so the game always boots without Blender assets present.
//
// See docs/BLENDER_PIPELINE.md for the authoring workflow.

// Relative paths so they work under GitHub Pages subpaths (vite base './')
const MANIFEST = {
  pistol: {
    url: 'models/pistol.glb',
    // scale applied to loaded GLB root
    scale: 1,
  },
  crate: {
    url: 'models/crate.glb',
    scale: 1,
  },
  keycard: {
    url: 'models/keycard.glb',
    scale: 1,
  },
  camera: {
    url: 'models/camera.glb',
    scale: 1,
  },
};

/**
 * Load all registered assets. Returns a map of id → { clone(), ready }.
 * Procedural fallbacks are registered via `fallbacks` so callers can provide
 * builders without circular imports.
 *
 * @param {typeof import('three')} THREE
 * @param {Record<string, (THREE) => THREE.Object3D>} fallbacks
 */
export async function loadAssets(THREE, fallbacks = {}) {
  let GLTFLoader;
  try {
    ({ GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js'));
  } catch {
    GLTFLoader = null;
  }

  const loader = GLTFLoader ? new GLTFLoader() : null;
  const cache = {};

  await Promise.all(Object.keys(MANIFEST).map(async (id) => {
    const entry = MANIFEST[id];
    let root = null;

    if (loader) {
      try {
        const gltf = await loader.loadAsync(entry.url);
        root = gltf.scene;
        applyN64Filter(THREE, root);
        if (entry.scale && entry.scale !== 1) root.scale.multiplyScalar(entry.scale);
      } catch {
        root = null;
      }
    }

    if (!root && fallbacks[id]) {
      root = fallbacks[id](THREE);
    }

    cache[id] = {
      ready: !!root,
      clone() {
        if (!root) return null;
        const c = root.clone(true);
        // Materials/geometries are shared with the template — fine for props.
        return c;
      },
    };
  }));

  return {
    get(id) {
      return cache[id] || { ready: false, clone: () => null };
    },
    has(id) {
      return !!(cache[id] && cache[id].ready);
    },
  };
}

/** Nearest-filter every texture on a loaded scene for the N64 look. */
function applyN64Filter(THREE, root) {
  root.traverse((obj) => {
    const mats = obj.material
      ? (Array.isArray(obj.material) ? obj.material : [obj.material])
      : [];
    for (const mat of mats) {
      for (const key of Object.keys(mat)) {
        const val = mat[key];
        if (val && val.isTexture) {
          val.magFilter = THREE.NearestFilter;
          val.minFilter = THREE.NearestFilter;
          val.generateMipmaps = false;
          val.needsUpdate = true;
        }
      }
      // Prefer flat Lambert-ish look if the exporter baked PBR
      if (mat.map && mat.isMeshStandardMaterial) {
        mat.roughness = 1;
        mat.metalness = 0;
      }
    }
  });
}

export { MANIFEST };
