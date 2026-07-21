// Facility layout: interactive zones and their walkable floor regions.
// Extend this to add rooms — see README for how movement collision works.

export const ZONES = [
  { id: 'projects', name: 'PROJECT CACHE', hud: 'ARCHIVE', target: [0, -28], color: '#ffb000' },
  { id: 'skills', name: 'ARMORY', hud: 'ARMORY', target: [28, 0], color: '#2fd4c6' },
  { id: 'contact', name: 'COMMS RELAY', hud: 'COMMS', target: [0, 28], color: '#2fd4c6' },
  { id: 'about', name: 'OPERATIVE FILE', hud: 'RECORDS', target: [-28, 0], color: '#ffb000' },
  { id: 'resume', name: 'DATA CORE', hud: 'DATA CORE', target: [0, 3], color: '#2fd4c6' },
];

export const ZONE_ORDER = ['projects', 'skills', 'about', 'contact', 'resume'];

export const ZONE_NAMES = {
  projects: 'PROJECT CACHE',
  skills: 'ARMORY',
  about: 'OPERATIVE FILE',
  contact: 'COMMS RELAY',
  resume: 'DATA CORE',
};

export const ZONE_SUBS = {
  projects: 'north · archive',
  skills: 'east · armory',
  contact: 'south · relay',
  about: 'west · records',
  resume: 'atrium · core',
};

// Walkable rectangles [minX, maxX, minZ, maxZ]
export const REGIONS = [
  [-8, 8, -8, 8], // atrium
  [-3, 3, 6, 22], [-10, 10, 18, 40], // S corridor + room -> CONTACT
  [-3, 3, -22, -6], [-10, 10, -40, -18], // N corridor + room -> PROJECTS
  [6, 22, -3, 3], [18, 40, -10, 10], // E corridor + room -> SKILLS
  [-22, -6, -3, 3], [-40, -18, -10, 10], // W corridor + room -> ABOUT
];

export const START_POSITION = { x: 0, z: 6, yaw: 0, pitch: 0 };

export function isWalkable(x, z, radius = 0.7) {
  for (const [a, b, c, d] of REGIONS) {
    if (x >= a + radius && x <= b - radius && z >= c + radius && z <= d - radius) return true;
  }
  return false;
}

export function areaAt(x, z) {
  if (x >= -8 && x <= 8 && z >= -8 && z <= 8) return 'ATRIUM';
  if (z <= -18) return 'ARCHIVE';
  if (z >= 18) return 'COMMS';
  if (x >= 18) return 'ARMORY';
  if (x <= -18) return 'RECORDS';
  return 'CORRIDOR';
}
