// Plain, fast, printable résumé built from the same content as the game.
// `npm run resume:pdf` prints this page to public/resume.pdf.
import QRCode from 'qrcode';
import { site, profile, experience, dossiers, skillGroups, projects, comms } from './content.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const realLink = (c) => c.href && c.href !== '#';
const bare = (url) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

// Show full URLs (e.g. github.com/you) so they still make sense on paper; skip unfilled placeholders.
const contactText = (c) => (/^https?:/.test(c.href) ? bare(c.href) : c.value);
const contacts = comms
  .filter((c) => realLink(c) || !c.value.includes('your-name'))
  .map((c) => (realLink(c) ? `<a href="${esc(c.href)}">${esc(contactText(c))}</a>` : `<span>${esc(c.value)}</span>`))
  .join('<span class="sep" aria-hidden="true">·</span>');

const liveLink = (p) => (p.links || []).find((l) => l.label === 'LIVE') || (p.links || [])[0];

const html = `
  <div class="mission no-print">
    <span>This is the plain version. Prefer something more fun?</span>
    <a href="./">Play the interactive portfolio →</a>
  </div>

  <header class="head">
    <div class="head__main">
      <h1>${esc(titleCase(profile.name))}</h1>
      <p class="head__title">${esc(profile.title)}</p>
      <p class="head__contacts">${contacts}</p>
    </div>
    <a class="head__interactive" href="${esc(site.url)}">
      <span class="qr" data-qr aria-hidden="true"></span>
      <span class="head__interactive-text">
        <strong>Interactive portfolio</strong>
        <span>${esc(bare(site.url))}</span>
      </span>
    </a>
  </header>

  <section>
    <h2>Summary</h2>
    <p>${esc(profile.summary)}</p>
  </section>

  <section>
    <h2>Experience</h2>
    ${experience.map((job) => `
      <article class="job">
        <div class="job__head">
          <h3>${esc(job.role)}<span class="job__org"> — ${esc(job.org)}</span></h3>
          <span class="job__meta">${esc(job.place)} · ${esc(job.dates)}</span>
        </div>
        <ul>${job.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      </article>
    `).join('')}
  </section>

  <section>
    <h2>Selected case studies</h2>
    <div class="cases">
      ${dossiers.map((d) => `
        <article class="case">
          <h3>${esc(d.title)}</h3>
          <p class="case__problem"><strong>Problem:</strong> ${esc(d.problem)}</p>
          <p><strong>Built:</strong> ${esc(d.built)}</p>
          <p><strong>Outcome:</strong> ${esc(d.outcome)}</p>
          <p class="case__stack">${esc(d.stack)}</p>
        </article>
      `).join('')}
    </div>
  </section>

  <section>
    <h2>Skills</h2>
    <dl class="skills">
      ${skillGroups.map((g) => `<div><dt>${esc(g.name)}</dt><dd>${g.items.map(esc).join(', ')}</dd></div>`).join('')}
    </dl>
  </section>

  <section>
    <h2>Side projects</h2>
    <ul class="side">
      ${projects.map((p) => {
        const link = liveLink(p);
        return `<li><strong>${esc(titleCase(p.name))}</strong><span class="side__desc"> — ${esc(p.desc)}</span> <span class="side__tech">${esc(p.tech)}</span>${
          link ? ` <a href="${esc(link.href)}">${esc(bare(link.href))}</a>` : ''}</li>`;
      }).join('')}
    </ul>
  </section>

  <footer class="foot">
    Explore this résumé as a playable mission: <a href="${esc(site.url)}">${esc(bare(site.url))}</a>
  </footer>
`;

document.getElementById('resume').innerHTML = html;

QRCode.toString(site.url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' })
  .then((svg) => { document.querySelector('[data-qr]').innerHTML = svg; })
  .catch(() => {})
  .finally(() => { document.body.dataset.ready = 'true'; });
