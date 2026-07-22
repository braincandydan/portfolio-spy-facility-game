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

export const projects = [
  { no: '01', name: 'PROJECT ALPHA', desc: 'Short one-line description of the work.', tech: 'React · Node · Postgres' },
  { no: '02', name: 'PROJECT BRAVO', desc: 'What it does and why it mattered.', tech: 'TypeScript · WebGL' },
  { no: '03', name: 'PROJECT CHARLIE', desc: 'Outcome or metric goes here.', tech: 'Python · ML' },
  { no: '04', name: 'PROJECT DELTA', desc: 'Add your own — this is a placeholder.', tech: 'Swift · iOS' },
];

export const skills = [
  { name: 'Problem Solving', lvl: 'EXPERT', pct: 94 },
  { name: 'Systems', lvl: 'EXPERT', pct: 90 },
  { name: 'Integrations', lvl: 'ADVANCED', pct: 86 },
  { name: 'Development', lvl: 'ADVANCED', pct: 84 },
  { name: 'Design', lvl: 'ADVANCED', pct: 82 },
  { name: 'Operations', lvl: 'ADVANCED', pct: 80 },
];
