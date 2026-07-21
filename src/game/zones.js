// Facility layout: interactive zones, walkable floor regions, and dynamic door gates.
// Extend this to add rooms — closed gates carve holes out of walkability.

export const ZONES = [
  { id: 'projects', name: 'CRAFT ANALYSIS', hud: 'HANGAR-1', target: [0, -28], color: '#ffb000', verb: 'ACCESS' },
  { id: 'skills', name: 'SIGINT ARCHIVE', hud: 'SIGINT', target: [28, 0], color: '#2fd4c6', verb: 'ACCESS' },
  { id: 'contact', name: 'SUBJECT J-RÖD', hud: 'XENO-LAB', target: [0, 28], color: '#2fd4c6', verb: 'TALK TO' },
  { id: 'about', name: 'PERSONNEL VAULT', hud: 'VAULT', target: [-28, 0], color: '#ffb000', verb: 'ACCESS' },
  { id: 'resume', name: 'DATA CORE', hud: 'S4 CORE', target: [0, 3], color: '#2fd4c6', verb: 'ACCESS' },
];

export const ZONE_ORDER = ['projects', 'skills', 'about', 'contact', 'resume'];

export const ZONE_NAMES = {
  projects: 'HANGAR-1 — CRAFT ANALYSIS',
  skills: 'SIGINT ARCHIVE',
  about: 'PERSONNEL VAULT',
  contact: 'XENOBIOLOGY — CELL 04',
  resume: 'DATA CORE',
};

export const ZONE_SUBS = {
  projects: 'north · hangar-1',
  skills: 'east · sigint',
  contact: 'south · xeno-lab',
  about: 'west · vault',
  resume: 'atrium · core',
};

// Extra interactable: briefing monitor in the SIGINT lab (not an objective)
export const BRIEFING_POINT = { id: 'briefing', name: 'BRIEFING REEL', verb: 'PLAY', x: 36, z: 7 };

// Walkable rectangles [minX, maxX, minZ, maxZ]
export const REGIONS = [
  [-8, 8, -8, 8], // atrium
  [-3, 3, 6, 22], [-10, 10, 18, 40], // S corridor + room -> CONTACT
  [-3, 3, -22, -6], [-10, 10, -40, -18], // N corridor + room -> PROJECTS
  [6, 22, -3, 3], [18, 40, -10, 10], // E corridor + room -> SKILLS
  [-22, -6, -3, 3], [-40, -18, -10, 10], // W corridor + room -> ABOUT
];

export const START_POSITION = { x: 0, z: 6, yaw: 0, pitch: 0 };

/** @type {Map<string, { open: boolean, rect: number[] }>} */
const gates = new Map();

/**
 * Register or update a door gate. When `open` is false, the rect is blocked.
 * @param {string} id
 * @param {boolean} open
 * @param {number[]} [rect] [minX, maxX, minZ, maxZ] — required on first call
 */
export function setGateOpen(id, open, rect) {
  const existing = gates.get(id);
  gates.set(id, {
    open,
    rect: rect || existing?.rect || [0, 0, 0, 0],
  });
}

export function isInsideGate(x, z, radius = 0.7) {
  for (const g of gates.values()) {
    if (g.open) continue;
    const [a, b, c, d] = g.rect;
    // Player circle overlaps gate rect
    if (x + radius > a && x - radius < b && z + radius > c && z - radius < d) return true;
  }
  return false;
}

export function isWalkable(x, z, radius = 0.7) {
  let inRegion = false;
  for (const [a, b, c, d] of REGIONS) {
    if (x >= a + radius && x <= b - radius && z >= c + radius && z <= d - radius) {
      inRegion = true;
      break;
    }
  }
  if (!inRegion) return false;
  if (isInsideGate(x, z, radius)) return false;
  return true;
}

export function areaAt(x, z) {
  if (x >= -8 && x <= 8 && z >= -8 && z <= 8) return 'ATRIUM';
  if (z <= -18) return 'HANGAR-1';
  if (z >= 18) return 'XENO-LAB';
  if (x >= 18) return 'SIGINT';
  if (x <= -18) return 'VAULT';
  return 'CORRIDOR';
}
