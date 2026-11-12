// Edit this file to make the portfolio yours. Nothing here touches engine code.

// Public URLs. The PDF résumé prints these (and a QR code) so anyone who only sees
// the uploaded PDF — Indeed, an ATS, a printout — can find the interactive version.
export const site = {
  url: 'https://braincandydan.github.io/portfolio-spy-facility-game/',
  resumeUrl: 'https://braincandydan.github.io/portfolio-spy-facility-game/resume.html',
};

export const profile = {
  name: 'DANIEL DONNELLY',
  codename: 'TECHNICAL LEAD · SYSTEMS & SALESFORCE',
  // Plain-English headline + summary used on the résumé page and PDF.
  title: 'Technical Lead, Systems — Salesforce Architecture · Integrations · Trade Compliance',
  summary: 'Technical lead who designs and builds the systems a manufacturer runs on: Salesforce architecture and development, platform integrations, and trade-compliance automation. Learned the platform through the developer docs and production work, not a classroom. Works directly with the CEO, owns projects end to end, and rolls out new systems with an employee-first approach so the people using them feel empowered, not audited. Also designs and builds interactive web and 3D experiences — this portfolio included.',
  bio: 'Field asset operating out of Kelowna, BC. Leads Salesforce architecture, integrations and trade-compliance systems for a manufacturer, reporting straight to the CEO. Equally comfortable designing the interface and rewiring what’s behind it — if it’s broken, half-built, or "impossible", that’s the assignment he takes.',
  stats: [
    { value: '6,000+', label: 'PRODUCTS CLASSIFIED' },
    { value: '10+', label: 'YEARS TINKERING' },
    { value: '∞', label: 'COFFEE' },
  ],
  resume: {
    label: 'RESUME.PDF',
    meta: 'ATS-friendly PDF · plain web version below',
    href: 'resume.pdf', // regenerate with `npm run resume:pdf` after editing this file
  },
  cv: {
    label: 'PLAIN RÉSUMÉ',
    href: 'resume.html',
  },
};

// Work history for the résumé page/PDF.
// TODO: set the real start date, and swap `org` for the company name if you're comfortable naming it.
export const experience = [
  {
    role: 'Technical Lead, Systems',
    org: 'Manufacturer of signage & outdoor products',
    place: 'Kelowna, BC',
    dates: 'YYYY – Present',
    bullets: [
      'Own Salesforce architecture and development end to end (Apex, Flows, Lightning components, Experience Cloud), working directly with the CEO.',
      'Built the quote-to-order process: grouped quote lines and fees, automated quote/job numbering, opportunity-to-order conversion and a historical order backfill.',
      'Built a shipping hub inside Salesforce integrated with Freightcom and UPS, generating commercial invoices (PDF) with customs line items automatically.',
      'Designed a tariff and customs classification system for a 6,000+ product catalog: HTS code registry, tariff rules (Chapter 99 / Section 338), duty calculation and CUSMA certificates.',
      'Consolidated costing data from QuickBooks, Salesforce and four department spreadsheets into one model (materials, vendors, BOMs); leading the ERP evaluation (ERPNext).',
      'Connected HubSpot and Salesforce via API and cleaned up CRM data; built Conga document templates and an Agentforce inquiry-enrichment agent.',
      'Run self-hosted infrastructure (Docker, Nextcloud) and the integrations around it.',
    ],
  },
];

// Classified case studies — the serious work. Shown first in the hangar and on the résumé page.
// No client names or code; describe the problem, what you built, and the outcome.
export const dossiers = [
  {
    code: 'OP-TARIFF',
    name: 'TARIFF WALL',
    title: 'Customs & tariff classification engine',
    problem: '6,000+ products, no reliable HTS codes, and tariff rules changing month to month — customs paperwork was manual and risky.',
    built: 'An HTS code registry and tariff-rule model in Salesforce that calculates duty per line (incl. Chapter 99 / Section 338), sorts CUSMA certificates by HS code, and an AI-assisted tool to propose classifications for review.',
    outcome: 'Every product line can be classified and costed for customs from one source of truth instead of spreadsheets and guesswork.',
    stack: 'Salesforce · Apex · Custom objects · Next.js · Claude API',
  },
  {
    code: 'OP-FREIGHT',
    name: 'FREIGHT HUB',
    title: 'Shipping & commercial invoice integration',
    problem: 'Shipments were booked in carrier portals and customs invoices typed up by hand, disconnected from the order.',
    built: 'A shipment tab on the order that books and imports shipments through the Freightcom API, plus a commercial-invoice object with lock-and-send and PDF generation, wired for UPS Paperless Invoice.',
    outcome: 'Shipping and customs documents come straight from order data — fewer re-typed fields, fewer errors at the border.',
    stack: 'Salesforce · Apex · Lightning components · Freightcom API · UPS API',
  },
  {
    code: 'OP-ORDER',
    name: 'QUOTE-TO-ORDER',
    title: 'Quote-to-order rebuild',
    problem: 'Quotes, opportunities and orders lived in separate, partly manual steps; historical orders were missing from the system.',
    built: 'Grouped quote lines with fees, automatic quote/job numbering, auto-linking quotes to opportunities, order activation with order summaries, and a backfill that brought historical opportunities in as orders.',
    outcome: 'One continuous flow from quote to fulfilled order, with history in the system for reporting.',
    stack: 'Salesforce · Flows · Apex · Experience Cloud',
  },
  {
    code: 'OP-SOURCE',
    name: 'SINGLE SOURCE',
    title: 'Costing data consolidation & ERP evaluation',
    problem: 'Costing lived in QuickBooks, Salesforce and four department spreadsheets that were connected in fragile ways.',
    built: 'One relational model of materials, vendors, products and BOM lines pulling from Salesforce and QuickBooks, then an ERPNext trial as a QuickBooks Desktop replacement with real manufacturing BOMs.',
    outcome: 'Leadership can see true product cost in one place, and the ERP decision is based on the company’s real data.',
    stack: 'Airtable · Salesforce · QuickBooks · ERPNext',
  },
  {
    code: 'OP-ASSET',
    name: 'ASSET DROP',
    title: 'Salesforce CMS image tools',
    problem: 'Loading product images into Salesforce CMS meant renaming files, writing alt text and building import files by hand.',
    built: 'A drag-and-drop uploader that captures alt text and outputs a ready-to-import zip with JSON manifest, and a Lightning app to search CMS images and bulk-associate them to products.',
    outcome: 'Marketing can load and attach a product’s images in minutes instead of editing spreadsheets of URLs.',
    stack: 'Salesforce CMS · Lightning · JavaScript',
  },
];

// Concrete skill clusters for the résumé page and the SIGINT room.
export const skillGroups = [
  { name: 'Salesforce', items: ['Apex', 'Flows', 'Lightning (LWC / Aura)', 'Experience Cloud', 'Quote-to-order', 'Commerce Cloud', 'Data Cloud', 'Marketing Cloud & Account Engagement', 'Agentforce', 'Conga'] },
  { name: 'Integrations', items: ['REST APIs', 'HubSpot ↔ Salesforce', 'Freightcom', 'UPS', 'Zapier / Make / n8n', 'Airtable'] },
  { name: 'Trade compliance', items: ['HTS classification', 'CUSMA', 'Chapter 99 / Section 232 / 301 / 338', 'Commercial invoices'] },
  { name: 'Systems & data', items: ['ERPNext', 'QuickBooks', 'Docker', 'Nextcloud', 'Postgres / SQLite', 'Python'] },
  { name: 'Web & creative', items: ['JavaScript / TypeScript', 'React / Next.js', 'Three.js / WebGL', 'Blender', 'GIS / OpenStreetMap', 'Product photography'] },
  { name: 'AI', items: ['Claude API', 'Agent workflows & MCP', 'AI image generation'] },
];

export const comms = [
  { icon: '✉', label: 'EMAIL', value: 'braincandydan@gmail.com', href: 'mailto:braincandydan@gmail.com' },
  { icon: '☏', label: 'PHONE', value: '250-808-7129', href: 'tel:+12508087129' },
  { icon: '◇', label: 'GITHUB', value: '/braincandydan', href: 'https://github.com/braincandydan' },
  { icon: '▤', label: 'LINKEDIN', value: '/in/your-name', href: '#' },
  { icon: '◈', label: 'BASE', value: 'Kelowna, BC — Canada', href: '#' },
];

// Side ops: personal projects. links: optional list of { label, href } shown as buttons on the card.
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
      { label: 'LIVE', href: 'https://braincandydan.github.io/Model-Gen/' },
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
      { label: 'LIVE', href: 'https://braincandydan.github.io/zodiax/' },
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
      { label: 'LIVE', href: 'https://braincandydan.github.io/ski-app/' },
      { label: 'SOURCE', href: 'https://github.com/braincandydan/ski-app' },
    ],
  },
];

