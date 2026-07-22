// Facility layout: interactive zones, walkable floor regions, and dynamic door gates.
// Extend this to add rooms — closed gates carve holes out of walkability.
//
// Progression: everything starts locked except the south wing (XENO-LAB).
//   1. Talk to the alien (CONTACT) — it points you at the dossier.
//   2. Read the dossier (ABOUT) — hands over the keycard, unlocks the north wing.
//   3. Saucer terminal in Hangar-1 (PROJECTS) — unseals the maintenance vent.
//   4. Crawl the vent into SIGINT (SKILLS) — accessing the archive hands over the MASTER KEY.
//   5. Master key unlocks everything, incl. the west REC ROOM (arcade).
//   RESUME (data core) sits in the atrium — always reachable.

/** Interactables you can walk up to and USE. */
export const ZONES = [
  { id: 'projects', name: 'CRAFT ANALYSIS', plain: 'MY PROJECTS', hud: 'HANGAR-1', target: [0, -28], color: '#ffb000', verb: 'ACCESS' },
  { id: 'skills', name: 'SIGINT ARCHIVE', plain: 'MY SKILLS', hud: 'SIGINT', target: [28, 0], color: '#2fd4c6', verb: 'ACCESS' },
  { id: 'about', name: 'PERSONNEL DOSSIER', plain: 'ABOUT ME', hud: 'XENO-LAB', target: [4.5, 29], color: '#2fd4c6', verb: 'READ' },
  { id: 'contact', name: 'SUBJECT J-RÖD', plain: 'CONTACT ME', hud: 'XENO-LAB', target: [0, 28], color: '#2fd4c6', verb: 'TALK TO' },
  { id: 'resume', name: 'DATA CORE', plain: 'MY RESUME', hud: 'S4 CORE', target: [0, 3], color: '#2fd4c6', verb: 'ACCESS' },
];

export const ZONE_ORDER = ['contact', 'about', 'projects', 'skills', 'resume'];

/** Warp destinations for every objective. */
export const WARP_TARGETS = {
  projects: [0, -28],
  skills: [28, 0],
  contact: [0, 26],
  about: [4.5, 28],
  resume: [0, 5.5],
};

export const ZONE_PLAIN = {
  projects: 'MY PROJECTS',
  skills: 'MY SKILLS',
  about: 'ABOUT ME',
  contact: 'CONTACT ME',
  resume: 'MY RESUME',
};

export const ZONE_NAMES = {
  projects: 'HANGAR-1 — CRAFT ANALYSIS',
  skills: 'SIGINT ARCHIVE',
  about: 'PERSONNEL DOSSIER',
  contact: 'XENOBIOLOGY — CELL 04',
  resume: 'DATA CORE',
};

export const ZONE_SUBS = {
  projects: 'north · hangar craft / my projects',
  skills: 'east · sigint (via the vent) · grants the master key',
  contact: 'south · talk to the alien',
  about: 'xeno-lab table · reading it grants the keycard',
  resume: 'atrium · my resume',
};

// Extra interactables (not objectives)
export const BRIEFING_POINT = { id: 'briefing', name: 'BRIEFING REEL', verb: 'PLAY', x: 36, z: 7 };
export const ARCADE_POINT = { id: 'arcade', name: 'ARCADE CABINET', verb: 'PLAY', x: -32, z: 0 };

// ---- Maintenance vent duct: Hangar-1 east wall → SIGINT north wall ----
// Openings sit where the windows used to be (x=10,z=-30 and x=30,z=-10).
export const VENT = {
  entry: { x: 10, z: -30 },   // hangar-side mouth (grate lives here)
  exit: { x: 30, z: -10 },    // sigint-side mouth
  width: 2.6,                 // opening width
  height: 2.4,                // crawl height (lintel above)
  gateRect: [9.3, 10.7, -31.3, -28.7],
};

// Walkable rectangles [minX, maxX, minZ, maxZ]
export const REGIONS = [
  [-8, 8, -8, 8], // atrium
  [-3, 3, 6, 22], [-10, 10, 18, 40], // S corridor + room -> CONTACT / ABOUT
  [-3, 3, -22, -6], [-10, 10, -40, -18], // N corridor + room -> PROJECTS
  [6, 22, -3, 3], [18, 40, -10, 10], // E corridor + room -> SKILLS
  [-22, -6, -3, 3], [-40, -18, -10, 10], // W corridor + room -> REC ROOM
  // Maintenance vent duct (L-shaped, overlaps rooms slightly so thresholds pass)
  [8.5, 31.2, -31.2, -28.8], // E-W leg out of the hangar
  [28.8, 31.2, -31.2, -8.5], // N-S leg into SIGINT
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
  // Vent duct legs (check before the room sweeps below)
  if (x > 10 && z >= -31.5 && z <= -28.5) return 'VENT DUCT';
  if (x >= 28.5 && x <= 31.5 && z > -28.5 && z < -10) return 'VENT DUCT';
  if (x >= -8 && x <= 8 && z >= -8 && z <= 8) return 'ATRIUM';
  if (z <= -18) return 'HANGAR-1';
  if (z >= 18) return 'XENO-LAB';
  if (x >= 18) return 'SIGINT';
  if (x <= -18) return 'REC ROOM';
  return 'CORRIDOR';
}
