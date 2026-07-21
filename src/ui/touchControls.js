// On-screen touch controls: a left-side virtual joystick for movement, a
// right-side drag zone for look, plus tap buttons for interact/fire/watch.
// Only mounted when main.js detects a touch-capable device.

export function isTouchDevice() {
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || (window.matchMedia?.('(pointer: coarse)').matches ?? false);
}

const JOY_RADIUS = 50;

export function mountTouchControls(root, game) {
  const wrap = document.createElement('div');
  wrap.className = 'touch-ui hidden';

  const moveZone = document.createElement('div');
  moveZone.className = 'touch-zone move';
  wrap.appendChild(moveZone);

  const lookZone = document.createElement('div');
  lookZone.className = 'touch-zone look';
  wrap.appendChild(lookZone);

  const joyBase = document.createElement('div');
  joyBase.className = 'touch-joy-base hidden';
  const joyKnob = document.createElement('div');
  joyKnob.className = 'touch-joy-knob';
  joyBase.appendChild(joyKnob);
  wrap.appendChild(joyBase);

  const watchBtn = el('button', 'touch-btn touch-btn--watch', '◷');
  const interactBtn = el('button', 'touch-btn touch-btn--interact hidden', '◉<br>E');
  const fireBtn = el('button', 'touch-btn touch-btn--fire hidden', '◎');
  wrap.appendChild(watchBtn);
  wrap.appendChild(interactBtn);
  wrap.appendChild(fireBtn);

  root.appendChild(wrap);

  // ---- movement joystick (dynamic — appears wherever the left zone is touched) ----
  let moveTouchId = null;
  let origin = { x: 0, y: 0 };

  moveZone.addEventListener('touchstart', (e) => {
    if (moveTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    moveTouchId = t.identifier;
    origin = { x: t.clientX, y: Math.min(t.clientY, window.innerHeight - 110) };
    joyBase.style.left = `${origin.x}px`;
    joyBase.style.top = `${origin.y}px`;
    joyBase.classList.remove('hidden');
    joyKnob.style.transform = 'translate(-50%, -50%)';
  }, { passive: false });

  moveZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== moveTouchId) continue;
      e.preventDefault();
      const dx = t.clientX - origin.x, dy = t.clientY - origin.y;
      const d = Math.hypot(dx, dy);
      const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
      const kx = dx * k, ky = dy * k;
      joyKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
      game.setJoystick(kx / JOY_RADIUS, -ky / JOY_RADIUS);
    }
  }, { passive: false });

  const endMove = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== moveTouchId) continue;
      moveTouchId = null;
      joyBase.classList.add('hidden');
      game.setJoystick(0, 0);
    }
  };
  moveZone.addEventListener('touchend', endMove);
  moveZone.addEventListener('touchcancel', endMove);

  // ---- look drag ----
  let lookTouchId = null;
  let lastX = 0, lastY = 0;

  lookZone.addEventListener('touchstart', (e) => {
    if (lookTouchId !== null) return;
    e.preventDefault();
    const t = e.changedTouches[0];
    lookTouchId = t.identifier;
    lastX = t.clientX;
    lastY = t.clientY;
  }, { passive: false });

  lookZone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== lookTouchId) continue;
      e.preventDefault();
      game.applyLook(t.clientX - lastX, t.clientY - lastY);
      lastX = t.clientX;
      lastY = t.clientY;
    }
  }, { passive: false });

  const endLook = (e) => {
    for (const t of e.changedTouches) if (t.identifier === lookTouchId) lookTouchId = null;
  };
  lookZone.addEventListener('touchend', endLook);
  lookZone.addEventListener('touchcancel', endLook);

  // ---- buttons ----
  watchBtn.addEventListener('click', (e) => { e.preventDefault(); game.toggleWatch(); });
  interactBtn.addEventListener('click', (e) => { e.preventDefault(); game.interact(); });
  fireBtn.addEventListener('click', (e) => { e.preventDefault(); game.shoot(); });

  game.subscribe((state) => {
    const gameplay = state.booted && state.active;
    wrap.classList.toggle('hidden', !gameplay);
    interactBtn.classList.toggle('hidden', !(gameplay && state.prompt));
    fireBtn.classList.toggle('hidden', !(gameplay && state.hasGun));
  });
}

function el(tag, className, html) {
  const node = document.createElement(tag);
  node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}
