// Universal GoldenEye-style controls: one N64 stick (pointer events — works with
// mouse and touch). On touch devices the face buttons are hidden — interact via
// the HUD prompt tap instead. Desktop keeps FIRE / USE / SWAP / WATCH.

export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
}

const JOY_RADIUS = 58;

/**
 * Mount the single-stick control layer. Always shown during gameplay.
 */
export function mountN64Controls(root, game) {
  const touch = isTouchDevice();
  const wrap = document.createElement('div');
  wrap.className = `n64-ui hidden${touch ? ' n64-ui--touch' : ''}`;

  // Stick lives bottom-left so the center prompt stays tappable.
  const stickZone = document.createElement('div');
  stickZone.className = 'n64-stick-zone';
  wrap.appendChild(stickZone);

  const stickWrap = document.createElement('div');
  stickWrap.className = 'n64-stick';
  stickWrap.innerHTML = `
    <svg class="n64-stick__gate" viewBox="0 0 100 100" aria-hidden="true">
      <polygon points="30,5 70,5 95,30 95,70 70,95 30,95 5,70 5,30" fill="none" stroke="currentColor" stroke-width="2"/>
      <circle cx="50" cy="50" r="6" fill="currentColor" opacity="0.25"/>
    </svg>
    <div class="n64-stick__knob"></div>
  `;
  stickZone.appendChild(stickWrap);

  const knob = stickWrap.querySelector('.n64-stick__knob');

  const lockBanner = document.createElement('div');
  lockBanner.className = 'n64-lock-banner hidden';
  wrap.appendChild(lockBanner);

  // Desktop face buttons (hidden on touch via CSS + class)
  const watchBtn = el('button', 'n64-btn n64-btn--watch', '◷');
  const cycleBtn = el('button', 'n64-btn n64-btn--cycle hidden', 'C<br><span>SWAP</span>');
  const interactBtn = el('button', 'n64-btn n64-btn--interact hidden', 'E<br><span>USE</span>');
  const fireBtn = el('button', 'n64-btn n64-btn--fire', 'Z<br><span>FIRE</span>');

  wrap.appendChild(watchBtn);
  wrap.appendChild(cycleBtn);
  wrap.appendChild(interactBtn);
  wrap.appendChild(fireBtn);

  const itemLabel = document.createElement('div');
  itemLabel.className = 'n64-item-label hidden';
  wrap.appendChild(itemLabel);

  root.appendChild(wrap);

  // ---- stick: pointer lock (mouse), spring snap-back, and N64 wear ----
  let stickPointerId = null;
  let held = false;
  let vx = 0, vy = 0;
  let svx = 0, svy = 0;
  let wear = 0;

  const clampStick = () => {
    const m = Math.hypot(vx, vy);
    if (m > JOY_RADIUS) { vx *= JOY_RADIUS / m; vy *= JOY_RADIUS / m; }
  };

  const applyStick = () => {
    const authority = 1 - 0.35 * wear;
    game.setJoystick((vx / JOY_RADIUS) * authority, (-vy / JOY_RADIUS) * authority);
    knob.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`;
    const hue = 172 - wear * 140;
    knob.style.background = `hsla(${hue}, 70%, 50%, .4)`;
    knob.style.borderColor = `hsl(${hue}, 72%, 55%)`;
    knob.style.boxShadow = `0 0 10px hsla(${hue}, 70%, 50%, .35)`;
  };

  const isLocked = () => document.pointerLockElement === stickZone;

  const readAbsolute = (clientX, clientY) => {
    const r = stickWrap.getBoundingClientRect();
    vx = clientX - (r.left + r.width / 2);
    vy = clientY - (r.top + r.height / 2);
    clampStick();
  };

  stickZone.addEventListener('pointerdown', (e) => {
    if (stickPointerId !== null) return;
    e.preventDefault();
    stickPointerId = e.pointerId;
    held = true;
    svx = 0; svy = 0;
    stickZone.setPointerCapture(e.pointerId);
    stickWrap.classList.add('active');
    readAbsolute(e.clientX, e.clientY);
    applyStick();
    if (e.pointerType === 'mouse' && stickZone.requestPointerLock) {
      try {
        const p = stickZone.requestPointerLock();
        if (p && p.catch) p.catch(() => {});
      } catch { /* best-effort */ }
    }
  });

  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointerId) return;
    e.preventDefault();
    if (isLocked()) {
      vx += e.movementX;
      vy += e.movementY;
      clampStick();
    } else {
      readAbsolute(e.clientX, e.clientY);
    }
    applyStick();
  });

  const endStick = (e) => {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    held = false;
    stickWrap.classList.remove('active');
    if (isLocked()) {
      try { document.exitPointerLock(); } catch { /* noop */ }
    }
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);

  let lastTick = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - lastTick) / 1000);
    lastTick = now;

    const deflection = Math.hypot(vx, vy) / JOY_RADIUS;
    if (held) {
      wear = Math.min(1, wear + deflection * dt / 45);
      applyStick();
    } else {
      wear = Math.max(0, wear - dt / 15);
      if (vx !== 0 || vy !== 0 || svx !== 0 || svy !== 0) {
        const k = 200 - 150 * wear;
        const c = 16 - 12 * wear;
        svx += (-k * vx - c * svx) * dt;
        svy += (-k * vy - c * svy) * dt;
        vx += svx * dt;
        vy += svy * dt;
        if (Math.hypot(vx, vy) < 0.6 && Math.hypot(svx, svy) < 4) {
          vx = 0; vy = 0; svx = 0; svy = 0;
        }
        applyStick();
      }
    }
    game.setStickWear?.(wear);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ---- buttons (desktop) ----
  watchBtn.addEventListener('click', (e) => { e.preventDefault(); game.toggleWatch(); });
  interactBtn.addEventListener('click', (e) => { e.preventDefault(); game.interact(); });
  cycleBtn.addEventListener('click', (e) => { e.preventDefault(); game.cycleItem(); });
  fireBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fireBtn.classList.add('pressed');
    game.shoot();
  });
  fireBtn.addEventListener('pointerup', () => fireBtn.classList.remove('pressed'));
  fireBtn.addEventListener('pointerleave', () => fireBtn.classList.remove('pressed'));

  game.subscribe((state) => {
    const gameplay = state.booted && state.active && !state.dialogue;
    wrap.classList.toggle('hidden', !(state.booted && state.active));
    // On touch, face buttons stay hidden — prompt tap handles interact.
    if (!touch) {
      interactBtn.classList.toggle('hidden', !(gameplay && state.prompt));
      cycleBtn.classList.toggle('hidden', !(gameplay && state.inventory.length > 1));
      fireBtn.classList.toggle('hidden', !(gameplay && state.activeItem));
    }

    if (gameplay && state.activeItem) {
      itemLabel.classList.remove('hidden');
      itemLabel.textContent = state.activeItem.toUpperCase();
    } else {
      itemLabel.classList.add('hidden');
    }

    if (state.booted && state.active && state.lockMsg) {
      lockBanner.classList.remove('hidden');
      lockBanner.textContent = state.lockMsg;
    } else {
      lockBanner.classList.add('hidden');
    }
  });
}

/** @deprecated use mountN64Controls — kept so old imports don't break mid-refactor */
export function mountTouchControls(root, game) {
  return mountN64Controls(root, game);
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
