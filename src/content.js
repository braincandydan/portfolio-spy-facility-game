// Edit this file to make the portfolio yours. Nothing here touches engine code.

export const profile = {
  name: 'DANIEL DONNELLY',
  codename: 'DEVELOPER · DESIGNER · TINKERER',
  bio: 'Field asset operating out of Kelowna, BC. Builds systems, wires up integrations, and keeps operations running when the pressure is on. Equally comfortable designing the interface and rewiring what\u2019s behind it — if it\u2019s broken, half-built, or "impossible", that\u2019s the assignment he takes.',
  stats: [
    { value: '10+', label: 'YEARS TINKERING' },
    { value: '100+', label: 'SYSTEMS WIRED' },
    { value: '∞', label: 'COFFEE' },
  ],
  resume: {
    label: 'RESUME.PDF',
    meta: 'Latest — 1 page · updated on drop-in',
    href: '#', // drop resume.pdf into public/ and change this to 'resume.pdf'
  },
  cv: {
    href: '#',
  },
};

export const comms = [
  { icon: '✉', label: 'EMAIL', value: 'braincandydan@gmail.com', href: 'mailto:braincandydan@gmail.com' },
  { icon: '☏', label: 'PHONE', value: '250-808-7129', href: 'tel:+12508087129' },
  { icon: '◇', label: 'GITHUB', value: '/braincandydan', href: 'https://github.com/braincandydan' },
  { icon: '▤', label: 'LINKEDIN', value: '/in/your-name', href: '#' },
  { icon: '◈', label: 'BASE', value: 'Kelowna, BC — Canada', href: '#' },
];

// links: optional list of { label, href } shown as buttons on the card.
export const projects = [
  {
    no: '01',
    name: 'GROC',
    codename: 'OPERATION SUPPLY LINE',
    desc: 'Grocery-deal finder: scrapes every flyer for a postal code daily, parses messy prices ("2 for $5", "was/now"), and lets you search or ask an AI that only answers from real flyer data.',
    tech: 'Python · Flask · Postgres · Claude API · GitHub Actions',
    links: [
      { label: 'LIVE', href: 'https://groc-2.vercel.app' },
      { label: 'SOURCE', href: 'https://github.com/braincandydan/groc' },
    ],
  },
  {
    no: '02',
    name: 'HOOK GENERATOR',
    codename: 'OPERATION FABRICATOR',
    desc: 'Parametric 3D model generator in the browser: size a wall hook with sliders and export print-ready STL files. Screw length and gauge are derived from the geometry and filament type.',
    tech: 'Three.js · CSG · TypeScript · Vite',
    links: [
      { label: 'SOURCE', href: 'https://github.com/braincandydan/Model-Gen' },
    ],
  },
  {
    no: '03',
    name: 'ZODIAX',
    codename: 'OPERATION CIPHER',
    desc: 'Type a message and watch it become a Zodiac-style homophonic cipher, with a live frequency analysis showing why the technique hides patterns and how these ciphers were cracked.',
    tech: 'Vanilla JS · SVG · Cryptography',
    links: [
      { label: 'SOURCE', href: 'https://github.com/braincandydan/zodiax' },
    ],
  },
  {
    no: '04',
    name: 'SKI RUN',
    codename: 'OPERATION BLACK DIAMOND',
    desc: 'Arcade downhill skiing game: carve between trees, chase a best score. Sprite animation, tuned physics, and touch controls for mobile.',
    tech: 'Next.js · React · Canvas · TypeScript',
    links: [
      { label: 'SOURCE', href: 'https://github.com/braincandydan/ski-app' },
    ],
  },
];

export const skills = [
  { name: 'Problem Solving', lvl: 'EXPERT', pct: 94 },
  { name: 'Systems', lvl: 'EXPERT', pct: 90 },
  { name: 'Integrations', lvl: 'ADVANCED', pct: 86 },
  { name: 'Development', lvl: 'ADVANCED', pct: 84 },
  { name: 'Design', lvl: 'ADVANCED', pct: 82 },
  { name: 'Operations', lvl: 'ADVANCED', pct: 80 },
];
