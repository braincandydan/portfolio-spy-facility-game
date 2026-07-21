import { buildLevel } from './level.js';
import { ZONES, ZONE_ORDER, isWalkable, areaAt, START_POSITION } from './zones.js';
import { AudioEngine } from '../audio.js';

const MOVE_SPEED = 8;
const PITCH_LIMIT = 1.4;

/**
 * Owns the Three.js scene, first-person controls, and all interactive-portfolio
 * state (boot/pause/watch/panel/objectives). UI is a pure function of `state`;
 * call subscribe() to re-render whenever it changes.
 */
export class Game {
  constructor(mountEl, { pixelation = 0.45, sensitivity = 2.2, enableSound = true } = {}) {
    this.mountEl = mountEl;
    this.pixelation = pixelation;
    this.enableSound = enableSound;
    this.audio = new AudioEngine({ enabled: enableSound });

    this.state = {
      booted: false,
      active: false,
      showWatch: false,
      watchTab: 'nav',
      panel: null,
      area: 'ATRIUM',
      coords: '00.0 · 00.0',
      prompt: null,
      objectives: { projects: false, skills: false, about: false, contact: false, resume: false },
      soundOn: true,
      sens: sensitivity,
      err: null,
    };
    this._listeners = new Set();
    this._last = {};
    this.keys = {};
    this.px = START_POSITION.x;
    this.pz = START_POSITION.z;
    this.yaw = START_POSITION.yaw;
    this.pitch = START_POSITION.pitch;
    this.pointerLocked = false;
    this.dragging = false;
    this._alive = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onPointerLockChange = this._onPointerLockChange.bind(this);
    this._onResize = this._onResize.bind(this);
    this._loop = this._loop.bind(this);
  }

  subscribe(fn) {
    this._listeners.add(fn);
    fn(this.state);
    return () => this._listeners.delete(fn);
  }

  setState(patch) {
    this.state = { ...this.state, ...(typeof patch === 'function' ? patch(this.state) : patch) };
    for (const fn of this._listeners) fn(this.state);
  }

  async init() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    document.addEventListener('mousemove', this._onMouseMove);
    document.addEventListener('mousedown', this._onMouseDown);
    document.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onPointerLockChange);
    window.addEventListener('resize', this._onResize);

    try {
      const THREE = await import('three');
      this.THREE = THREE;
      const W = this.mountEl.clientWidth || window.innerWidth;
      const H = this.mountEl.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const CONCRETE = 0x23262b;
      scene.background = new THREE.Color(CONCRETE);
      scene.fog = new THREE.Fog(CONCRETE, 9, 52);

      const cam = new THREE.PerspectiveCamera(72, W / H, 0.1, 200);
      cam.rotation.order = 'YXZ';
      cam.position.set(this.px, 1.7, this.pz);

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(1);
      renderer.setSize(Math.max(2, Math.floor(W * this.pixelation)), Math.max(2, Math.floor(H * this.pixelation)), false);
      this.mountEl.appendChild(renderer.domElement);

      this.scene = scene;
      this.cam = cam;
      this.renderer = renderer;

      const { core } = buildLevel(THREE, scene);
      this._core = core;

      this._clock = new THREE.Clock();
      this._alive = true;
      this._loop();
    } catch (e) {
      this.setState({ err: `Renderer failed to load (${e.message}). Check network / retry.` });
    }
  }

  dispose() {
    this._alive = false;
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    document.removeEventListener('mousemove', this._onMouseMove);
    document.removeEventListener('mousedown', this._onMouseDown);
    document.removeEventListener('mouseup', this._onMouseUp);
    document.removeEventListener('pointerlockchange', this._onPointerLockChange);
    window.removeEventListener('resize', this._onResize);
    this.renderer?.dispose();
  }

  _onResize() {
    if (!this.renderer) return;
    const W = this.mountEl.clientWidth, H = this.mountEl.clientHeight;
    this.cam.aspect = W / H;
    this.cam.updateProjectionMatrix();
    this.renderer.setSize(Math.max(2, Math.floor(W * this.pixelation)), Math.max(2, Math.floor(H * this.pixelation)), false);
  }

  _loop() {
    if (!this._alive) return;
    requestAnimationFrame(this._loop);
    const dt = Math.min(0.05, this._clock.getDelta());

    if (this.state.active && this.state.booted) {
      const f = this.yaw;
      const fx = -Math.sin(f), fz = -Math.cos(f), rx = Math.cos(f), rz = -Math.sin(f);
      let mx = 0, mz = 0;
      if (this.keys.KeyW) { mx += fx; mz += fz; }
      if (this.keys.KeyS) { mx -= fx; mz -= fz; }
      if (this.keys.KeyD) { mx += rx; mz += rz; }
      if (this.keys.KeyA) { mx -= rx; mz -= rz; }
      const l = Math.hypot(mx, mz);
      if (l > 0) {
        mx /= l; mz /= l;
        const dx = mx * MOVE_SPEED * dt, dz = mz * MOVE_SPEED * dt;
        if (isWalkable(this.px + dx, this.pz)) this.px += dx;
        if (isWalkable(this.px, this.pz + dz)) this.pz += dz;
      }
      this._updateZones();
    }

    this.cam.position.set(this.px, 1.7, this.pz);
    this.cam.rotation.y = this.yaw;
    this.cam.rotation.x = this.pitch;

    if (this._core) {
      this._core.rotation.y += dt * 1.2;
      this._core.rotation.x += dt * 0.6;
      this._core.position.y = 1.9 + Math.sin(performance.now() / 500) * 0.12;
    }

    this.renderer.render(this.scene, this.cam);
  }

  _updateZones() {
    let near = null, nd = 4;
    for (const z of ZONES) {
      const d = Math.hypot(this.px - z.target[0], this.pz - z.target[1]);
      if (d < nd) { nd = d; near = z; }
    }
    const area = areaAt(this.px, this.pz);
    const p = this.px, q = this.pz;
    const coords = `${p >= 0 ? '+' : ''}${p.toFixed(1)} · ${q >= 0 ? '+' : ''}${q.toFixed(1)}`;
    const prompt = near ? { zone: near.id, name: near.name } : null;

    if (this._last.area !== area || this._last.coords !== coords || JSON.stringify(this._last.prompt) !== JSON.stringify(prompt)) {
      this._last = { area, coords, prompt };
      this.setState({ area, coords, prompt });
    }
  }

  // ---- input ----
  _onKeyDown(e) {
    if (!this.state.booted) return;
    if (e.code === 'Tab') { e.preventDefault(); this.toggleWatch(); return; }
    if (e.code === 'Escape') {
      if (this.state.panel) this.closePanel();
      else if (this.state.showWatch) this.toggleWatch();
      else {
        const nowActive = !this.state.active;
        this.setState({ active: nowActive });
        if (nowActive) this._tryLock(); else this._dropLock();
      }
      return;
    }
    if (e.code === 'KeyE' && this.state.active && this.state.prompt) {
      this.openPanel(this.state.prompt.zone);
      return;
    }
    this.keys[e.code] = true;
  }

  _onKeyUp(e) { this.keys[e.code] = false; }

  _onMouseMove(e) {
    if (!this.state.active) return;
    if (!this.pointerLocked && !this.dragging) return;
    const s = this.state.sens * 0.001;
    this.yaw -= e.movementX * s;
    this.pitch -= e.movementY * s;
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));
  }

  _onMouseDown() {
    if (this.state.active && !this.state.showWatch && !this.state.panel) this.dragging = true;
  }

  _onMouseUp() { this.dragging = false; }

  _onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.mountEl;
  }

  _tryLock() {
    try {
      const p = this.mountEl.requestPointerLock && this.mountEl.requestPointerLock();
      if (p && p.catch) p.catch(() => {});
    } catch {
      // pointer lock is best-effort
    }
  }

  _dropLock() {
    try { document.exitPointerLock(); } catch { /* noop */ }
  }

  // ---- public actions (bind these to UI) ----
  canvasClick = () => {
    if (this.state.booted && !this.state.showWatch && !this.state.panel) {
      if (!this.state.active) this.setState({ active: true });
      this._tryLock();
    }
  };

  start = () => {
    this.audio.init();
    this.setState({ booted: true, active: true });
    this._tryLock();
    this.audio.blip(660);
  };

  resume = () => {
    this.setState({ active: true });
    this._tryLock();
    this.audio.blip(520);
  };

  toggleWatch = () => {
    const open = !this.state.showWatch;
    if (open) {
      this._dropLock();
      this.audio.blip(720);
      this.setState({ showWatch: true, panel: null, active: false });
    } else {
      this.setState({ showWatch: false, active: true });
      this._tryLock();
      this.audio.blip(440);
    }
  };

  setWatchTab = (tab) => {
    this.audio.blip(600);
    this.setState({ watchTab: tab });
  };

  warp = (id) => {
    const z = ZONES.find((z) => z.id === id);
    this.px = z.target[0];
    this.pz = z.target[1];
    this.audio.blip(880);
    this.setState({ showWatch: false, active: true });
    this._tryLock();
    this._mark(id);
  };

  openPanel = (id) => {
    this._dropLock();
    this.audio.blip(680);
    this._mark(id);
    this.setState({ panel: id, active: false });
  };

  closePanel = () => {
    this.audio.blip(460);
    this.setState({ panel: null, active: true });
    this._tryLock();
  };

  _mark(id) {
    if (this.state.objectives[id]) return;
    this.audio.blip(990);
    this.setState((s) => ({ objectives: { ...s.objectives, [id]: true } }));
  }

  resetPosition = () => {
    this.px = START_POSITION.x;
    this.pz = START_POSITION.z;
    this.yaw = START_POSITION.yaw;
    this.pitch = START_POSITION.pitch;
    this.setState({ showWatch: false, active: true });
    this._tryLock();
  };

  toggleSound = () => {
    this.setState((s) => ({ soundOn: !s.soundOn }));
    this.audio.setSoundOn(this.state.soundOn);
    this.audio.blip(600);
  };

  sensUp = () => {
    this.setState((s) => ({ sens: Math.min(6, +(s.sens + 0.4).toFixed(1)) }));
    this.audio.blip(700);
  };

  sensDown = () => {
    this.setState((s) => ({ sens: Math.max(0.6, +(s.sens - 0.4).toFixed(1)) }));
    this.audio.blip(500);
  };

  get objectivesVisited() {
    return Object.values(this.state.objectives).filter(Boolean).length;
  }

  get objectivesTotal() {
    return ZONE_ORDER.length;
  }
}
