import { buildLevel } from './level.js';
import { ZONES, ZONE_ORDER, BRIEFING_POINT, isWalkable, areaAt, START_POSITION } from './zones.js';
import { ALIEN_DIALOGUE, ALIEN_SPEAKER } from './alien.js';
import { AudioEngine } from '../audio.js';
import {
  buildTargets,
  spawnMuzzleFlash, spawnTracer, spawnHitSpark, flashTarget,
} from './gun.js';
import {
  processStick, TURN_RATE, WALK_SPEED, PITCH_RECENTER,
  AIM_BOX, AIM_STICK_SPEED, AIM_EDGE_TURN, AIM_EDGE_PITCH,
} from './n64Stick.js';
import { loadAssets } from './assets.js';
import {
  ITEM_IDS, buildItems, updatePickups, nearestPickup, buildProceduralCrate,
} from './items.js';

const PITCH_LIMIT = 1.4;
const RECOIL_KICK = 0.05;
const RECOIL_DECAY = 10;
const PROXIMITY_RADIUS = 4;
const AUTO_AIM_CONE = 0.22; // rad (~12.5°) — hip-fire snaps to targets inside this cone

/**
 * Owns the Three.js scene, GoldenEye-style single-stick controls, doors,
 * gadgets, and interactive-portfolio state. UI is a pure function of `state`.
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
      hasGun: false,
      inventory: [],
      activeItem: null,
      aiming: false,
      aimCross: { x: 0, y: 0 },
      lockMsg: null,
      dialogue: null, // { speaker, lines, idx }
      err: null,
    };
    this._listeners = new Set();
    this._last = {};
    this.keys = {};
    this.px = START_POSITION.x;
    this.pz = START_POSITION.z;
    this.yaw = START_POSITION.yaw;
    this.pitch = START_POSITION.pitch;
    this._alive = false;
    this._effects = [];
    this._recoilPitch = 0;
    this._rawStick = { x: 0, y: 0 };
    this._kbStick = { x: 0, y: 0 };
    this._aiming = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
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
    window.addEventListener('resize', this._onResize);

    try {
      const THREE = await import('three');
      this.THREE = THREE;
      const W = this.mountEl.clientWidth || window.innerWidth;
      const H = this.mountEl.clientHeight || window.innerHeight;

      const scene = new THREE.Scene();
      const CONCRETE = 0x23262b;
      scene.background = new THREE.Color(CONCRETE);
      scene.fog = new THREE.Fog(CONCRETE, 13, 68);

      const cam = new THREE.PerspectiveCamera(72, W / H, 0.1, 200);
      cam.rotation.order = 'YXZ';
      cam.position.set(this.px, 1.7, this.pz);
      scene.add(cam);

      const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(1);
      renderer.setSize(Math.max(2, Math.floor(W * this.pixelation)), Math.max(2, Math.floor(H * this.pixelation)), false);
      this.mountEl.appendChild(renderer.domElement);

      this.scene = scene;
      this.cam = cam;
      this.renderer = renderer;

      // Asset registry (GLB + procedural fallbacks)
      this._assets = await loadAssets(THREE, {
        crate: (T) => buildProceduralCrate(T, 1),
      });

      const { core, doorSystem, saucer, sigint, containment, beacon } = buildLevel(THREE, scene, this._assets);
      this._core = core;
      this._doors = doorSystem;
      this._saucer = saucer;
      this._sigint = sigint;
      this._containment = containment;
      this._beacon = beacon;

      const { pickups, viewmodels } = buildItems(THREE, scene, this._assets);
      this._pickups = pickups;
      this._viewmodels = viewmodels;
      for (const vm of Object.values(viewmodels)) {
        cam.add(vm.group);
      }

      this._targets = buildTargets(THREE, scene);
      this._raycaster = new THREE.Raycaster();
      this._muzzle = null;

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

    // Keyboard emulates the N64 stick (arrows or WASD): analog ramp so holding a
    // key eases up to full deflection like pushing the real stick.
    const k = this.keys;
    const tx = ((k.ArrowRight || k.KeyD) ? 1 : 0) - ((k.ArrowLeft || k.KeyA) ? 1 : 0);
    const ty = ((k.ArrowUp || k.KeyW) ? 1 : 0) - ((k.ArrowDown || k.KeyS) ? 1 : 0);
    const ramp = Math.min(1, dt * ((tx || ty) ? 7 : 14));
    this._kbStick.x += (tx - this._kbStick.x) * ramp;
    this._kbStick.y += (ty - this._kbStick.y) * ramp;
    if (Math.abs(this._kbStick.x) < 0.02 && !tx) this._kbStick.x = 0;
    if (Math.abs(this._kbStick.y) < 0.02 && !ty) this._kbStick.y = 0;

    const stick = processStick(
      Math.max(-1, Math.min(1, this._rawStick.x + this._kbStick.x)),
      Math.max(-1, Math.min(1, this._rawStick.y + this._kbStick.y)),
    );

    if (this.state.active && this.state.booted) {
      if (this._aiming) {
        this._updateAim(dt, stick);
      } else {
        this._updateMove(dt, stick);
      }
      this._updateZones();
      this._doors?.update(dt, this.px, this.pz, this.state.inventory.includes(ITEM_IDS.KEYCARD));
    }

    this.cam.position.set(this.px, 1.7, this.pz);
    this.cam.rotation.y = this.yaw;
    this._recoilPitch *= Math.exp(-dt * RECOIL_DECAY);
    this.cam.rotation.x = this.pitch + this._recoilPitch;

    const now = performance.now();
    if (this._core) {
      this._core.rotation.y += dt * 1.2;
      this._core.rotation.x += dt * 0.6;
      this._core.position.y = 1.9 + Math.sin(now / 500) * 0.12;
    }
    this._saucer?.animate(dt, now);
    this._containment?.animate(dt, now);
    this._sigint?.animate(dt);
    if (this._beacon) this._beacon.intensity = 3 + (Math.sin(now / 620) * 0.5 + 0.5) * 7;

    if (this._pickups) updatePickups(this._pickups, dt);
    if (this._effects.length) this._effects = this._effects.filter((fx) => fx.update(dt));

    this.renderer.render(this.scene, this.cam);
  }

  _updateMove(dt, stick) {
    // Turn from stick X
    this.yaw -= stick.turn * TURN_RATE * (this.state.sens / 2.2) * dt;

    // Walk from stick Y
    if (Math.abs(stick.walk) > 0.001) {
      const f = this.yaw;
      const fx = -Math.sin(f), fz = -Math.cos(f);
      const speed = WALK_SPEED * stick.walk * dt;
      const dx = fx * speed, dz = fz * speed;
      if (isWalkable(this.px + dx, this.pz)) this.px += dx;
      if (isWalkable(this.px, this.pz + dz)) this.pz += dz;

      // Pitch auto-recenter while walking
      this.pitch *= Math.exp(-dt * PITCH_RECENTER);
    }
  }

  _updateAim(dt, stick) {
    // Stick drives crosshair inside aim box; pushing past the edge turns/pitches
    const box = AIM_BOX;
    let cx = this.state.aimCross.x + stick.turn * AIM_STICK_SPEED * dt;
    let cy = this.state.aimCross.y + stick.walk * AIM_STICK_SPEED * dt;

    if (cx > box) {
      this.yaw -= AIM_EDGE_TURN * Math.min(1, Math.abs(stick.turn)) * dt;
      cx = box;
    } else if (cx < -box) {
      this.yaw += AIM_EDGE_TURN * Math.min(1, Math.abs(stick.turn)) * dt;
      cx = -box;
    }
    if (cy > box) {
      this.pitch += AIM_EDGE_PITCH * Math.min(1, Math.abs(stick.walk)) * dt;
      cy = box;
    } else if (cy < -box) {
      this.pitch -= AIM_EDGE_PITCH * Math.min(1, Math.abs(stick.walk)) * dt;
      cy = -box;
    }
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch));

    if (this.state.aimCross.x !== cx || this.state.aimCross.y !== cy) {
      this.setState({ aimCross: { x: cx, y: cy } });
    }
  }

  _updateZones() {
    let near = null, nd = PROXIMITY_RADIUS, nearVerb = 'ACCESS';

    for (const z of ZONES) {
      const d = Math.hypot(this.px - z.target[0], this.pz - z.target[1]);
      if (d < nd) { nd = d; near = z; nearVerb = z.verb || 'ACCESS'; }
    }

    // Briefing monitor (extra interactable, not an objective)
    {
      const d = Math.hypot(this.px - BRIEFING_POINT.x, this.pz - BRIEFING_POINT.z);
      if (d < Math.min(nd, 3)) {
        nd = d;
        near = { id: BRIEFING_POINT.id, name: BRIEFING_POINT.name };
        nearVerb = BRIEFING_POINT.verb;
      }
    }

    const pickup = nearestPickup(this._pickups || [], this.px, this.pz, nd);
    if (pickup) {
      nd = Math.hypot(this.px - pickup.def.position.x, this.pz - pickup.def.position.z);
      near = { id: `item:${pickup.def.id}`, name: pickup.def.name };
      nearVerb = pickup.def.verb;
    }

    // Locked door proximity message
    let lockMsg = null;
    const locked = this._doors?.isLockedNear(this.px, this.pz);
    if (locked && !this.state.inventory.includes(ITEM_IDS.KEYCARD)) {
      lockMsg = locked.lockMsg || 'LOCKED';
    }

    const area = areaAt(this.px, this.pz);
    const coords = `${this.px >= 0 ? '+' : ''}${this.px.toFixed(1)} · ${this.pz >= 0 ? '+' : ''}${this.pz.toFixed(1)}`;
    const prompt = near ? { zone: near.id, name: near.name, verb: nearVerb } : null;

    const patch = {};
    if (this._last.area !== area) patch.area = area;
    if (this._last.coords !== coords) patch.coords = coords;
    if (JSON.stringify(this._last.prompt) !== JSON.stringify(prompt)) patch.prompt = prompt;
    if (this._last.lockMsg !== lockMsg) patch.lockMsg = lockMsg;

    if (Object.keys(patch).length) {
      this._last = { area, coords, prompt, lockMsg };
      this.setState(patch);
    }
  }

  // ---- keyboard (Esc / Tab / E shortcuts only — movement is stick) ----
  _onKeyDown(e) {
    if (!this.state.booted) return;
    if (e.code === 'Tab') { e.preventDefault(); this.toggleWatch(); return; }
    if (e.code === 'Escape') {
      if (this.state.dialogue) { this.setState({ dialogue: null }); return; }
      if (this.state.panel) this.closePanel();
      else if (this.state.showWatch) this.toggleWatch();
      else {
        this.setState({ active: !this.state.active });
      }
      return;
    }
    if (e.code === 'KeyE') {
      if (this.state.active && this.state.prompt) { this.interact(); return; }
    }
    if (e.code === 'KeyQ' || e.code === 'KeyC') {
      if (!e.repeat && this.state.active) this.cycleItem();
      return;
    }
    if (e.code === 'KeyR') {
      if (!e.repeat && this.state.active) this.setAiming(true);
      return;
    }
    if (e.code === 'KeyZ' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && this.state.active) this.shoot();
      return;
    }
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    if (e.code === 'KeyR') { this.setAiming(false); return; }
    this.keys[e.code] = false;
  }

  // ---- stick / button API (bound by n64Controls) ----
  setJoystick = (x, y) => { this._rawStick = { x, y }; };

  setAiming = (on) => {
    this._aiming = !!on;
    if (on) {
      this.setState({ aiming: true, aimCross: { x: 0, y: 0 } });
    } else {
      this.setState({ aiming: false, aimCross: { x: 0, y: 0 } });
    }
  };

  // ---- public actions ----
  canvasClick = () => {
    if (this.state.booted && !this.state.showWatch && !this.state.panel) {
      if (!this.state.active) this.setState({ active: true });
    }
  };

  start = () => {
    this.audio.init();
    this.setState({ booted: true, active: true });
    this.audio.blip(660);
  };

  resume = () => {
    this.setState({ active: true });
    this.audio.blip(520);
  };

  toggleWatch = () => {
    const open = !this.state.showWatch;
    if (open) {
      this.setAiming(false);
      this.audio.blip(720);
      this.setState({ showWatch: true, panel: null, active: false });
    } else {
      this.setState({ showWatch: false, active: true });
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
    this._mark(id);
  };

  openPanel = (id) => {
    this.setAiming(false);
    this.audio.blip(680);
    this._mark(id);
    this.setState({ panel: id, active: false });
  };

  closePanel = () => {
    this.audio.blip(460);
    this.setState({ panel: null, active: true });
  };

  interact = () => {
    // Dialogue in progress → E/USE advances it
    if (this.state.dialogue) { this.advanceDialogue(); return; }
    if (!(this.state.active && this.state.prompt)) return;
    const zone = this.state.prompt.zone;
    if (zone.startsWith('item:')) {
      this.pickupItem(zone.slice(5));
    } else if (zone === 'contact') {
      this.startDialogue();
    } else {
      this.openPanel(zone);
    }
  };

  startDialogue = () => {
    this.setAiming(false);
    this.audio.blip(340);
    this.setState({ dialogue: { speaker: ALIEN_SPEAKER, lines: ALIEN_DIALOGUE, idx: 0 } });
  };

  advanceDialogue = () => {
    const d = this.state.dialogue;
    if (!d) return;
    if (d.idx + 1 < d.lines.length) {
      this.audio.blip(420 + d.idx * 40);
      this.setState({ dialogue: { ...d, idx: d.idx + 1 } });
    } else {
      // The alien opens the secure channels for you
      this.setState({ dialogue: null });
      this.openPanel('contact');
    }
  };

  pickupItem = (id) => {
    if (this.state.inventory.includes(id)) return;
    const pickup = (this._pickups || []).find((p) => p.def.id === id);
    if (pickup?.mesh) {
      this.scene.remove(pickup.mesh);
      pickup.mesh.traverse((o) => {
        o.geometry?.dispose();
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
        else o.material?.dispose?.();
      });
    }
    const inventory = [...this.state.inventory, id];
    this.audio.blip(820);
    setTimeout(() => this.audio.blip(1200), 90);

    // Equip newly picked item
    this.setState({
      inventory,
      activeItem: id,
      hasGun: inventory.includes(ITEM_IDS.PISTOL),
    });
    this._showViewmodel(id);

    if (id === ITEM_IDS.KEYCARD) {
      this._doors?.unlock('w-outer');
      this.audio.blip(990);
    }
  };

  cycleItem = () => {
    const inv = this.state.inventory;
    if (!inv.length) return;
    const idx = inv.indexOf(this.state.activeItem);
    const next = inv[(idx + 1) % inv.length];
    this.setState({ activeItem: next });
    this._showViewmodel(next);
    this.audio.blip(700);
  };

  _showViewmodel(id) {
    for (const [vid, vm] of Object.entries(this._viewmodels || {})) {
      vm.group.visible = vid === id;
    }
    this._muzzle = this._viewmodels?.[id]?.muzzle || null;
  }

  shoot = () => {
    const s = this.state;
    if (!(s.active && !s.showWatch && !s.panel)) return;

    const item = s.activeItem;
    if (item === ITEM_IDS.CAMERA) {
      this._useCamera();
      return;
    }
    if (item === ITEM_IDS.KEYCARD) {
      this.audio.blip(300);
      return;
    }
    if (item !== ITEM_IDS.PISTOL) return;

    const THREE = this.THREE;
    const ndc = this._aiming
      ? { x: s.aimCross.x, y: s.aimCross.y }
      : { x: 0, y: 0 };

    let hitPoint = null;
    let hitObj = null;

    if (this._aiming) {
      this._raycaster.setFromCamera(ndc, this.cam);
      const hits = this._raycaster.intersectObjects(this.scene.children, true);
      if (hits.length) { hitPoint = hits[0].point; hitObj = hits[0].object; }
    } else {
      // GoldenEye hip-fire auto-aim: snap the shot to the best target inside a
      // view cone (handles both horizontal and vertical offset), if it has
      // line of sight. Otherwise fall back to the screen-center ray.
      const camPos = new THREE.Vector3();
      this.cam.getWorldPosition(camPos);
      const fwd = new THREE.Vector3();
      this.cam.getWorldDirection(fwd);

      let best = null;
      let bestAng = AUTO_AIM_CONE;
      for (const t of this._targets || []) {
        if (!t.parent) continue;
        const dir = t.getWorldPosition(new THREE.Vector3()).sub(camPos);
        const dist = dir.length();
        if (dist > 45) continue;
        dir.normalize();
        const ang = fwd.angleTo(dir);
        if (ang < bestAng) { bestAng = ang; best = { mesh: t, dir }; }
      }

      if (best) {
        this._raycaster.set(camPos, best.dir);
        const hits = this._raycaster.intersectObjects(this.scene.children, true);
        if (hits.length && hits[0].object.userData.isTarget) {
          hitPoint = hits[0].point;
          hitObj = hits[0].object;
        }
      }

      if (!hitPoint) {
        this._raycaster.setFromCamera({ x: 0, y: 0 }, this.cam);
        const hits = this._raycaster.intersectObjects(this.scene.children, true);
        if (hits.length) { hitPoint = hits[0].point; hitObj = hits[0].object; }
      }
    }

    const muzzleWorld = new THREE.Vector3();
    if (this._muzzle) this._muzzle.getWorldPosition(muzzleWorld);
    else this.cam.getWorldPosition(muzzleWorld);

    if (!hitPoint) {
      const dir = new THREE.Vector3();
      this.cam.getWorldDirection(dir);
      hitPoint = muzzleWorld.clone().add(dir.multiplyScalar(60));
    } else {
      this._effects.push(spawnHitSpark(THREE, this.scene, hitPoint));
      if (hitObj?.userData.isTarget) {
        this._effects.push(flashTarget(THREE, hitObj));
        this.audio.blip(1300);
      }
    }

    this._effects.push(spawnMuzzleFlash(THREE, this.scene, muzzleWorld));
    this._effects.push(spawnTracer(THREE, this.scene, muzzleWorld, hitPoint));
    this._recoilPitch = Math.min(0.14, this._recoilPitch + RECOIL_KICK);
    this.audio.blip(180);
  };

  _useCamera() {
    // Photograph nearest intel zone → open its panel with a flash
    let near = null, nd = PROXIMITY_RADIUS + 2;
    for (const z of ZONES) {
      const d = Math.hypot(this.px - z.target[0], this.pz - z.target[1]);
      if (d < nd) { nd = d; near = z; }
    }
    this.audio.blip(1400);

    if (this.THREE && this.scene) {
      const THREE = this.THREE;
      const scene = this.scene;
      const flash = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }),
      );
      const pos = new THREE.Vector3();
      this.cam.getWorldPosition(pos);
      const dir = new THREE.Vector3();
      this.cam.getWorldDirection(dir);
      flash.position.copy(pos).add(dir.multiplyScalar(0.8));
      flash.raycast = () => {};
      scene.add(flash);
      let t = 0;
      this._effects.push({
        update(dt) {
          t += dt;
          flash.material.opacity = Math.max(0, 0.9 * (1 - t / 0.15));
          flash.scale.setScalar(1 + t * 8);
          if (t >= 0.15) {
            scene.remove(flash);
            flash.geometry.dispose();
            flash.material.dispose();
            return false;
          }
          return true;
        },
      });
    }
    if (near) {
      setTimeout(() => this.openPanel(near.id), 180);
    }
  }

  _mark(id) {
    if (!(id in this.state.objectives)) return; // extras (briefing) aren't objectives
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
