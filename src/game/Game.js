import { buildLevel } from './level.js';
import {
  ZONES, ZONE_ORDER, WARP_TARGETS, BRIEFING_POINT, ARCADE_POINT,
  isWalkable, areaAt, START_POSITION,
} from './zones.js';
import { ALIEN_DIALOGUE, ALIEN_SPEAKER } from './alien.js';
import { AudioEngine } from '../audio.js';
import {
  buildTargets,
  spawnMuzzleFlash, spawnTracer, spawnHitSpark, flashTarget,
} from './gun.js';
import {
  processStick, TURN_RATE, WALK_SPEED, PITCH_RECENTER,
} from './n64Stick.js';
import { loadAssets } from './assets.js';
import {
  ITEM_IDS, buildItems, updatePickups, nearestPickup, buildProceduralCrate, buildCoffeeCup,
} from './items.js';

const RECOIL_KICK = 0.05;
const RECOIL_DECAY = 10;
const PROXIMITY_RADIUS = 4;
const AUTO_AIM_CONE = 0.09; // rad — hip-fire snaps to shootable targets
const GUIDE_AIM_ENABLED = false; // soft camera auto-pull toward interactables — disabled, fights manual aim
const GUIDE_AIM_RANGE = 12; // soft look-at pull toward nearby interactables
const GUIDE_AIM_RATE = 1.8; // rad/s max correction

// Caffeine: drains over ~3 minutes; below the LOW threshold you slow down.
const CAFFEINE_DRAIN = 100 / 180;
const CAFFEINE_LOW = 30;
const COFFEE_REFILL = 45;
const COFFEE_RESPAWN_MS = 45000;
const COFFEE_SPOTS = [
  { x: 2.5, z: -3 },   // atrium
  { x: -13, z: 0 },    // west corridor
  { x: 0, z: 13 },     // south corridor
  { x: 34, z: 6 },     // SIGINT lab
  { x: -6, z: -30 },   // hangar
];
const GUIDE_ARROWS = ['↑', '↖', '←', '↙', '↓', '↘', '→', '↗'];

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
      lockMsg: null,
      dialogue: null, // { speaker, lines, idx }
      caffeine: 100,
      guide: null, // { name, plain, arrow, dist } → next unvisited objective
      err: null,
    };
    this._caff = 100;
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
    this._ventOpened = false;

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

      const { core, doorSystem, saucer, sigint, containment, beacon, vent, recRoom } = buildLevel(THREE, scene, this._assets);
      this._core = core;
      this._doors = doorSystem;
      this._saucer = saucer;
      this._sigint = sigint;
      this._containment = containment;
      this._beacon = beacon;
      this._vent = vent;
      this._recRoom = recRoom;

      const { pickups, viewmodels } = buildItems(THREE, scene, this._assets);
      this._pickups = pickups;
      this._viewmodels = viewmodels;
      for (const vm of Object.values(viewmodels)) {
        vm.group.userData.basePos = vm.group.position.clone();
        cam.add(vm.group);
      }
      this._layoutViewmodels();

      this._targets = buildTargets(THREE, scene);
      this._raycaster = new THREE.Raycaster();
      this._muzzle = null;

      // Coffee stations
      this._coffees = COFFEE_SPOTS.map((spot) => {
        const mesh = buildCoffeeCup(THREE);
        mesh.position.set(spot.x, 1.0, spot.z);
        scene.add(mesh);
        return { spot, mesh, active: true, respawnAt: 0 };
      });

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
    this._layoutViewmodels();
  }

  /**
   * Portrait phones have a much narrower horizontal FOV — the default viewmodel
   * offset (x=0.32) lands off-screen. Pull it toward center on narrow aspects.
   */
  _layoutViewmodels() {
    if (!this._viewmodels || !this.cam) return;
    const aspect = this.cam.aspect || 1;
    const xScale = aspect < 0.95 ? 0.38 : (aspect < 1.4 ? 0.7 : 1);
    for (const vm of Object.values(this._viewmodels)) {
      const base = vm.group.userData.basePos;
      if (!base) continue;
      vm.group.position.set(base.x * xScale, base.y, base.z);
    }
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

    if (this.state.active && this.state.booted && !this.state.dialogue) {
      this._updateMove(dt, stick);
      this._updateGuideAim(dt, stick);
      this._updateZones();
      this._updateCaffeine(dt);
      this._doors?.update(dt, this.px, this.pz);
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
    this._vent?.update(dt);
    this._recRoom?.animate(dt, now);
    if (this._beacon) this._beacon.intensity = 3 + (Math.sin(now / 620) * 0.5 + 0.5) * 7;

    if (this._pickups) updatePickups(this._pickups, dt);
    if (this._effects.length) this._effects = this._effects.filter((fx) => fx.update(dt));

    this.renderer.render(this.scene, this.cam);
  }

  _updateMove(dt, stick) {
    // Turn from stick X
    this.yaw -= stick.turn * TURN_RATE * (this.state.sens / 2.2) * dt;

    // Walk from stick Y — under-caffeinated operatives are slow
    if (Math.abs(stick.walk) > 0.001) {
      const caffFactor = 0.6 + 0.4 * Math.min(1, this._caff / CAFFEINE_LOW);
      const f = this.yaw;
      const fx = -Math.sin(f), fz = -Math.cos(f);
      const speed = WALK_SPEED * caffFactor * stick.walk * dt;
      const dx = fx * speed, dz = fz * speed;
      if (isWalkable(this.px + dx, this.pz)) this.px += dx;
      if (isWalkable(this.px, this.pz + dz)) this.pz += dz;

      // Pitch auto-recenter while walking
      this.pitch *= Math.exp(-dt * PITCH_RECENTER);
    }
  }

  _updateCaffeine(dt) {
    this._caff = Math.max(0, this._caff - CAFFEINE_DRAIN * dt);

    const now = performance.now();
    for (const c of this._coffees || []) {
      if (!c.active) {
        if (now >= c.respawnAt) { c.active = true; c.mesh.visible = true; }
        continue;
      }
      // idle animation
      c.mesh.position.y = 1.0 + Math.sin(now / 500 + c.spot.x) * 0.1;
      c.mesh.rotation.y += dt * 1.2;
      if (c.mesh.userData.steam) c.mesh.userData.steam.rotation.y += dt * 2.5;
      // walk-over pickup
      if (Math.hypot(this.px - c.spot.x, this.pz - c.spot.z) < 1.4) {
        c.active = false;
        c.mesh.visible = false;
        c.respawnAt = now + COFFEE_RESPAWN_MS;
        this._caff = Math.min(100, this._caff + COFFEE_REFILL);
        this.audio.blip(880);
        setTimeout(() => this.audio.blip(1100), 80);
      }
    }

    const rounded = Math.round(this._caff);
    if (rounded !== this.state.caffeine) this.setState({ caffeine: rounded });
  }

  /** Soft camera pull toward nearby interactables so the stick "finds" objects. */
  _updateGuideAim(dt, stick) {
    if (!GUIDE_AIM_ENABLED) return;
    // Don't fight a strong turn input — only nudge when the player is mostly walking.
    if (Math.abs(stick.turn) > 0.45) return;

    const target = this._nearestGuidePoint();
    if (!target) return;
    const dist = Math.hypot(this.px - target.x, this.pz - target.z);
    if (dist < 0.8 || dist > GUIDE_AIM_RANGE) return;

    const yawTo = Math.atan2(-(target.x - this.px), -(target.z - this.pz));
    let rel = yawTo - this.yaw;
    while (rel > Math.PI) rel -= Math.PI * 2;
    while (rel < -Math.PI) rel += Math.PI * 2;

    // Stronger pull when close / looking away; fade when nearly facing it.
    const strength = (1 - dist / GUIDE_AIM_RANGE) * (0.35 + Math.min(1, Math.abs(rel) / 0.9));
    const maxStep = GUIDE_AIM_RATE * strength * dt;
    this.yaw += Math.max(-maxStep, Math.min(maxStep, rel));
  }

  _nearestGuidePoint() {
    let best = null;
    let bd = GUIDE_AIM_RANGE;
    for (const z of ZONES) {
      const d = Math.hypot(this.px - z.target[0], this.pz - z.target[1]);
      if (d < bd) { bd = d; best = { x: z.target[0], z: z.target[1] }; }
    }
    for (const p of this._pickups || []) {
      if (!p.mesh?.parent) continue;
      const d = Math.hypot(this.px - p.def.position.x, this.pz - p.def.position.z);
      if (d < bd) { bd = d; best = { x: p.def.position.x, z: p.def.position.z }; }
    }
    {
      const d = Math.hypot(this.px - BRIEFING_POINT.x, this.pz - BRIEFING_POINT.z);
      if (d < bd) { bd = d; best = { x: BRIEFING_POINT.x, z: BRIEFING_POINT.z }; }
    }
    if (this.state.inventory.includes(ITEM_IDS.MASTERKEY) || this._doors?.doors?.some((d) => d.def.id === 'w-inner' && d.unlocked)) {
      const d = Math.hypot(this.px - ARCADE_POINT.x, this.pz - ARCADE_POINT.z);
      if (d < bd) best = { x: ARCADE_POINT.x, z: ARCADE_POINT.z };
    }
    return best;
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

    // Arcade cabinet in the REC ROOM
    {
      const d = Math.hypot(this.px - ARCADE_POINT.x, this.pz - ARCADE_POINT.z);
      if (d < Math.min(nd, 3)) {
        nd = d;
        near = { id: ARCADE_POINT.id, name: ARCADE_POINT.name };
        nearVerb = ARCADE_POINT.verb;
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
    if (locked) lockMsg = locked.lockMsg || 'LOCKED';

    const area = areaAt(this.px, this.pz);
    const coords = `${this.px >= 0 ? '+' : ''}${this.px.toFixed(1)} · ${this.pz >= 0 ? '+' : ''}${this.pz.toFixed(1)}`;
    const prompt = near
      ? { zone: near.id, name: near.plain ? `${near.name} · ${near.plain}` : near.name, verb: nearVerb }
      : null;

    // Guide: next step in the progression (keycard unlock gates Hangar-1)
    let guide = null;
    {
      let plain = null;
      let tgt = null;
      if (!this.state.objectives.contact) {
        plain = 'CONTACT ME';
        tgt = WARP_TARGETS.contact;
      } else if (!this.state.inventory.includes(ITEM_IDS.KEYCARD)) {
        plain = 'KEYCARD + DOSSIER';
        tgt = WARP_TARGETS.about;
      } else if (!this.state.objectives.projects) {
        plain = 'MY PROJECTS';
        tgt = WARP_TARGETS.projects;
      } else if (!this.state.objectives.skills) {
        plain = this._ventOpened ? 'MY SKILLS' : 'VENT → SIGINT';
        tgt = this._ventOpened ? WARP_TARGETS.skills : [10, -30];
      } else if (!this.state.inventory.includes(ITEM_IDS.MASTERKEY)) {
        plain = 'MASTER KEY';
        tgt = [34, 4];
      } else if (!this.state.objectives.resume) {
        plain = 'MY RESUME';
        tgt = WARP_TARGETS.resume;
      }
      if (tgt && plain) {
        const bd = Math.hypot(this.px - tgt[0], this.pz - tgt[1]);
        const yawTo = Math.atan2(-(tgt[0] - this.px), -(tgt[1] - this.pz));
        let rel = yawTo - this.yaw;
        while (rel > Math.PI) rel -= Math.PI * 2;
        while (rel < -Math.PI) rel += Math.PI * 2;
        const idx = ((Math.round(rel / (Math.PI / 4)) % 8) + 8) % 8;
        guide = { plain, arrow: GUIDE_ARROWS[idx], dist: Math.round(bd) };
      }
    }

    const patch = {};
    if (this._last.area !== area) patch.area = area;
    if (this._last.coords !== coords) patch.coords = coords;
    if (JSON.stringify(this._last.prompt) !== JSON.stringify(prompt)) patch.prompt = prompt;
    if (this._last.lockMsg !== lockMsg) patch.lockMsg = lockMsg;
    if (JSON.stringify(this._last.guide) !== JSON.stringify(guide)) patch.guide = guide;

    if (Object.keys(patch).length) {
      this._last = { area, coords, prompt, lockMsg, guide };
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
      if (this.state.dialogue || (this.state.active && this.state.prompt)) {
        this.interact();
        return;
      }
    }
    if (e.code === 'KeyQ' || e.code === 'KeyC') {
      if (!e.repeat && this.state.active && !this.state.dialogue) this.cycleItem();
      return;
    }
    if (e.code === 'KeyZ' || e.code === 'Space') {
      e.preventDefault();
      if (!e.repeat && this.state.active && !this.state.dialogue) this.shoot();
      return;
    }
    this.keys[e.code] = true;
  }

  _onKeyUp(e) {
    this.keys[e.code] = false;
  }

  // ---- stick / button API (bound by n64Controls) ----
  setJoystick = (x, y) => { this._rawStick = { x, y }; };

  // ---- public actions ----
  canvasClick = () => {
    if (this.state.booted && !this.state.showWatch && !this.state.panel && !this.state.dialogue) {
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
      this.audio.blip(720);
      this.setState({ showWatch: true, panel: null, dialogue: null, active: false });
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
    this.audio.blip(680);
    this._mark(id);
    // Viewing projects unseals the maintenance vent into SIGINT
    if (id === 'projects') this._openVent();
    // Reading the dossier / accessing the archive hands over the matching key
    if (id === 'about') this.grantItem(ITEM_IDS.KEYCARD);
    if (id === 'skills') this.grantItem(ITEM_IDS.MASTERKEY);
    this.setState({ panel: id, dialogue: null, active: false });
  };

  closePanel = () => {
    this.audio.blip(460);
    this.setState({ panel: null, active: true });
  };

  interact = () => {
    // Dialogue in progress → E / tap advances it
    if (this.state.dialogue) { this.advanceDialogue(); return; }
    if (!(this.state.active && this.state.prompt)) return;
    const zone = this.state.prompt.zone;
    if (zone.startsWith('item:')) {
      this.pickupItem(zone.slice(5));
    } else if (zone === 'contact') {
      this.startDialogue();
    } else if (zone === 'arcade') {
      this.openPanel('arcade');
    } else {
      this.openPanel(zone);
    }
  };

  startDialogue = () => {
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
      // Alien hands over contact channels early — then points you at the dossier
      this.setState({ dialogue: null });
      this.openPanel('contact');
    }
  };

  // Grants an item regardless of whether it has a world pickup mesh — used both
  // for physical pickups (camera, pistol) and for items handed over by reading
  // a document / accessing a terminal (keycard, master key).
  grantItem = (id) => {
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

    // Equip newly granted item
    this.setState({
      inventory,
      activeItem: id,
      hasGun: inventory.includes(ITEM_IDS.PISTOL),
    });
    this._showViewmodel(id);

    if (id === ITEM_IDS.KEYCARD) {
      this._doors?.unlockByKey(ITEM_IDS.KEYCARD);
      this.audio.blip(990);
    }
    if (id === ITEM_IDS.MASTERKEY) {
      this._doors?.unlockByKey(ITEM_IDS.MASTERKEY);
      this.audio.blip(990);
      setTimeout(() => this.audio.blip(660), 120);
    }
  };

  pickupItem = (id) => this.grantItem(id);

  _openVent() {
    if (this._ventOpened) return;
    this._ventOpened = true;
    this._vent?.open();
    this.audio.blip(540);
    setTimeout(() => this.audio.blip(780), 100);
  }

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
    if (!(s.active && !s.showWatch && !s.panel && !s.dialogue)) return;

    const item = s.activeItem;
    if (item === ITEM_IDS.CAMERA) {
      this._useCamera();
      return;
    }
    if (item === ITEM_IDS.KEYCARD || item === ITEM_IDS.MASTERKEY) {
      this.audio.blip(300);
      return;
    }
    if (item !== ITEM_IDS.PISTOL) return;

    const THREE = this.THREE;
    let hitPoint = null;
    let hitObj = null;

    // Auto-aim: snap the shot to the best target inside a view cone, else center ray.
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
      if (dist > 15) continue;
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
