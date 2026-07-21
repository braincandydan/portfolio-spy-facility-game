// Builds the facility geometry into a Three.js scene. Pure function of (THREE, scene) —
// no engine state lives here, so level layout can be edited without touching Game.js.

export function makeLabelTexture(THREE, text, fg) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0e10';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, 248, 56);
  ctx.fillStyle = fg;
  ctx.font = 'bold 34px "Share Tech Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

export function buildLevel(THREE, scene) {
  const mat = (c) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x1a1d21));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), mat(0x141619));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 5;
  scene.add(ceil);

  const grid = new THREE.GridHelper(140, 70, 0x2a2e34, 0x1f2226);
  grid.position.y = 0.02;
  scene.add(grid);

  const wallMat = mat(0x30343b);
  const wallMat2 = mat(0x282c32);
  const addWall = (cx, cz, w, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 5, d), Math.random() > 0.5 ? wallMat : wallMat2);
    m.position.set(cx, 2.5, cz);
    scene.add(m);
  };

  [-8, 8].forEach((sz) => { addWall(-5.5, sz, 5, 0.5); addWall(5.5, sz, 5, 0.5); });
  [-8, 8].forEach((sx) => { addWall(sx, -5.5, 0.5, 5); addWall(sx, 5.5, 0.5, 5); });

  const zWing = (s) => {
    const iz = s * 20, oz = s * 40;
    addWall(-6.5, iz, 7, 0.5); addWall(6.5, iz, 7, 0.5);
    addWall(0, oz, 20, 0.5);
    addWall(-10, s * 30, 0.5, 20); addWall(10, s * 30, 0.5, 20);
    addWall(-3, s * 14, 0.5, 12); addWall(3, s * 14, 0.5, 12);
  };
  const xWing = (s) => {
    const ix = s * 20, ox = s * 40;
    addWall(ix, -6.5, 0.5, 7); addWall(ix, 6.5, 0.5, 7);
    addWall(ox, 0, 0.5, 20);
    addWall(s * 30, -10, 20, 0.5); addWall(s * 30, 10, 20, 0.5);
    addWall(s * 14, -3, 12, 0.5); addWall(s * 14, 3, 12, 0.5);
  };
  zWing(-1); zWing(1); xWing(1); xWing(-1);

  scene.add(new THREE.AmbientLight(0x3a4048, 0.9));
  scene.add(new THREE.HemisphereLight(0x8fb0c0, 0x1a1d21, 0.4));

  const lamp = (x, z, col, intensity) => {
    const p = new THREE.PointLight(col, intensity, 34, 1.6);
    p.position.set(x, 4.4, z);
    scene.add(p);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 1.6), new THREE.MeshBasicMaterial({ color: col }));
    b.position.set(x, 4.85, z);
    scene.add(b);
  };
  lamp(0, 0, 0x2fd4c6, 14);
  lamp(0, -30, 0xffb000, 16); lamp(0, 30, 0x2fd4c6, 16); lamp(30, 0, 0xffb000, 16); lamp(-30, 0, 0x2fd4c6, 16);
  lamp(0, -13, 0x2fd4c6, 8); lamp(0, 13, 0x2fd4c6, 8); lamp(13, 0, 0x2fd4c6, 8); lamp(-13, 0, 0x2fd4c6, 8);

  const sign = (x, y, z, text, ry, col) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: makeLabelTexture(THREE, text, col), transparent: false }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    scene.add(m);
  };
  sign(0, 3.4, -20.2, 'ARCHIVE', 0, '#ffb000');
  sign(0, 3.4, 20.2, 'COMMS', Math.PI, '#2fd4c6');
  sign(20.2, 3.4, 0, 'ARMORY', -Math.PI / 2, '#ffb000');
  sign(-20.2, 3.4, 0, 'RECORDS', Math.PI / 2, '#2fd4c6');

  // PROJECTS (N, z-): stacked crates
  for (let i = 0; i < 7; i++) {
    const s = 1.4 + Math.random() * 0.5;
    const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(0x3a3f2e));
    c.position.set(-6 + (i % 4) * 3.4, s / 2, -34 - Math.floor(i / 4) * 3.2);
    c.rotation.y = Math.random() * 0.3;
    scene.add(c);
  }

  // SKILLS (E, x+): control consoles
  for (let i = 0; i < 4; i++) {
    const con = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 1), mat(0x2b3138));
    con.position.set(34, 0.7, -6 + i * 4);
    scene.add(con);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshBasicMaterial({ color: 0x2fd4c6 }));
    scr.position.set(33.4, 1.2, -6 + i * 4);
    scr.rotation.y = Math.PI / 2;
    scene.add(scr);
  }

  // CONTACT (S, z+): comms tower / dish
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.9, 4, 6), mat(0x2b3138));
  tower.position.set(0, 2, 34);
  scene.add(tower);
  const dish = new THREE.Mesh(
    new THREE.SphereGeometry(1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x3a4048, flatShading: true, side: THREE.DoubleSide }),
  );
  dish.position.set(0, 4, 34);
  dish.rotation.x = Math.PI;
  scene.add(dish);

  // ABOUT (W, x-): desk
  const desk = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 1.4), mat(0x33291f));
  desk.position.set(-32, 0.55, 0);
  scene.add(desk);

  // RESUME (atrium): glowing data pedestal
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.2, 8), mat(0x2b3138));
  ped.position.set(0, 0.6, 3);
  scene.add(ped);
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), new THREE.MeshBasicMaterial({ color: 0x2fd4c6, wireframe: true }));
  core.position.set(0, 1.9, 3);
  scene.add(core);

  return { core };
}
