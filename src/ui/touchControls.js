// Universal GoldenEye-style controls: one N64 stick (pointer events — works with
// mouse and touch on every device) plus FIRE / AIM / INTERACT / CYCLE / WATCH.

export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
}

const JOY_RADIUS = 58;

/**
 * Mount the single-stick control layer. Always shown during gameplay.
 */
export function mountN64Controls(root, game) {
  const wrap = document.createElement('div');
  wrap.className = 'n64-ui hidden';

  // Forgiving grab zone (bottom-left corner) — you can start the drag anywhere
  // near the stick, not just on the knob. Big win for mouse users.
  const stickZone = document.createElement('div');
  stickZone.className = 'n64-stick-zone';
  wrap.appendChild(stickZone);

  // Fixed stick with visible octagonal gate
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

  // Aim-mode floating crosshair (positioned in screen space from NDC)
  const aimReticle = document.createElement('div');
  aimReticle.className = 'n64-aim-reticle hidden';
  aimReticle.innerHTML = '<i class="l"></i><i class="r"></i><i class="t"></i><i class="b"></i><i class="dot"></i>';
  wrap.appendChild(aimReticle);

  const lockBanner = document.createElement('div');
  lockBanner.className = 'n64-lock-banner hidden';
  wrap.appendChild(lockBanner);

  const watchBtn = el('button', 'n64-btn n64-btn--watch', '◷');
  const cycleBtn = el('button', 'n64-btn n64-btn--cycle hidden', 'C<br><span>SWAP</span>');
  const interactBtn = el('button', 'n64-btn n64-btn--interact hidden', 'E<br><span>USE</span>');
  const aimBtn = el('button', 'n64-btn n64-btn--aim', 'R<br><span>AIM</span>'); // toggles
  const fireBtn = el('button', 'n64-btn n64-btn--fire', 'Z<br><span>FIRE</span>');

  wrap.appendChild(watchBtn);
  wrap.appendChild(cycleBtn);
  wrap.appendChild(interactBtn);
  wrap.appendChild(aimBtn);
  wrap.appendChild(fireBtn);

  const itemLabel = document.createElement('div');
  itemLabel.className = 'n64-item-label hidden';
  wrap.appendChild(itemLabel);

  root.appendChild(wrap);

  // ---- stick: pointer lock (mouse), spring snap-back, and N64 wear ----
  //
  // vx/vy = knob offset in px (screen space, +y down). While held, the pointer
  // drives it directly; on release a damped spring pulls it home. Heavy use
  // builds `wear` (0..1): the spring gets spongy (slower, wobblier) and the
  // stick loses authority — rest it to let it recover, like a real N64 stick.
  let stickPointerId = null;
  let held = false;
  let vx = 0, vy = 0;
  let svx = 0, svy = 0; // spring velocity
  let wear = 0;

  const clampStick = () => {
    const m = Math.hypot(vx, vy);
    if (m > JOY_RADIUS) { vx *= JOY_RADIUS / m; vy *= JOY_RADIUS / m; }
  };

  const applyStick = () => {
    const authority = 1 - 0.35 * wear; // worn stick pushes less
    game.setJoystick((vx / JOY_RADIUS) * authority, (-vy / JOY_RADIUS) * authority);
    knob.style.transform = `translate(calc(-50% + ${vx}px), calc(-50% + ${vy}px))`;
    // knob tint: teal (fresh) → amber → red (worn out)
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
    // Lock the mouse cursor to the stick so you can't drag out of the window
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
    // spring takes over from here (see tick loop)
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);

  // Spring + wear simulation
  let lastTick = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - lastTick) / 1000);
    lastTick = now;

    const deflection = Math.hypot(vx, vy) / JOY_RADIUS;
    if (held) {
      // ~45s of full-tilt use to wear the spring out completely
      wear = Math.min(1, wear + deflection * dt / 45);
      applyStick(); // keep authority/tint in sync while held
    } else {
      // resting: spring home + recover (~15s to full)
      wear = Math.max(0, wear - dt / 15);
      if (vx !== 0 || vy !== 0 || svx !== 0 || svy !== 0) {
        // Semi-implicit Euler spring. Fresh stick: stiff + damped = crisp snap.
        // Worn stick: soft + underdamped = slow, wobbly return.
        const k = 200 - 150 * wear;
        const c = 16 - 12 * wear;
        svx += (-k * vx - c * svx) * dt;
        svy += (-k * vy - c * svy) * dt;
        vx += svx * dt;
        vy += svy * dt;
        if (Math.hypot(vx, vy) < 0.6 && Math.hypot(svx, svy) < 4) {
          vx = 0; vy = 0; svx = 0; svy = 0;
        }
        applyStick(); // the wobble feeds movement — authentically spongy
      }
    }
    game.setStickWear?.(wear);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ---- buttons ----
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

  // Tap-to-toggle aim (holding a button + steering the stick is impossible one-handed)
  aimBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    game.toggleAiming();
  });

  game.subscribe((state) => {
    const gameplay = state.booted && state.active;
    wrap.classList.toggle('hidden', !gameplay);
    interactBtn.classList.toggle('hidden', !(gameplay && state.prompt));
    cycleBtn.classList.toggle('hidden', !(gameplay && state.inventory.length > 1));
    fireBtn.classList.toggle('hidden', !(gameplay && state.activeItem));
    aimBtn.classList.toggle('hidden', !(gameplay && state.activeItem === 'pistol'));
    aimBtn.classList.toggle('pressed', state.aiming);

    // Item label
    if (gameplay && state.activeItem) {
      itemLabel.classList.remove('hidden');
      itemLabel.textContent = state.activeItem.toUpperCase();
    } else {
      itemLabel.classList.add('hidden');
    }

    // Lock banner
    if (gameplay && state.lockMsg) {
      lockBanner.classList.remove('hidden');
      lockBanner.textContent = state.lockMsg;
    } else {
      lockBanner.classList.add('hidden');
    }

    // Aim reticle position from NDC
    if (gameplay && state.aiming) {
      aimReticle.classList.remove('hidden');
      const x = (state.aimCross.x * 0.5 + 0.5) * 100;
      const y = (-state.aimCross.y * 0.5 + 0.5) * 100;
      aimReticle.style.left = `${x}%`;
      aimReticle.style.top = `${y}%`;
    } else {
      aimReticle.classList.add('hidden');
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
