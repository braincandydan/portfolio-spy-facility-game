// Area S4 set dressing: the recovered saucer + anti-gravity rig (Hangar-1),
// element 115 containers, classified paper archives (Vault), and the SIGINT
// screens including an animated-static briefing monitor.

function lambert(THREE, c) {
  return new THREE.MeshLambertMaterial({ color: c, flatShading: true });
}

// ---------- Hangar-1: the saucer ----------

export function buildSaucer(THREE, scene, position = { x: 0, z: -32 }) {
  const group = new THREE.Group();
  group.position.set(position.x, 0, position.z);

  const hullMat = new THREE.MeshLambertMaterial({ color: 0x8a919c, flatShading: true });
  const darkMat = lambert(THREE, 0x3a4048);

  // Lower hull (inverted shallow cone)
  const lower = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 1.1, 0.8, 18), hullMat);
  lower.position.y = 2.0;
  group.add(lower);

  // Upper hull
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 3.1, 0.7, 18), hullMat);
  upper.position.y = 2.75;
  group.add(upper);

  // Dome
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    darkMat,
  );
  dome.position.y = 3.1;
  group.add(dome);

  // Rim band
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.1, 0.14, 8, 24), darkMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 2.4;
  group.add(rim);

  // Porthole lights around the rim
  const portMat = new THREE.MeshBasicMaterial({ color: 0xffb000 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const port = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), portMat);
    port.position.set(Math.cos(a) * 2.6, 2.75, Math.sin(a) * 2.6);
    group.add(port);
  }

  // Anti-gravity glow ring underneath
  const glowRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.5, 28),
    new THREE.MeshBasicMaterial({ color: 0x2fd4c6, side: THREE.DoubleSide, transparent: true, opacity: 0.65 }),
  );
  glowRing.rotation.x = -Math.PI / 2;
  glowRing.position.y = 0.06;
  group.add(glowRing);

  const gravLight = new THREE.PointLight(0x2fd4c6, 10, 14, 1.8);
  gravLight.position.y = 1.4;
  group.add(gravLight);

  // Three gravity amplifier pylons around the craft
  const pylons = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const px = Math.cos(a) * 5.2, pz = Math.sin(a) * 5.2;
    const pylon = new THREE.Group();
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 3.4, 8), darkMat);
    column.position.y = 1.7;
    pylon.add(column);
    const emitter = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x2fd4c6 }),
    );
    emitter.position.y = 3.5;
    pylon.add(emitter);
    pylon.position.set(px, 0, pz);
    group.add(pylon);
    pylons.push(emitter);
  }

  scene.add(group);

  const saucerBody = new THREE.Group();
  // move hull parts into a sub-group so the hover animation doesn't move pylons
  for (const m of [lower, upper, dome, rim]) saucerBody.add(m);
  group.add(saucerBody);
  // portholes ride with the hull
  group.children
    .filter((c) => c.geometry?.type === 'SphereGeometry' && c.material === portMat)
    .forEach((p) => saucerBody.add(p));

  return {
    group,
    animate(dt, t) {
      saucerBody.position.y = Math.sin(t / 1100) * 0.25;
      saucerBody.rotation.y += dt * 0.25;
      saucerBody.rotation.z = Math.sin(t / 1900) * 0.03;
      glowRing.scale.setScalar(1 + Math.sin(t / 300) * 0.08);
      glowRing.material.opacity = 0.5 + Math.sin(t / 300) * 0.2;
      gravLight.intensity = 10 + Math.sin(t / 300) * 3;
      for (let i = 0; i < pylons.length; i++) {
        pylons[i].material.color.setHSL(0.47, 0.7, 0.5 + Math.sin(t / 260 + i * 2.1) * 0.25);
      }
    },
  };
}

// ---------- Element 115 containers ----------

export function buildE115Crates(THREE, scene, assets = null) {
  const spots = [
    { x: -7, z: -36, s: 1.2 }, { x: -7, z: -33.5, s: 1.0 }, { x: 7.2, z: -37, s: 1.3 }, { x: 8, z: -34, s: 1.0 },
  ];
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8f52 });
  for (const spot of spots) {
    let crate = assets?.get('crate')?.clone();
    if (crate) {
      crate.scale.setScalar(spot.s);
    } else {
      crate = new THREE.Mesh(new THREE.BoxGeometry(spot.s, spot.s, spot.s), lambert(THREE, 0x3d4148));
    }
    crate.position.set(spot.x, spot.s / 2, spot.z);
    crate.rotation.y = Math.random() * 0.5;
    // glowing element-115 seam
    const seam = new THREE.Mesh(new THREE.BoxGeometry(spot.s * 1.02, 0.06, spot.s * 1.02), glowMat);
    crate.add(seam);
    scene.add(crate);
  }
}

// ---------- Vault: classified paper archives ----------

function makeFolderTexture(THREE, stamp = 'TOP SECRET') {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 48;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8a860';
  ctx.fillRect(0, 0, 64, 48);
  ctx.strokeStyle = '#8a743e';
  ctx.strokeRect(2, 2, 60, 44);
  ctx.fillStyle = '#a02020';
  ctx.font = 'bold 9px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(stamp, 32, 20);
  ctx.fillStyle = '#463a1e';
  ctx.fillText('S-4 // MJ-12', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Reading table piled with classified personnel documents — the keycard pickup
 * floats above it (see items.js). Placed in the XENO-LAB next to the cell.
 */
export function buildDocsTable(THREE, scene, position = { x: 4.5, z: 29.5 }) {
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 1.5), lambert(THREE, 0x33291f));
  table.position.set(position.x, 0.5, position.z);
  scene.add(table);

  const folderMat = new THREE.MeshLambertMaterial({ map: makeFolderTexture(THREE, 'PERSONNEL') });
  const spots = [
    { dx: -0.7, dz: -0.25, ry: 0.3 }, { dx: 0.5, dz: 0.2, ry: -0.5 }, { dx: -0.1, dz: 0.4, ry: 0.1 },
  ];
  for (const s of spots) {
    const folder = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.03, 0.45), folderMat);
    folder.position.set(position.x + s.dx, 1.03, position.z + s.dz);
    folder.rotation.y = s.ry;
    scene.add(folder);
  }

  // Loose paper stack
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.09, 0.6), lambert(THREE, 0xd8dce2));
  paper.position.set(position.x + 0.85, 1.06, position.z - 0.35);
  paper.rotation.y = 0.2;
  scene.add(paper);

  // Small desk lamp glow so the table reads from the doorway
  const lamp = new THREE.PointLight(0xffb000, 4, 8, 1.8);
  lamp.position.set(position.x, 2.2, position.z);
  scene.add(lamp);
}

/**
 * West wing REC ROOM: arcade cabinet + couch + shooting-range dressing.
 * This is the expandable "games" room unlocked by the master key.
 */
export function buildRecRoom(THREE, scene) {
  // ---- arcade cabinet (the PLAY interactable points here) ----
  const cab = new THREE.Group();
  cab.position.set(-32, 0, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.3, 2.1, 1.0), lambert(THREE, 0x27313d));
  body.position.y = 1.05;
  cab.add(body);
  const marquee = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.35, 1.05), lambert(THREE, 0x1a1d22));
  marquee.position.y = 2.25;
  cab.add(marquee);
  const marqueeGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.24),
    new THREE.MeshBasicMaterial({ color: 0xff8f52 }),
  );
  marqueeGlow.position.set(0.66, 2.25, 0);
  marqueeGlow.rotation.y = Math.PI / 2;
  cab.add(marqueeGlow);

  // Animated screen static (faces the room, +x)
  const sc = document.createElement('canvas');
  sc.width = 48; sc.height = 40;
  const sctx = sc.getContext('2d');
  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.magFilter = THREE.NearestFilter;
  screenTex.minFilter = THREE.NearestFilter;
  const drawArcade = (t) => {
    sctx.fillStyle = '#06090c';
    sctx.fillRect(0, 0, 48, 40);
    // bouncing block "attract mode"
    const bx = 8 + Math.abs(((t / 40) % 64) - 32);
    const by = 8 + Math.abs(((t / 70) % 48) - 24) * 0.5;
    sctx.fillStyle = '#2fd4c6';
    sctx.fillRect(bx, by, 6, 6);
    sctx.fillStyle = '#ffb000';
    sctx.font = 'bold 7px monospace';
    sctx.textAlign = 'center';
    sctx.fillText('INSERT COIN', 24, 34);
    screenTex.needsUpdate = true;
  };
  drawArcade(0);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.7),
    new THREE.MeshBasicMaterial({ map: screenTex }),
  );
  screen.position.set(0.66, 1.45, 0);
  screen.rotation.y = Math.PI / 2;
  cab.add(screen);
  scene.add(cab);

  // ---- couch facing the cabinet ----
  const couchMat = lambert(THREE, 0x4a3b2c);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 2.6), couchMat);
  seat.position.set(-26, 0.25, 0);
  scene.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.1, 2.6), couchMat);
  back.position.set(-25.6, 0.55, 0);
  scene.add(back);

  // ---- shooting range dressing (targets + pistol live in gun.js/items.js) ----
  const rangeMat = lambert(THREE, 0x2b3138);
  for (const z of [-6, 0, 6]) {
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.4, 0.25), rangeMat);
    stand.position.set(-36.5, 1.2, z);
    scene.add(stand);
  }
  // Range divider rail
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.0, 16), rangeMat);
  rail.position.set(-34, 0.5, 0);
  scene.add(rail);

  let acc = 0;
  return {
    animate(dt, t) {
      acc += dt;
      if (acc > 0.1) { acc = 0; drawArcade(t); }
    },
  };
}

// ---------- SIGINT: screens ----------

function makeMajesticTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0e10';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#2fd4c6';
  ctx.lineWidth = 3;
  ctx.strokeRect(6, 6, 244, 116);
  ctx.fillStyle = '#2fd4c6';
  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('MAJESTIC', 128, 42);
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#ffb000';
  ctx.fillText('EYES ONLY // MJ-12', 128, 66);
  ctx.fillStyle = '#6b7079';
  ctx.font = '10px monospace';
  ctx.fillText('S-4 SIGNALS INTELLIGENCE', 128, 92);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
}

/**
 * Big MAJESTIC wall screen + an animated-static briefing monitor.
 * Returns { animate } which cycles the static.
 */
export function buildSigintScreens(THREE, scene) {
  // MAJESTIC display on the far east wall
  const majestic = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 3),
    new THREE.MeshBasicMaterial({ map: makeMajesticTexture(THREE) }),
  );
  majestic.position.set(39.7, 2.6, 0);
  majestic.rotation.y = -Math.PI / 2;
  scene.add(majestic);

  // Briefing monitor: animated static (the "video" until a real reel is dropped in)
  const sc = document.createElement('canvas');
  sc.width = 64; sc.height = 48;
  const sctx = sc.getContext('2d');
  const staticTex = new THREE.CanvasTexture(sc);
  staticTex.magFilter = THREE.NearestFilter;
  staticTex.minFilter = THREE.NearestFilter;

  const drawStatic = () => {
    const img = sctx.createImageData(64, 48);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 160;
      img.data[i] = v * 0.7;
      img.data[i + 1] = v;
      img.data[i + 2] = v * 0.95;
      img.data[i + 3] = 255;
    }
    sctx.putImageData(img, 0, 0);
    sctx.fillStyle = 'rgba(11,14,16,0.8)';
    sctx.fillRect(0, 18, 64, 11);
    sctx.fillStyle = '#ffb000';
    sctx.font = 'bold 8px monospace';
    sctx.textAlign = 'center';
    sctx.fillText('BRIEFING', 32, 26);
    staticTex.needsUpdate = true;
  };
  drawStatic();

  const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.4, 0.3), lambert(THREE, 0x2b3138));
  stand.position.set(36, 0.7, 8.2);
  scene.add(stand);
  const monitor = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 1.5, 0.2),
    lambert(THREE, 0x1a1d22),
  );
  monitor.position.set(36, 2.0, 8.2);
  scene.add(monitor);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.25),
    new THREE.MeshBasicMaterial({ map: staticTex }),
  );
  screen.position.set(36, 2.0, 8.09);
  screen.rotation.y = Math.PI;
  scene.add(screen);

  let acc = 0;
  return {
    animate(dt) {
      acc += dt;
      if (acc > 0.12) { acc = 0; drawStatic(); }
    },
  };
}

// ---------- shared: hazard stripes + S4 signage ----------

export function makeHazardTexture(THREE) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c8a000';
  ctx.fillRect(0, 0, 64, 16);
  ctx.fillStyle = '#141619';
  for (let x = -16; x < 80; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 16);
    ctx.lineTo(x + 8, 0);
    ctx.lineTo(x + 16, 0);
    ctx.lineTo(x + 8, 16);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** Yellow/black hazard strip on the floor at each door threshold. */
export function buildHazardStrips(THREE, scene, doorDefs) {
  const tex = makeHazardTexture(THREE);
  for (const def of doorDefs) {
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(def.width, 1.0),
      new THREE.MeshBasicMaterial({ map: tex }),
    );
    strip.rotation.x = -Math.PI / 2;
    if (def.axis === 'z') strip.rotation.z = Math.PI / 2;
    strip.position.set(def.x, 0.03, def.z);
    scene.add(strip);
  }
}
