import { ZONE_ORDER, ZONE_NAMES, ZONE_SUBS } from './game/zones.js';
import { profile, comms, projects, skills } from './content.js';
import { isTouchDevice } from './ui/touchControls.js';

const CLEARANCE_LABELS = ['UNAUTHORIZED', 'RECRUIT', 'FIELD', 'OPERATIVE', 'SENIOR', '00 — AGENT'];

const el = (tag, className, html) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
};

const clockNow = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}`;
};

/** Builds the static DOM skeleton once, then re-renders the dynamic bits on every game state change. */
export function mountUI(root, game) {
  root.innerHTML = '';

  const viewport = el('div', 'viewport');
  viewport.addEventListener('click', game.canvasClick);
  root.appendChild(viewport);

  root.appendChild(el('div', 'crt-scanlines'));
  root.appendChild(el('div', 'crt-vignette'));
  root.appendChild(el('div', 'crt-sweep'));

  const hud = buildHud(game);
  root.appendChild(hud.node);

  const toast = el('div', 'toast hidden', '✓ ALL INTEL RECOVERED — CLEARANCE ELEVATED TO 00');
  root.appendChild(toast);

  const boot = buildBoot(game);
  root.appendChild(boot.node);

  const pause = buildPause(game);
  root.appendChild(pause.node);

  const watch = buildWatch(game);
  root.appendChild(watch.node);

  const panel = buildPanel(game);
  root.appendChild(panel.node);

  const dialogue = buildDialogue(game);
  root.appendChild(dialogue.node);

  game.subscribe((state) => {
    const visited = game.objectivesVisited, total = game.objectivesTotal;
    hud.update(state, visited, total);
    toast.classList.toggle('hidden', visited !== total);
    boot.update(state);
    pause.update(state);
    watch.update(state, visited, total);
    panel.update(state);
    dialogue.update(state);
  });

  return { mount: () => game.init() };
}

function buildHud(game) {
  const node = el('div', 'hud hidden');

  const crosshair = el('div', 'crosshair hidden', `
    <i class="l"></i><i class="r"></i><i class="t"></i><i class="b"></i><i class="dot"></i>
  `);
  node.appendChild(crosshair);

  const sector = el('div', 'hud__sector', `
    <div class="label">▐ SECTOR</div>
    <div class="value" data-area></div>
    <div class="coords">◈ <span data-coords></span></div>
  `);
  node.appendChild(sector);

  const intel = el('div', 'hud__intel', `
    <div class="label">INTEL RECOVERED</div>
    <div class="value"><span data-visited></span><span class="total">/<span data-total></span></span></div>
    <div class="clearance">CLEARANCE — <span data-clearance></span></div>
    <div class="clearance hidden" data-armed>◆ SIDEARM ARMED</div>
  `);
  node.appendChild(intel);

  const stats = el('div', 'hud__stats', `
    <div class="hud__stat">
      <div class="row"><span>MORALE</span><span>82</span></div>
      <div class="bar"><div class="fill teal" style="width:82%"></div></div>
    </div>
    <div class="hud__stat">
      <div class="row"><span>CAFFEINE</span><span>64</span></div>
      <div class="bar"><div class="fill amber" style="width:64%"></div></div>
    </div>
    <div class="hud__stat">
      <div class="row"><span>SIGNAL</span><span>SYNC</span></div>
      <div class="bar"><div class="fill teal pulse" style="width:91%"></div></div>
    </div>
  `);
  node.appendChild(stats);

  const prompt = el('div', 'hud__prompt hidden', `
    <div class="box">◉ <span class="key">[E]</span> — <span data-prompt-verb></span> <span data-prompt-name></span></div>
  `);
  node.appendChild(prompt);

  const navHint = 'stick or arrows/WASD to move &nbsp;·&nbsp; hold [R] to aim &nbsp;·&nbsp; [Z] fire &nbsp;·&nbsp; [E] use &nbsp;·&nbsp; [C] swap gadgets &nbsp;·&nbsp; [TAB] watch';
  const tickerText = `<span class="tag">◆ OBJECTIVE</span> — infiltrate the facility &nbsp;·&nbsp; recover all 5 intel caches &nbsp;·&nbsp; access the DOSSIER for extraction papers &nbsp;·&nbsp; ${navHint} &nbsp;·&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;`;
  const ticker = el('div', 'hud__ticker', `<div class="track">${tickerText}${tickerText}</div>`);
  node.appendChild(ticker);

  const watchHint = el('div', 'hud__watch-hint', `◷ WATCH`);
  node.appendChild(watchHint);

  return {
    node,
    update(state) {
      node.classList.toggle('hidden', !state.booted);
      crosshair.classList.toggle('hidden', !state.active || state.aiming);
      sector.querySelector('[data-area]').textContent = state.area;
      sector.querySelector('[data-coords]').textContent = state.coords;
      intel.querySelector('[data-visited]').textContent = game.objectivesVisited;
      intel.querySelector('[data-total]').textContent = game.objectivesTotal;
      intel.querySelector('[data-clearance]').textContent = CLEARANCE_LABELS[game.objectivesVisited];
      intel.querySelector('[data-armed]').classList.toggle('hidden', !state.hasGun);
      const hasPrompt = !!(state.prompt && state.active);
      prompt.classList.toggle('hidden', !hasPrompt);
      if (hasPrompt) {
        prompt.querySelector('[data-prompt-verb]').textContent = state.prompt.verb || 'ACCESS';
        prompt.querySelector('[data-prompt-name]').textContent = state.prompt.name;
      }
    },
  };
}

function buildBoot(game) {
  const keysLine = 'STICK / ARROWS / WASD MOVE &nbsp; · &nbsp; HOLD [R] AIM &nbsp; · &nbsp; [Z] FIRE &nbsp; · &nbsp; [E] USE &nbsp; · &nbsp; [C] SWAP &nbsp; · &nbsp; [TAB] WATCH &nbsp; · &nbsp; [ESC] PAUSE';
  const node = el('div', 'boot', `
    <div class="boot__eyebrow">CLASSIFIED // LEVEL 00 CLEARANCE</div>
    <div class="boot__title">FIELD&nbsp;OPERATIVE</div>
    <div class="boot__subtitle">P O R T F O L I O</div>
    <div class="boot__rule"></div>
    <div class="boot__cta">▶ ${isTouchDevice() ? 'TAP' : 'CLICK'} TO INSERT CARTRIDGE</div>
    <div class="boot__keys">${keysLine}</div>
    <div class="boot__err hidden" data-err></div>
  `);
  node.addEventListener('click', game.start);
  return {
    node,
    update(state) {
      node.classList.toggle('hidden', state.booted);
      const errNode = node.querySelector('[data-err]');
      errNode.classList.toggle('hidden', !state.err);
      if (state.err) errNode.textContent = state.err;
    },
  };
}

function buildPause(game) {
  const hint = 'stick or arrows/WASD move · hold [R] aim · [Z] fire · [E] use · [C] swap · [TAB] watch';
  const node = el('div', 'pause hidden', `
    <div class="pause__title">PAUSED</div>
    <div class="pause__cta">▶ ${isTouchDevice() ? 'TAP' : 'CLICK'} TO RESUME</div>
    <div class="pause__hint">${hint}</div>
  `);
  node.addEventListener('click', game.resume);
  return {
    node,
    update(state) {
      const show = state.booted && !state.active && !state.showWatch && !state.panel;
      node.classList.toggle('hidden', !show);
    },
  };
}

function buildWatch(game) {
  const node = el('div', 'watch-overlay hidden');
  const watch = el('div', 'watch');
  watch.appendChild(el('div', 'watch__strap top'));
  watch.appendChild(el('div', 'watch__strap bottom'));

  const bezel = el('div', 'watch__bezel');
  bezel.appendChild(el('div', 'watch__crown'));

  const screen = el('div', 'watch__screen');
  screen.appendChild(el('div', 'watch__scanlines'));

  const header = el('div', 'watch__header', `
    <div class="title">◷ FIELD WATCH — OS 00</div>
    <div class="clock" data-clock></div>
  `);
  screen.appendChild(header);

  const body = el('div', 'watch__body');
  const tabs = el('div', 'watch__tabs');
  const tabsClose = el('button', 'watch__tabs-close', isTouchDevice() ? '✕ close' : '[TAB] close');
  tabsClose.addEventListener('click', game.toggleWatch);
  const tabDefs = [['nav', '◇ NAV'], ['intel', '◆ INTEL'], ['dossier', '▤ DOSSIER'], ['comms', '✉ COMMS'], ['sys', '⚙ SYSTEM']];
  const tabButtons = tabDefs.map(([id, label]) => {
    const btn = el('button', 'watch__tab', label);
    btn.addEventListener('click', () => game.setWatchTab(id));
    tabs.appendChild(btn);
    return { id, btn };
  });
  tabs.appendChild(tabsClose);
  body.appendChild(tabs);

  const content = el('div', 'watch__content');
  body.appendChild(content);
  screen.appendChild(body);
  bezel.appendChild(screen);
  watch.appendChild(bezel);
  node.appendChild(watch);

  return {
    node,
    update(state, visited, total) {
      node.classList.toggle('hidden', !state.showWatch);
      if (!state.showWatch) return;
      header.querySelector('[data-clock]').textContent = clockNow();
      for (const { id, btn } of tabButtons) btn.classList.toggle('active', state.watchTab === id);
      content.innerHTML = renderWatchTab(game, state, visited, total);
      wireWarpButtons(content, game);
      wireWatchSysControls(content, game, state);
    },
  };
}

function sectorRows(state, kind) {
  return ZONE_ORDER.map((id) => {
    const done = !!state.objectives[id];
    if (kind === 'nav') {
      return `
        <div class="watch__sector-row">
          <div><span style="color:${done ? '#2fd4c6' : '#6b7079'}">${done ? '✓' : '○'}</span>
            <span class="name">${ZONE_NAMES[id]}</span>
            <div class="sub">${ZONE_SUBS[id]}</div>
          </div>
          <button class="watch__warp" data-warp="${id}">WARP ▸</button>
        </div>`;
    }
    return `
      <div class="watch__intel-row">
        <span style="color:${done ? '#2fd4c6' : '#6b7079'}; font-size:15px;">${done ? '✓' : '○'}</span>
        <span class="name">${ZONE_NAMES[id]}</span>
        <span class="status">${done ? 'RECOVERED' : 'SEALED'}</span>
      </div>`;
  }).join('');
}

function renderWatchTab(game, state, visited, total) {
  const clearance = CLEARANCE_LABELS[visited];
  if (state.watchTab === 'nav') {
    return `<div class="watch__section-title">// NAVIGATION — WARP</div>${sectorRows(state, 'nav')}`;
  }
  if (state.watchTab === 'intel') {
    return `
      <div class="watch__section-title">// INTEL — CLEARANCE ${clearance}</div>
      <div class="watch__intel-bar"><div class="fill" style="width:${(visited / total) * 100}%"></div></div>
      ${sectorRows(state, 'intel')}
      <div class="watch__intel-note">+50 XP per cache · recover all to reach clearance 00.</div>
    `;
  }
  if (state.watchTab === 'dossier') {
    return `
      <div class="watch__section-title">// DOSSIER</div>
      <div class="watch__dossier-name">${profile.name}</div>
      <div class="watch__dossier-role">${profile.codename}</div>
      <p class="watch__dossier-bio">${profile.bio}</p>
      <div class="watch__dossier-links">
        <a class="btn-solid" href="${profile.resume.href}">⬇ DOWNLOAD RESUME.PDF</a>
        <a class="btn-outline" href="${profile.cv.href}">◈ VIEW CV</a>
      </div>
    `;
  }
  if (state.watchTab === 'comms') {
    return `
      <div class="watch__section-title">// COMMS — SECURE CHANNELS</div>
      <div class="watch__comms-list">
        ${comms.map((c) => `<a class="watch__comms-row" href="${c.href}"><span class="k">${c.icon} ${c.label}</span>${c.value}</a>`).join('')}
      </div>
    `;
  }
  if (state.watchTab === 'sys') {
    const sensPct = ((state.sens - 0.6) / 5.4) * 100;
    return `
      <div class="watch__section-title">// SYSTEM</div>
      <div class="watch__sys-row">
        <span class="k">AUDIO</span>
        <button class="watch__toggle" data-toggle-sound>${state.soundOn ? '◉ ON' : '○ OFF'}</button>
      </div>
      <div class="watch__sens">
        <div class="watch__sens-row"><span>LOOK SENSITIVITY</span><span class="v">${state.sens.toFixed(1)}</span></div>
        <div class="watch__sens-controls">
          <button class="watch__sens-btn" data-sens-down>–</button>
          <div class="watch__sens-track"><div class="fill" style="width:${sensPct}%"></div></div>
          <button class="watch__sens-btn" data-sens-up>+</button>
        </div>
      </div>
      <button class="watch__reset" data-reset-pos>↺ RETURN TO ATRIUM</button>
    `;
  }
  return '';
}

function wireWarpButtons(content, game) {
  content.querySelectorAll('[data-warp]').forEach((btn) => {
    btn.addEventListener('click', () => game.warp(btn.dataset.warp));
  });
}

function wireWatchSysControls(content, game) {
  content.querySelector('[data-toggle-sound]')?.addEventListener('click', game.toggleSound);
  content.querySelector('[data-sens-up]')?.addEventListener('click', game.sensUp);
  content.querySelector('[data-sens-down]')?.addEventListener('click', game.sensDown);
  content.querySelector('[data-reset-pos]')?.addEventListener('click', game.resetPosition);
}

function buildPanel(game) {
  const node = el('div', 'panel-overlay hidden');
  const panel = el('div', 'panel');
  const header = el('div', 'panel__header', `
    <div class="panel__title">// SECTOR ACCESS — <span data-panel-title></span></div>
    <button class="panel__close">✕ [ESC]</button>
  `);
  header.querySelector('.panel__close').addEventListener('click', game.closePanel);
  panel.appendChild(header);
  const body = el('div', 'panel__body');
  panel.appendChild(body);
  node.appendChild(panel);

  return {
    node,
    update(state) {
      node.classList.toggle('hidden', !state.panel);
      if (!state.panel) return;
      header.querySelector('[data-panel-title]').textContent = ZONE_NAMES[state.panel] || 'BRIEFING REEL';
      body.innerHTML = renderPanelBody(state.panel);
    },
  };
}

function buildDialogue(game) {
  const node = el('div', 'dialogue hidden');
  const box = el('div', 'dialogue__box', `
    <div class="dialogue__speaker" data-speaker></div>
    <div class="dialogue__line" data-line></div>
    <div class="dialogue__hint">[E] ▸ <span data-progress></span></div>
  `);
  node.appendChild(box);
  box.addEventListener('click', () => game.advanceDialogue());

  return {
    node,
    update(state) {
      node.classList.toggle('hidden', !state.dialogue);
      if (!state.dialogue) return;
      const d = state.dialogue;
      box.querySelector('[data-speaker]').textContent = d.speaker;
      box.querySelector('[data-line]').textContent = d.lines[d.idx];
      box.querySelector('[data-progress]').textContent = `${d.idx + 1} / ${d.lines.length}`;
    },
  };
}

function renderPanelBody(panelId) {
  if (panelId === 'projects') {
    return `
      <div class="panel__heading">RECOVERED CRAFT — PROJECT FILES</div>
      <div class="panel__sub">Reverse-engineering reports. Each craft is one of your projects.</div>
      <div class="crate-grid">
        ${projects.map((p) => `
          <div class="crate">
            <div class="crate__thumb">▦ SCREENSHOT</div>
            <div class="crate__no">CRAFT ${p.no}</div>
            <div class="crate__name">${p.name}</div>
            <div class="crate__desc">${p.desc}</div>
            <div class="crate__tech">${p.tech}</div>
          </div>
        `).join('')}
      </div>
    `;
  }
  if (panelId === 'skills') {
    return `
      <div class="panel__heading">SIGINT — DECRYPTED CAPABILITIES</div>
      <div class="panel__sub">Digital intercepts. Replace with your real stack.</div>
      <div class="skill-grid">
        ${skills.map((k) => `
          <div class="skill">
            <div class="row"><span>${k.name}</span><span class="lvl">${k.lvl}</span></div>
            <div class="bar"><div class="fill" style="width:${k.pct}%"></div></div>
          </div>
        `).join('')}
      </div>
    `;
  }
  if (panelId === 'about') {
    return `
      <div class="panel__heading">PERSONNEL FILE — EYES ONLY</div>
      <div class="panel__sub">Paper dossier, pulled from the vault cabinets.</div>
      <div class="about-layout">
        <div class="about-photo">▣ PHOTO</div>
        <div class="about-bio">
          <p>${profile.bio}</p>
          <div class="about-stats">
            ${profile.stats.map((s) => `<div><div class="value">${s.value}</div>${s.label}</div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }
  if (panelId === 'contact') {
    return `
      <div class="panel__heading">SECURE CHANNELS — J-RÖD AUTHORIZED</div>
      <div class="panel__sub">The subject opened these frequencies for you. Use them wisely.</div>
      <div class="contact-list">
        ${comms.slice(0, 3).map((c) => `<a class="contact-row" href="${c.href}"><span class="k">${c.icon} ${c.label}</span>${c.value}</a>`).join('')}
      </div>
    `;
  }
  if (panelId === 'resume') {
    return `
      <div class="panel__heading">DATA CORE — EXTRACTION PAPERS</div>
      <div class="panel__sub">Grab the dossier before extraction.</div>
      <div class="resume-card">
        <div class="resume-thumb"></div>
        <div class="resume-info">
          <div class="name">${profile.resume.label}</div>
          <div class="meta">${profile.resume.meta}</div>
          <a class="btn-solid" href="${profile.resume.href}">⬇ DOWNLOAD</a>
        </div>
      </div>
    `;
  }
  if (panelId === 'briefing') {
    return `
      <div class="panel__heading">BRIEFING REEL — S-4 ORIENTATION</div>
      <div class="panel__sub">Video evidence. Drop an .mp4 at <code>public/video/briefing.mp4</code> to screen your own footage (demo reel, talk, project walkthrough).</div>
      <div class="briefing-video">
        <video src="video/briefing.mp4" controls playsinline preload="metadata"
               onerror="this.closest('.briefing-video').classList.add('missing')"></video>
        <div class="briefing-video__fallback">
          ▲ NO SIGNAL — REEL NOT FOUND<br>
          <span>place briefing.mp4 in public/video/</span>
        </div>
      </div>
    `;
  }
  return '';
}
