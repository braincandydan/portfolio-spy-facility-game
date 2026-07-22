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

  // ---- stick via pointer events ----
  let stickPointerId = null;
  const stickRect = () => stickWrap.getBoundingClientRect();

  const setKnob = (nx, ny) => {
    knob.style.transform = `translate(calc(-50% + ${nx * JOY_RADIUS}px), calc(-50% + ${-ny * JOY_RADIUS}px))`;
    game.setJoystick(nx, ny);
  };

  const readStick = (clientX, clientY) => {
    const r = stickRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = (clientX - cx) / JOY_RADIUS;
    let dy = -(clientY - cy) / JOY_RADIUS;
    const mag = Math.hypot(dx, dy);
    if (mag > 1) { dx /= mag; dy /= mag; }
    setKnob(dx, dy);
  };

  stickZone.addEventListener('pointerdown', (e) => {
    if (stickPointerId !== null) return;
    e.preventDefault();
    stickPointerId = e.pointerId;
    stickZone.setPointerCapture(e.pointerId);
    stickWrap.classList.add('active');
    readStick(e.clientX, e.clientY);
  });

  stickZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickPointerId) return;
    e.preventDefault();
    readStick(e.clientX, e.clientY);
  });

  const endStick = (e) => {
    if (e.pointerId !== stickPointerId) return;
    stickPointerId = null;
    stickWrap.classList.remove('active');
    setKnob(0, 0);
  };
  stickZone.addEventListener('pointerup', endStick);
  stickZone.addEventListener('pointercancel', endStick);

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
