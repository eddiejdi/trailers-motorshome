export default class Body {
  constructor(THREE, M, { BODY_W, Lt, L, W, Hc, Hint, wth, CHASSIS_Y, FLOOR_Y, roofY, roofTop, roofFlatStart, roofFlatEnd, zRoofFront, mzWallY0, mzFloorH }) {
    this.THREE = THREE;
    this.M = M;
    this.BODY_W = BODY_W;
    this.Lt = Lt;
    this.L = L;
    this.W = W;
    this.Hc = Hc;
    this.Hint = Hint;
    this.wth = wth;
    this.CHASSIS_Y = CHASSIS_Y;
    this.FLOOR_Y = FLOOR_Y;
    this.roofY = roofY;
    this.roofTop = roofTop;
    this.roofFlatStart = roofFlatStart;
    this.roofFlatEnd = roofFlatEnd;
    this.zRoofFront = zRoofFront;
    this.mzWallY0 = mzWallY0;
    this.mzFloorH = mzFloorH;
    this.wallGroup = null;
    this.wallsExt = null;
    this.backWallGroup = null;
    this.frontWallGroup = null;
    this.frontMzGroup = null;
    this.ribGroup = null;
    this.windowMeshes = [];
  }

  wall(w, h, d, mat) {
    const { THREE } = this;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  endWall(width, yBottom, thickness, material, zPos, segs, yCap) {
    const { THREE, roofTop } = this;
    const verts = [], idx = [], uvs = [];
    const halfW = width / 2;
    for (let iz = 0; iz <= 1; iz++) {
      const zLocal = (iz - 0.5) * thickness;
      const zWorld = zPos + zLocal;
      const hRoof = roofTop(zWorld);
      const h = yCap != null ? Math.min(yCap, hRoof) : hRoof;
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = -halfW + t * width;
        verts.push(x, yBottom, zWorld, x, h, zWorld);
        uvs.push(t, iz * 0.5, t, 0.5 + iz * 0.5);
      }
    }
    const stride = (segs + 1) * 2;
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      const b = a + 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
      const a2 = stride + a, b2 = stride + b;
      idx.push(a2, a2 + 1, b2, a2 + 1, b2 + 1, b2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

  endWallRange(x0, x1, yBottom, thickness, material, zPos, segs, yCap) {
    const { THREE, roofTop } = this;
    const verts = [], idx = [], uvs = [];
    const width = x1 - x0;
    if (width < 0.02) return new THREE.Group();
    for (let iz = 0; iz <= 1; iz++) {
      const zLocal = (iz - 0.5) * thickness;
      const zWorld = zPos + zLocal;
      const hRoof = roofTop(zWorld);
      const h = Math.max(yBottom + 0.02, yCap != null ? Math.min(yCap, hRoof) : hRoof);
      for (let i = 0; i <= segs; i++) {
        const t = i / segs;
        const x = x0 + t * width;
        verts.push(x, yBottom, zWorld, x, h, zWorld);
        uvs.push(t, iz * 0.5, t, 0.5 + iz * 0.5);
      }
    }
    const stride = (segs + 1) * 2;
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      const b = a + 2;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
      const a2 = stride + a, b2 = stride + b;
      if (verts.length / 3 > stride) idx.push(a2, a2 + 1, b2, a2 + 1, b2 + 1, b2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, material);
  }

   sideWall(xPos, thickness, yBottom, material, z0, z1, segs, opening) {
     const { THREE, roofTop } = this;
     const verts = [], idx = [], uvs = [];
     const xInner = xPos, xOuter = xPos + thickness;
     const openings = !opening ? [] : (Array.isArray(opening) ? opening : [opening]);
     const zs = [];
     for (let i = 0; i <= segs; i++) zs.push(z0 + (i / segs) * (z1 - z0));
     openings.forEach((o) => { zs.push(o.z0, o.z1); });
     zs.sort((a, b) => a - b);
     const uniq = [];
     zs.forEach((z) => {
       if (!uniq.length || Math.abs(uniq[uniq.length - 1] - z) > 1e-5) uniq.push(z);
     });
     const bands = (z) => {
       const h = roofTop(z);
       const y0 = Math.min(yBottom, Math.max(0, h - 0.02));
      const cuts = [];
      openings.forEach((o) => {
        if (z > o.z0 + 1e-4 && z < o.z1 - 1e-4) {
          cuts.push([Math.max(y0, o.y0), Math.min(h, o.y1)]);
        }
      });
      if (!cuts.length) return [[y0, h]];
      cuts.sort((a, b) => a[0] - b[0]);
      const out = [];
      let cursor = y0;
      cuts.forEach(([c0, c1]) => {
        if (c0 - cursor > 0.008) out.push([cursor, c0]);
        cursor = Math.max(cursor, c1);
      });
      if (h - cursor > 0.008) out.push([cursor, h]);
      return out.length ? out : [[y0, h]];
    };
    for (let i = 0; i < uniq.length - 1; i++) {
      const za = uniq[i], zb = uniq[i + 1];
      const mid = (za + zb) / 2;
      bands(mid).forEach(([ya, yb]) => {
        const ha = Math.min(yb, roofTop(za));
        const hb = Math.min(yb, roofTop(zb));
        const base = verts.length / 3;
        verts.push(xInner, ya, za, xOuter, ya, za, xOuter, ha, za, xInner, ha, za);
        verts.push(xInner, ya, zb, xOuter, ya, zb, xOuter, hb, zb, xInner, hb, zb);
        const t0 = (za - z0) / Math.max(1e-6, z1 - z0);
        const t1 = (zb - z0) / Math.max(1e-6, z1 - z0);
        uvs.push(0, t0, 1, t0, 1, t0, 0, t0, 0, t1, 1, t1, 1, t1, 0, t1);
        const b = base, c = base + 4;
        idx.push(b, c, b + 3, c, c + 3, b + 3);
        idx.push(b + 1, b + 2, c + 1, c + 1, b + 2, c + 2);
        idx.push(b + 3, c + 3, b + 2, c + 3, c + 2, b + 2);
        idx.push(b, b + 1, c, c, b + 1, c + 1);
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  addCorrugatedSide(ribGroup, xWall, outSign, z0, z1, yMin, yMax) {
    const { THREE, roofTop } = this;
    const ribPitch = 0.085;
    const ribAmp = 0.010;
    const zSegs = 40;
    const ySegs = 36;
    const verts = [], idx = [], uvs = [];
    const cols = ySegs + 1;
    for (let iz = 0; iz <= zSegs; iz++) {
      const z = z0 + (iz / zSegs) * (z1 - z0);
      const hRoof = roofTop(z);
      const h = yMax != null ? Math.min(yMax, hRoof) : hRoof;
      const y0 = Math.min(yMin, h - 0.02);
      for (let iy = 0; iy <= ySegs; iy++) {
        const y = y0 + (iy / ySegs) * (h - y0);
        const wave = 0.5 + 0.5 * Math.cos((y / ribPitch) * Math.PI * 2);
        const x = xWall + outSign * (0.006 + ribAmp * wave);
        verts.push(x, y, z);
        uvs.push(iz / zSegs, iy / ySegs);
      }
    }
    for (let iz = 0; iz < zSegs; iz++) {
      for (let iy = 0; iy < ySegs; iy++) {
        const a = iz * cols + iy;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        if (outSign > 0) idx.push(a, c, b, b, c, d);
        else idx.push(a, b, c, b, d, c);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, this.M.aluRib);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    ribGroup.add(mesh);
  }

  addSideSiding(ribGroup, xWall, sign, zA, zB, cuts) {
    const zs = [zA];
    cuts.forEach((c) => { zs.push(c.z0, c.z1); });
    zs.push(zB);
    zs.sort((a, b) => a - b);
    for (let i = 0; i < zs.length - 1; i++) {
      const a = zs[i], b = zs[i + 1];
      if (b - a < 0.02) continue;
      const mid = (a + b) / 2;
      const hit = cuts.find((c) => mid > c.z0 && mid < c.z1);
      if (hit) {
        if (hit.y0 > 0.02) this.addCorrugatedSide(ribGroup, xWall, sign, a, b, 0, hit.y0);
        this.addCorrugatedSide(ribGroup, xWall, sign, a, b, hit.y1);
      } else {
        this.addCorrugatedSide(ribGroup, xWall, sign, a, b, 0);
      }
    }
  }

  makeHingedDoor(opts) {
    const { THREE, M } = this;
    const w = opts.w, h = opts.h, thick = opts.thick || 0.035;
    const g = new THREE.Group();
    const frameM = new THREE.MeshStandardMaterial({ color: 0x6a7076, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide });
    const leafM = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, metalness: 0.55, roughness: 0.4, side: THREE.DoubleSide });
    const fw = 0.035;
    [[w + fw * 2, fw, thick, 0, h + fw / 2, 0],
    [fw, h, thick, -(w / 2 + fw / 2), h / 2, 0],
    [fw, h, thick, (w / 2 + fw / 2), h / 2, 0]].forEach((d) => {
      const f = new THREE.Mesh(new THREE.BoxGeometry(d[0], d[1], d[2]), frameM);
      f.position.set(d[3], d[4], d[5]);
      g.add(f);
    });
    const hinge = new THREE.Group();
    const right = !!opts.hingeRight;
    hinge.position.set(right ? w / 2 : -w / 2, 0, 0);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(w - 0.01, h - 0.01, thick * 0.7), leafM);
    leaf.position.set(right ? -w / 2 : w / 2, h / 2, 0);
    leaf.castShadow = true;
    hinge.add(leaf);
    if (!opts.noGlass) {
      const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.28, 0.008), M.vidro);
      win.position.set(right ? -w / 2 : w / 2, h * 0.72, thick * 0.4);
      hinge.add(win);
    }
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 8), M.aluminio);
    handle.rotation.z = Math.PI / 2;
    handle.position.set(right ? -(w - 0.08) : (w - 0.08), h * 0.48, thick * 0.5);
    hinge.add(handle);
    [0.18, h * 0.5, h - 0.18].forEach((hy) => {
      const hg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.02), frameM);
      hg.position.set(right ? 0.01 : -0.01, hy, thick * 0.6);
      hinge.add(hg);
    });
    const restY = opts.open || 0;
    hinge.rotation.y = restY;
    hinge.userData.role = 'hinge';
    hinge.userData.restY = restY;
    hinge.userData.openY = restY === 0 ? (right ? -1.45 : 1.45) : restY;
    g.add(hinge);
    g.userData.hinge = hinge;
    return g;
  }

  build(winCut, winLCuts, winRCuts, chassisG) {
    const { THREE, M, BODY_W, Lt, wth, WALL_H, mzWallY0, mzFloorH, zRoofFront, FLOOR_Y, CHASSIS_Y, L, W, roofTop } = this;
    const trailer = new THREE.Group();
    const wallG = new THREE.Group();
    trailer.add(wallG);
    wallG.position.y = FLOOR_Y;

    this.wallGroup = wallG;

    const WALL_H_LOCAL = this.Hint + 0.05;
    const wallsExt = new THREE.Group();
    wallG.add(wallsExt);
    this.wallsExt = wallsExt;

    const backWallGroup = new THREE.Group();
    this.backWallGroup = backWallGroup;

    const zBack = Lt / 2 - wth / 2;
    const winRear = { x: 0, y: 1.20, w: 0.80, h: 0.50 };
    const rx0 = winRear.x - winRear.w / 2, rx1 = winRear.x + winRear.w / 2;
    const ry0 = winRear.y - winRear.h / 2, ry1 = winRear.y + winRear.h / 2;
    wallsExt.add(this.endWallRange(-BODY_W / 2, rx0, 0, wth, M.parede, zBack, 8));
    wallsExt.add(this.endWallRange(rx1, BODY_W / 2, 0, wth, M.parede, zBack, 8));
    wallsExt.add(this.endWallRange(rx0, rx1, 0, wth, M.parede, zBack, 4, ry0));
    wallsExt.add(this.endWallRange(rx0, rx1, ry1, wth, M.parede, zBack, 4));

    // ── Parede frontal da caçamba (z = -Lt/2 + wth/2) ──
    const frontWallGroup = new THREE.Group();
    this.frontWallGroup = frontWallGroup;
    const winFront = { x: 0, y: 0.32, w: 0.70, h: 0.32 };
    const zFrontBox = -Lt / 2 + wth / 2;
    const fx0 = winFront.x - winFront.w / 2, fx1 = winFront.x + winFront.w / 2;
    const fy0 = winFront.y - winFront.h / 2, fy1 = winFront.y + winFront.h / 2;
    // Parede aos pes da cama do mezanino: somente a metade inferior.
    wallsExt.add(this.endWallRange(-BODY_W / 2, fx0, 0, wth, M.parede, zFrontBox, 8, mzWallY0));
    wallsExt.add(this.endWallRange(fx1, BODY_W / 2, 0, wth, M.parede, zFrontBox, 8, mzWallY0));
    wallsExt.add(this.endWallRange(fx0, fx1, 0, wth, M.parede, zFrontBox, 4, Math.min(fy0, mzWallY0)));
    if (fy1 < mzWallY0) wallsExt.add(this.endWallRange(fx0, fx1, fy1, wth, M.parede, zFrontBox, 4, mzWallY0));

    const zFront = -Lt / 2 + wth / 2;
    wallsExt.add(this.sideWall(-BODY_W / 2, wth, 0, M.parede, -Lt / 2, Lt / 2, 24, winLCuts));
    wallsExt.add(this.sideWall(BODY_W / 2 - wth, wth, 0, M.parede, -Lt / 2, Lt / 2, 28, winRCuts));
    wallsExt.add(this.sideWall(-BODY_W / 2, wth, mzWallY0, M.parede, zRoofFront, -Lt / 2, 16));
    wallsExt.add(this.sideWall(BODY_W / 2 - wth, wth, mzWallY0, M.parede, zRoofFront, -Lt / 2, 16));

    const zFrontMz = zRoofFront + wth / 2;
    wallsExt.add(this.endWallRange(-BODY_W / 2, BODY_W / 2, mzWallY0, wth, M.parede, zFrontMz, 8));

    const DOOR_W = 0.62, DOOR_H = 1.60, DOOR_SILL = 0.08;
    const DOOR_Z = Lt / 2 - 0.52;
    const doorSill = this.wall(wth, DOOR_SILL, DOOR_W, M.madeiraD);
    doorSill.position.set(BODY_W / 2 - wth / 2, DOOR_SILL / 2, DOOR_Z);
    wallsExt.add(doorSill);

    const ribGroup = new THREE.Group();
    wallsExt.add(ribGroup);
    this.ribGroup = ribGroup;

    this.addSideSiding(ribGroup, -BODY_W / 2, -1, -Lt / 2, Lt / 2, winLCuts);
    this.addSideSiding(ribGroup, BODY_W / 2, 1, -Lt / 2, Lt / 2, winRCuts);
    this.addCorrugatedSide(ribGroup, -BODY_W / 2, -1, zRoofFront, -Lt / 2, mzWallY0);
    this.addCorrugatedSide(ribGroup, BODY_W / 2, 1, zRoofFront, -Lt / 2, mzWallY0);

    const entryDoor = this.makeHingedDoor({ w: DOOR_W, h: DOOR_H, open: 0, noGlass: true });
    entryDoor.position.set(BODY_W / 2, DOOR_SILL, DOOR_Z);
    entryDoor.rotation.y = -Math.PI / 2;
    entryDoor.userData.skipFunc = true;
    if (entryDoor.userData.hinge) entryDoor.userData.hinge.userData.role = null;
    wallsExt.add(entryDoor);

    // ── Transom (vitrô fixo acima da porta) ──
    const TRANSOM_H = 0.17;
    const transomGroup = new THREE.Group();
    const tt = 0.028, td = 0.036;
    const tTop = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + tt * 2, tt, td), M.aluminioD);
    tTop.position.y = TRANSOM_H / 2 + tt / 2;
    const tBot = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W + tt * 2, tt, td), M.aluminioD);
    tBot.position.y = -TRANSOM_H / 2 - tt / 2;
    const tLeft = new THREE.Mesh(new THREE.BoxGeometry(tt, TRANSOM_H, td), M.aluminioD);
    tLeft.position.x = -DOOR_W / 2 - tt / 2;
    const tRight = new THREE.Mesh(new THREE.BoxGeometry(tt, TRANSOM_H, td), M.aluminioD);
    tRight.position.x = DOOR_W / 2 + tt / 2;
    const tGlass = new THREE.Mesh(new THREE.BoxGeometry(DOOR_W, TRANSOM_H, 0.006), M.vidro);
    transomGroup.add(tTop, tBot, tLeft, tRight, tGlass);
    transomGroup.position.set(BODY_W / 2 - wth / 2, DOOR_SILL + DOOR_H + TRANSOM_H / 2, DOOR_Z);
    transomGroup.rotation.y = Math.PI / 2;
    transomGroup.userData.transom = true;
    wallsExt.add(transomGroup);

    // ── Saia (skirt) e fenders — desce meia roda a partir do fundo da caixa ──
    const SKIRT_T = 0.03;
    const WHEEL_R = CHASSIS_Y;
    const SKIRT_TOP = FLOOR_Y;
    const SKIRT_BOT = Math.max(0, FLOOR_Y - WHEEL_R);
    const WHEEL_ARCH = 0.42;
    const L_ = this.L;
    const W_ = this.W;
    const h_skirt = SKIRT_TOP - SKIRT_BOT; // meia roda abaixo da caixa
    const zSegs = [[-L_ / 2, -WHEEL_ARCH], [WHEEL_ARCH, L_ / 2]];
    const wingW = BODY_W / 2 - W_ / 2;
    const deckY = CHASSIS_Y + 0.04 + 0.15 + 0.02;
    for (const sign of [-1, 1]) {
      const xSkirt = sign * (BODY_W / 2 - SKIRT_T / 2);
      const xWing = sign * (W_ / 2 + wingW / 2);
      zSegs.forEach(([z0, z1]) => {
        const d = z1 - z0;
        const p = new THREE.Mesh(new THREE.BoxGeometry(SKIRT_T, h_skirt, d), M.madeiraD);
        p.position.set(xSkirt, SKIRT_BOT + h_skirt / 2, (z0 + z1) / 2);
        p.castShadow = true;
        trailer.add(p);
        if (chassisG) {
          const wing = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.04, d), M.chassis);
          wing.position.set(xWing, deckY, (z0 + z1) / 2);
          wing.castShadow = true;
          chassisG.add(wing);
        }
        const soffit = new THREE.Mesh(new THREE.BoxGeometry(wingW, 0.02, d), M.madeiraD);
        soffit.position.set(xWing, SKIRT_BOT + 0.01, (z0 + z1) / 2);
        trailer.add(soffit);
      });
      const fender = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.32, SKIRT_T, 16, 1, true, Math.PI, Math.PI),
        M.madeiraD
      );
      fender.rotation.y = Math.PI / 2;
      fender.position.set(xSkirt, CHASSIS_Y, 0);
      trailer.add(fender);
    }

    return { group: trailer, wallGroup: wallG, wallsExt, backWallGroup, frontWallGroup, ribGroup, WALL_H: WALL_H_LOCAL, entryDoor };
  }
}
