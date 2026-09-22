export default class Body {
  constructor(THREE, M, { BODY_W, Lt, L, W, Hc, Hint, wth, CHASSIS_Y, FLOOR_Y, roofY, roofTop, roofFlatStart, roofFlatEnd, zRoofFront, mzWallY0, mzFloorH, wallType = 'dupla', sheetT = 0.010, studW = 0.040, studSpacing = 0.50 }) {
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
    this.wallType = wallType;
    this.SHEET_T = sheetT;
    this.STUD_W = studW;
    this.STUD_D = wth - 2 * sheetT;
    this.STUD_SPACING = studSpacing;
    this.WALL_H_LOCAL = null;
    this.wallGroup = null;
    this.wallsExt = null;
    this.backWallGroup = null;
    this.frontWallGroup = null;
    this.frontMzGroup = null;
    this.ribGroup = null;
    this.windowMeshes = [];
    this._sideWallMeshL = null;
    this._sideWallMeshR = null;
    this._frameSideL = null;
    this._frameSideR = null;
    this._origWinLCuts = [];
    this._origWinRCuts = [];
    this._userWallCutsL = [];
    this._userWallCutsR = [];
    this._userCuts = new Map();
    this._sidingL = null;
    this._sidingR = null;
    this._sidingMzL = null;
    this._sidingMzR = null;
    this._mzNoseGroup = null;
    this._cornerGroup = null;
    this._rearWallGroup = null;
    this._frontWallBoxGroup = null;
    this._origWinRear = null;
    this._origWinFront = null;
    this._layoutOpenings = null;
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
    if (width < 0.015) return new THREE.Group();
    const zA = zPos - thickness / 2;
    const zB = zPos + thickness / 2;
    const hRoof = Math.min(roofTop(zA), roofTop(zB));
    const h = Math.max(yBottom + 0.015, yCap != null ? Math.min(yCap, hRoof) : hRoof);
    if (h - yBottom < 0.015) return new THREE.Group();
    const pushQuad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, u0, u1, v0, v1) => {
      const b0 = verts.length / 3;
      verts.push(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz);
      uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    };
    // faces front/back (Z)
    for (let i = 0; i < segs; i++) {
      const t0 = i / segs, t1 = (i + 1) / segs;
      const xa = x0 + t0 * width, xb = x0 + t1 * width;
      pushQuad(xa, yBottom, zA, xb, yBottom, zA, xb, h, zA, xa, h, zA, t0, t1, 0, 1);
      pushQuad(xb, yBottom, zB, xa, yBottom, zB, xa, h, zB, xb, h, zB, t0, t1, 0, 1);
    }
    // faces left/right (espessura)
    pushQuad(x0, yBottom, zB, x0, yBottom, zA, x0, h, zA, x0, h, zB, 0, 1, 0, 1);
    pushQuad(x1, yBottom, zA, x1, yBottom, zB, x1, h, zB, x1, h, zA, 0, 1, 0, 1);
    // topo e base (espessura)
    pushQuad(x0, h, zA, x1, h, zA, x1, h, zB, x0, h, zB, 0, 1, 0, 1);
    pushQuad(x0, yBottom, zB, x1, yBottom, zB, x1, yBottom, zA, x0, yBottom, zA, 0, 1, 0, 1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true; m.receiveShadow = true;
    return m;
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
        // intervalo fechado no miolo da faixa — evita filetes residuais no vão
        if (z >= o.z0 - 1e-5 && z <= o.z1 + 1e-5) {
          const c0 = Math.max(y0, Math.min(o.y0, o.y1));
          const c1 = Math.min(h, Math.max(o.y0, o.y1));
          if (c1 - c0 > 0.01) cuts.push([c0, c1]);
        }
      });
      if (!cuts.length) return [[y0, h]];
      cuts.sort((a, b) => a[0] - b[0]);
      const out = [];
      let cursor = y0;
      cuts.forEach(([c0, c1]) => {
        if (c0 - cursor > 0.004) out.push([cursor, c0]);
        cursor = Math.max(cursor, c1);
      });
      if (h - cursor > 0.004) out.push([cursor, h]);
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

  addSideSiding(ribGroup, xWall, sign, zA, zB, cuts, yBase = 0) {
    const zs = [zA];
    cuts.forEach((c) => { zs.push(c.z0, c.z1); });
    zs.push(zB);
    zs.sort((a, b) => a - b);
    for (let i = 0; i < zs.length - 1; i++) {
      const a = zs[i], b = zs[i + 1];
      if (b - a < 0.012) continue;
      const mid = (a + b) / 2;
      const hit = cuts.find((c) => mid >= c.z0 - 1e-5 && mid <= c.z1 + 1e-5);
      if (hit) {
        if (hit.y0 > yBase + 0.015) this.addCorrugatedSide(ribGroup, xWall, sign, a, b, yBase, hit.y0);
        this.addCorrugatedSide(ribGroup, xWall, sign, a, b, Math.max(hit.y1, yBase));
      } else {
        this.addCorrugatedSide(ribGroup, xWall, sign, a, b, yBase);
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
    g.userData.doorW = w;
    g.userData.doorH = h;
    g.userData.winW = w;
    g.userData.winH = h;
    return g;
  }

  build(winCut, winLCuts, winRCuts, chassisG) {
    const { THREE, M, BODY_W, Lt, wth, WALL_H, mzWallY0, mzFloorH, zRoofFront, FLOOR_Y, CHASSIS_Y, L, W, roofTop } = this;
    const trailer = new THREE.Group();
    const wallG = new THREE.Group();
    trailer.add(wallG);
    // wallG.y = FLOOR_Y: paredes externas usam yBottom=0 local ao wallG.
    // JSON scene_layout (maderite, janelas, etc.) usa coords absolutas trailer-world.
    wallG.position.y = FLOOR_Y;
    this.FLOOR_Y = FLOOR_Y;

    this.wallGroup = wallG;

    this.WALL_H_LOCAL = this.Hint + 0.05;
    const WALL_H_LOCAL = this.WALL_H_LOCAL;
    const wallsExt = new THREE.Group();
    wallG.add(wallsExt);
    this.wallsExt = wallsExt;

    const backWallGroup = new THREE.Group();
    this.backWallGroup = backWallGroup;

    this._origWinLCuts = Array.isArray(winLCuts) ? winLCuts.slice() : [];
    this._origWinRCuts = Array.isArray(winRCuts) ? winRCuts.slice() : [];

    // Aberturas (porta/janela) vêm do JSON via setLayoutOpenings — factory sem vãos de projeto.
    this._origWinRear = null;
    this._origWinFront = null;

    const zBack = Lt / 2 - wth / 2;
    this._rearWallGroup = new THREE.Group();
    wallsExt.add(this._rearWallGroup);
    this._rebuildRearWall();

    const frontWallGroup = new THREE.Group();
    this.frontWallGroup = frontWallGroup;
    this._frontWallBoxGroup = new THREE.Group();
    wallsExt.add(this._frontWallBoxGroup);
    this._rebuildFrontWall();

    // Quinas: laterais encurtadas em wth nas pontas Z para não sobrepor
    // as paredes de ponta (rear/front). Cantoneiras fecham o vão.
    const zCab0 = -Lt / 2 + wth;
    const zCab1 = Lt / 2 - wth;
    const zMz0 = zRoofFront + wth;
    const zMz1 = -Lt / 2;
    if (this.wallType === 'dupla') {
      this._frameSideL = this._buildDuplaSide('left', -BODY_W / 2, this._origWinLCuts, 0, zCab0, zCab1);
      this._frameSideR = this._buildDuplaSide('right', BODY_W / 2 - wth, this._origWinRCuts, 0, zCab0, zCab1);
      wallsExt.add(this._frameSideL);
      wallsExt.add(this._frameSideR);
    } else {
      this._sideWallMeshL = this.sideWall(-BODY_W / 2, wth, 0, M.parede, zCab0, zCab1, 24, this._origWinLCuts);
      this._sideWallMeshR = this.sideWall(BODY_W / 2 - wth, wth, 0, M.parede, zCab0, zCab1, 28, this._origWinRCuts);
      wallsExt.add(this._sideWallMeshL);
      wallsExt.add(this._sideWallMeshR);
    }
    this._mzWallL = this.sideWall(-BODY_W / 2, wth, mzWallY0, M.parede, zMz0, zMz1, 16);
    this._mzWallR = this.sideWall(BODY_W / 2 - wth, wth, mzWallY0, M.parede, zMz0, zMz1, 16);
    wallsExt.add(this._mzWallL);
    wallsExt.add(this._mzWallR);

    this._mzNoseGroup = new THREE.Group();
    wallsExt.add(this._mzNoseGroup);
    this._rebuildMzNoseWall();

    this._cornerGroup = new THREE.Group();
    wallsExt.add(this._cornerGroup);
    this._rebuildCornerPosts();

    const ribGroup = new THREE.Group();
    wallsExt.add(ribGroup);
    this.ribGroup = ribGroup;
    this._sidingL = new THREE.Group();
    this._sidingR = new THREE.Group();
    this._sidingMzL = new THREE.Group();
    this._sidingMzR = new THREE.Group();
    ribGroup.add(this._sidingL);
    ribGroup.add(this._sidingR);
    ribGroup.add(this._sidingMzL);
    ribGroup.add(this._sidingMzR);
    this.addSideSiding(this._sidingL, -BODY_W / 2, -1, zCab0, zCab1, this._origWinLCuts, 0);
    this.addSideSiding(this._sidingR, BODY_W / 2, 1, zCab0, zCab1, this._origWinRCuts, 0);
    this.addSideSiding(this._sidingMzL, -BODY_W / 2, -1, zMz0, zMz1, [], mzWallY0);
    this.addSideSiding(this._sidingMzR, BODY_W / 2, 1, zMz0, zMz1, [], mzWallY0);

    // Porta/transom: só via JSON (setLayoutOpenings + scene_layout), não no factory.
    const entryDoor = null;

    return { group: trailer, wallGroup: wallG, wallsExt, backWallGroup, frontWallGroup, ribGroup, WALL_H: WALL_H_LOCAL, entryDoor };
  }

  isWallOpeningKind(kind) {
    if (!kind) return false;
    return kind === 'janela' || kind.indexOf('janela-') === 0 || kind === 'porta';
  }

  /** Posição do mesh no espaço local de wallG (paredes). JSON é trailer-world. */
  _meshPosInWallFrame(mesh) {
    const THREE = this.THREE || window.THREE;
    const wp = new THREE.Vector3();
    mesh.updateWorldMatrix(true, false);
    mesh.getWorldPosition(wp);
    if (this.wallGroup) {
      if (typeof this.wallGroup.updateMatrixWorld === 'function') this.wallGroup.updateMatrixWorld(true);
      if (typeof this.wallGroup.worldToLocal === 'function') {
        return this.wallGroup.worldToLocal(wp.clone());
      }
    }
    // fallback: wallG.y = FLOOR_Y
    return new THREE.Vector3(wp.x, wp.y - (this.FLOOR_Y || 0), wp.z);
  }

  nearestWall(mesh) {
    if (!mesh) return null;
    const halfW = this.BODY_W / 2;
    const halfL = this.Lt / 2;
    const lp = this._meshPosInWallFrame(mesh);
    const x = lp.x;
    const z = lp.z;
    // mezzanin exterior sides go to zRoofFront
    const zFront = this.zRoofFront != null ? this.zRoofFront : -halfL;
    const dL = Math.abs(x + halfW);
    const dR = Math.abs(x - halfW);
    const dF = Math.abs(z - zFront) < Math.abs(z + halfL) ? Math.abs(z - zFront) : Math.abs(z + halfL);
    const dB = Math.abs(z - halfL);
    // prefer side walls if clearly closer in X
    if (dL < 0.35 && dL <= dR) return 'left';
    if (dR < 0.35 && dR < dL) return 'right';
    if (dF <= dB) return 'front';
    return 'rear';
  }

  /**
   * Encaixa janela/porta na face da parede e parent = wallsExt (local wallG).
   * p do JSON permanece trailer-world na serialização; aqui só a pose na cena.
   */
  snapToWall(mesh) {
    const wall = this.nearestWall(mesh);
    if (!wall || !this.wallsExt) return null;
    const THREE = this.THREE || window.THREE;
    const mid = this.wth / 2;
    const halfW = this.BODY_W / 2;
    const halfL = this.Lt / 2;
    const lp = this._meshPosInWallFrame(mesh);
    let lx = lp.x, ly = lp.y, lz = lp.z;
    let ry = 0;
    if (wall === 'left') {
      lx = -halfW + mid;
      ry = -Math.PI / 2;
    } else if (wall === 'right') {
      lx = halfW - mid;
      ry = Math.PI / 2;
    } else if (wall === 'rear') {
      lz = halfL - mid;
      ry = 0;
    } else {
      // front: cabin bulkhead or mezz nose — keep z, clamp to wall face
      if (lz < -halfL) {
        // mezz front face near zRoofFront
        const zf = this.zRoofFront != null ? this.zRoofFront + mid : -halfL + mid;
        lz = zf;
      } else {
        lz = -halfL + mid;
      }
      ry = Math.PI;
    }
    // Clamp Y dentro dos limites da parede (0..WALL_H)
    const wallH = this.WALL_H || this.WALL_H_LOCAL || 1.85;
    if (ly < 0) ly = wallH / 2;
    if (ly > wallH) ly = wallH - 0.01;
    // parent sob wallsExt (filho de wallG) → position local wallG
    if (mesh.parent !== this.wallsExt) {
      this.wallsExt.add(mesh);
    }
    mesh.position.set(lx, ly, lz);
    mesh.rotation.set(0, ry, 0);
    mesh.userData.wall = wall;
    return wall;
  }

  openingFromMesh(mesh, wall) {
    const kind = (mesh.userData && mesh.userData.kind) || '';
    const isDoor = kind === 'porta';
    const ud = mesh.userData || {};
    // dims reais do mesh/JSON; porta: sill em position.y
    let w = Number(ud.glassW || ud.winW || ud.doorW) || (isDoor ? 0.62 : 0.50);
    let h = Number(ud.glassH || ud.winH || ud.doorH) || (isDoor ? 1.60 : 0.50);
    // folga da moldura (~2×28mm janela, 20mm porta) para o vão limpar o frame
    const pad = isDoor ? 0.020 : 0.056;
    w += pad;
    h += pad;
    const y = mesh.position.y;
    let y0 = isDoor ? y : y - h / 2;
    let y1 = isDoor ? y + h : y + h / 2;
    // porta: se o sill estiver elevado por engano, puxa ao piso local
    if (isDoor && y0 > 0.08 && y0 < 0.35) { y1 -= y0; y0 = 0; }
    if (y0 < 0) { y1 -= y0; y0 = 0; }
    if (wall === 'left' || wall === 'right') {
      return { z0: mesh.position.z - w / 2, z1: mesh.position.z + w / 2, y0, y1 };
    }
    return { x0: mesh.position.x - w / 2, x1: mesh.position.x + w / 2, y0, y1 };
  }

  applyOpening(mesh) {
    if (!mesh || !this.wallsExt) return;
    this._userCuts.delete(mesh.uuid);
    const kind = mesh.userData && mesh.userData.kind;
    if (!this.isWallOpeningKind(kind) && !(mesh.userData && mesh.userData.funcKind === 'janela')) return;
    const wall = this.snapToWall(mesh);
    if (!wall) {
      this.rebuildOpenings();
      return;
    }
    this._userCuts.set(mesh.uuid, { wall, opening: this.openingFromMesh(mesh, wall) });
    this.rebuildOpenings();
  }

  removeOpening(mesh) {
    if (!mesh) return;
    this._userCuts.delete(mesh.uuid);
    this.rebuildOpenings();
  }

  clearUserOpenings() {
    this._userCuts.clear();
    this.rebuildOpenings();
  }

  /** Deriva TODAS as aberturas de parede a partir de um projeto (JSON): cada
   *  janela/fechadura colocada pelo layout cria seu vão. Substitui os cortes
   *  de fábrica por completo — o projeto manda. */
  setLayoutOpenings(meshes) {
    const byWall = { left: [], right: [], rear: [], front: [] };
    (meshes || []).forEach((m) => {
      if (!m || !m.userData) return;
      const kind = m.userData.kind;
      const func = m.userData.funcKind;
      if (!this.isWallOpeningKind(kind) && func !== 'janela') return;
      // snap parent+pose first so opening is wall-local
      const wall = this.snapToWall(m) || this.nearestWall(m);
      if (wall && byWall[wall]) byWall[wall].push(this.openingFromMesh(m, wall));
    });
    this._layoutOpenings = byWall;
    this.rebuildOpenings();
  }

  _cutsFor(wall) {
    const extra = [];
    this._userCuts.forEach((v) => {
      if (v.wall === wall) extra.push(v.opening);
    });
    return extra;
  }

  rebuildOpenings() {
    this._rebuildSideWalls();
    this._rebuildRearWall();
    this._rebuildFrontWall();
    this._rebuildMzNoseWall();
    this._rebuildCornerPosts();
  }

  _rebuildSideWalls() {
    const { M, BODY_W, Lt, wth, mzWallY0, zRoofFront } = this;
    if (!this.wallsExt) return;
    const halfL = Lt / 2;
    const zCab0 = -halfL + wth;
    const zCab1 = halfL - wth;
    const zMz0 = (zRoofFront != null ? zRoofFront : -halfL) + wth;
    const zMz1 = -halfL;
    const allCutsL = (this._layoutOpenings ? this._layoutOpenings.left.slice() : this._origWinLCuts).concat(this._cutsFor('left'));
    const allCutsR = (this._layoutOpenings ? this._layoutOpenings.right.slice() : this._origWinRCuts).concat(this._cutsFor('right'));

    const inRange = (c, zA, zB) => c.z1 > zA && c.z0 < zB;
    const cutsLowerL = allCutsL.filter(c => inRange(c, zCab0, zCab1));
    const cutsLowerR = allCutsR.filter(c => inRange(c, zCab0, zCab1));

    if (this.wallType === 'dupla') {
      if (this._frameSideL) this.wallsExt.remove(this._frameSideL);
      if (this._frameSideR) this.wallsExt.remove(this._frameSideR);
      this._frameSideL = this._buildDuplaSide('left', -BODY_W / 2, cutsLowerL, 0, zCab0, zCab1);
      this._frameSideR = this._buildDuplaSide('right', BODY_W / 2 - wth, cutsLowerR, 0, zCab0, zCab1);
      this.wallsExt.add(this._frameSideL);
      this.wallsExt.add(this._frameSideR);
    } else {
      if (this._sideWallMeshL) this.wallsExt.remove(this._sideWallMeshL);
      if (this._sideWallMeshR) this.wallsExt.remove(this._sideWallMeshR);
      this._sideWallMeshL = this.sideWall(-BODY_W / 2, wth, 0, M.parede, zCab0, zCab1, 24, cutsLowerL);
      this._sideWallMeshR = this.sideWall(BODY_W / 2 - wth, wth, 0, M.parede, zCab0, zCab1, 28, cutsLowerR);
      this.wallsExt.add(this._sideWallMeshL);
      this.wallsExt.add(this._sideWallMeshR);
    }
    if (this._sidingL) {
      while (this._sidingL.children.length) this._sidingL.remove(this._sidingL.children[0]);
      this.addSideSiding(this._sidingL, -BODY_W / 2, -1, zCab0, zCab1, cutsLowerL);
    }
    if (this._sidingR) {
      while (this._sidingR.children.length) this._sidingR.remove(this._sidingR.children[0]);
      this.addSideSiding(this._sidingR, BODY_W / 2, 1, zCab0, zCab1, cutsLowerR);
    }

    if (zRoofFront != null) {
      const cutsMzL = allCutsL.filter(c => inRange(c, zMz0, zMz1));
      const cutsMzR = allCutsR.filter(c => inRange(c, zMz0, zMz1));
      if (this._mzWallL) this.wallsExt.remove(this._mzWallL);
      if (this._mzWallR) this.wallsExt.remove(this._mzWallR);
      this._mzWallL = this.sideWall(-BODY_W / 2, wth, mzWallY0, M.parede, zMz0, zMz1, 16, cutsMzL);
      this._mzWallR = this.sideWall(BODY_W / 2 - wth, wth, mzWallY0, M.parede, zMz0, zMz1, 16, cutsMzR);
      this.wallsExt.add(this._mzWallL);
      this.wallsExt.add(this._mzWallR);
      if (this._sidingMzL) {
        while (this._sidingMzL.children.length) this._sidingMzL.remove(this._sidingMzL.children[0]);
        this.addSideSiding(this._sidingMzL, -BODY_W / 2, -1, zMz0, zMz1, cutsMzL, mzWallY0);
      }
      if (this._sidingMzR) {
        while (this._sidingMzR.children.length) this._sidingMzR.remove(this._sidingMzR.children[0]);
        this.addSideSiding(this._sidingMzR, BODY_W / 2, 1, zMz0, zMz1, cutsMzR, mzWallY0);
      }
    }
  }

  _rebuildMzNoseWall() {
    const { M, BODY_W, wth, mzWallY0, zRoofFront } = this;
    if (!this._mzNoseGroup || zRoofFront == null) return;
    while (this._mzNoseGroup.children.length) this._mzNoseGroup.remove(this._mzNoseGroup.children[0]);
    // laterais encurtadas: nose cobre full width (quinas do mezanino)
    const zFrontMz = zRoofFront + wth / 2;
    const cuts = (this._layoutOpenings ? (this._layoutOpenings.front || []) : []).concat(this._cutsFor('front'));
    // só cortes no nariz do mezanino (y acima de mzWallY0)
    const mzCuts = cuts.filter((c) => (c.y1 == null ? true : c.y1 > mzWallY0 + 0.05));
    if (mzCuts.length) {
      const xs = [-BODY_W / 2, BODY_W / 2];
      mzCuts.forEach((c) => { xs.push(c.x0, c.x1); });
      xs.sort((a, b) => a - b);
      const uniq = [];
      xs.forEach((x) => { if (!uniq.length || Math.abs(uniq[uniq.length - 1] - x) > 1e-5) uniq.push(x); });
      for (let i = 0; i < uniq.length - 1; i++) {
        const a = uniq[i], b = uniq[i + 1];
        if (b - a < 0.015) continue;
        const mid = (a + b) / 2;
        const hit = mzCuts.find((c) => mid > c.x0 && mid < c.x1);
        if (hit) {
          const y0 = Math.max(mzWallY0, hit.y0);
          if (y0 > mzWallY0 + 0.02) this._mzNoseGroup.add(this.endWallRange(a, b, mzWallY0, wth, M.parede, zFrontMz, 4, y0));
          this._mzNoseGroup.add(this.endWallRange(a, b, Math.max(hit.y1, mzWallY0), wth, M.parede, zFrontMz, 4, null));
        } else {
          this._mzNoseGroup.add(this.endWallRange(a, b, mzWallY0, wth, M.parede, zFrontMz, 6, null));
        }
      }
    } else {
      this._mzNoseGroup.add(this.endWallRange(-BODY_W / 2, BODY_W / 2, mzWallY0, wth, M.parede, zFrontMz, 8));
    }
  }

  /** Cantoneiras de alumínio nas quinas — fecham o vão deixado pelo setback das laterais. */
  _rebuildCornerPosts() {
    const { THREE, M, BODY_W, Lt, wth, mzWallY0, zRoofFront, roofTop } = this;
    if (!this._cornerGroup) return;
    while (this._cornerGroup.children.length) this._cornerGroup.remove(this._cornerGroup.children[0]);
    const halfW = BODY_W / 2;
    const halfL = Lt / 2;
    const t = Math.min(0.04, wth);
    const mk = (x, z, y0, y1) => {
      const h = Math.max(0.05, y1 - y0);
      if (h < 0.05) return;
      // L-profile: dois boxes finos
      const legA = new THREE.Mesh(new THREE.BoxGeometry(t, h, t * 0.35), M.aluminioD || M.aluminio);
      legA.position.set(x + (x < 0 ? t / 2 : -t / 2), y0 + h / 2, z);
      legA.castShadow = true;
      const legB = new THREE.Mesh(new THREE.BoxGeometry(t * 0.35, h, t), M.aluminioD || M.aluminio);
      legB.position.set(x, y0 + h / 2, z + (z < 0 ? t / 2 : -t / 2));
      legB.castShadow = true;
      this._cornerGroup.add(legA, legB);
    };
    // 4 quinas da cabine
    [[-halfW, -halfL], [halfW, -halfL], [-halfW, halfL], [halfW, halfL]].forEach(([x, z]) => {
      mk(x, z, 0, roofTop(z));
    });
    // quinas do mezanino (nariz)
    if (zRoofFront != null) {
      [[-halfW, zRoofFront], [halfW, zRoofFront]].forEach(([x, z]) => {
        mk(x, z, mzWallY0, roofTop(z));
      });
      // junção cabine↔mezzanino em z=-halfL acima do piso mez
      [[-halfW, -halfL], [halfW, -halfL]].forEach(([x, z]) => {
        mk(x, z, mzWallY0, roofTop(z));
      });
    }
  }

  _rectCuts(base, extras) {
    const out = [];
    if (base) {
      out.push({
        x0: base.x - base.w / 2,
        x1: base.x + base.w / 2,
        y0: base.y - base.h / 2,
        y1: base.y + base.h / 2,
      });
    }
    extras.forEach((c) => {
      if (c.x0 != null) out.push(c);
    });
    return out;
  }

  _rebuildEndWallGroup(group, zPos, yCap, cuts) {
    const { M, BODY_W, wth } = this;
    if (!group) return;
    while (group.children.length) group.remove(group.children[0]);
    if (this.wallType === 'dupla') {
      const sT = this.SHEET_T;
      const zOuter = zPos - wth / 2 + sT / 2;
      const zInner = zPos + wth / 2 - sT / 2;
      group.add(this._endSheet(zOuter, yCap, cuts));
      group.add(this._endSheet(zInner, yCap, cuts));
      this._addFrame(group, 'x', zPos, -BODY_W / 2, BODY_W / 2, cuts, yCap);
      return;
    }
    const xs = [-BODY_W / 2, BODY_W / 2];
    cuts.forEach((c) => { xs.push(c.x0, c.x1); });
    xs.sort((a, b) => a - b);
    const uniq = [];
    xs.forEach((x) => {
      if (!uniq.length || Math.abs(uniq[uniq.length - 1] - x) > 1e-5) uniq.push(x);
    });
    for (let i = 0; i < uniq.length - 1; i++) {
      const a = uniq[i], b = uniq[i + 1];
      if (b - a < 0.012) continue;
      const mid = (a + b) / 2;
      const hit = cuts.find((c) => mid >= c.x0 - 1e-5 && mid <= c.x1 + 1e-5);
      if (hit) {
        const capLow = yCap != null ? Math.min(hit.y0, yCap) : hit.y0;
        if (capLow > 0.02) group.add(this.endWallRange(a, b, 0, wth, M.parede, zPos, 4, capLow));
        if (yCap == null || hit.y1 < yCap - 0.01) {
          group.add(this.endWallRange(a, b, hit.y1, wth, M.parede, zPos, 4, yCap));
        }
      } else {
        group.add(this.endWallRange(a, b, 0, wth, M.parede, zPos, 8, yCap));
      }
    }
  }

  _rebuildRearWall() {
    const zBack = this.Lt / 2 - this.wth / 2;
    const cuts = (this._layoutOpenings
      ? (this._layoutOpenings.rear || [])
      : this._rectCuts(this._origWinRear, [])).concat(this._cutsFor('rear'));
    this._rebuildEndWallGroup(this._rearWallGroup, zBack, null, cuts);
  }

  _rebuildFrontWall() {
    const zFrontBox = -this.Lt / 2 + this.wth / 2;
    const cuts = (this._layoutOpenings
      ? (this._layoutOpenings.front || [])
      : this._rectCuts(this._origWinFront, [])).concat(this._cutsFor('front'));
    this._rebuildEndWallGroup(this._frontWallBoxGroup, zFrontBox, this.mzWallY0, cuts);
  }

  // ─────────────────────────────────────────────────────────────
  // Parede dupla (light wood frame / casa americana):
  //   · folha externa e interna de maderite (SHEET_T)
  //   · caibros verticais (STUD_W × STUD_D) a cada STUD_SPACING
  //   · solera inferior + topo, e verga/jack-stud em cada vão
  // ─────────────────────────────────────────────────────────────

  _frameBox(axis, wAlong, h, dAlong) {
    const { THREE, M } = this;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(axis === 'z' ? dAlong : wAlong, h, axis === 'z' ? wAlong : dAlong),
      M.madeiraD
    );
    m.castShadow = true;
    return m;
  }

  _addFrame(g, axis, pos, a0, a1, cuts, yCap) {
    const sW = this.STUD_W, sD = this.STUD_D;
    const yTop = yCap != null ? Math.min(this.WALL_H_LOCAL, yCap) : this.WALL_H_LOCAL;
    const span = a1 - a0;
    const place = (m, x, y, z) => { m.position.set(x, y, z); g.add(m); };
    const at = (a, y) => (axis === 'z' ? [pos, y, a] : [a, y, pos]);

    // soleras (inferior e superior)
    const plateT = sW;
    place(this._frameBox(axis, span, plateT, sD), ...at((a0 + a1) / 2, plateT / 2));
    place(this._frameBox(axis, span, plateT, sD), ...at((a0 + a1) / 2, yTop - plateT / 2));

    const bands = cuts
      .filter((c) => c.y0 < yTop - 0.03)
      .map((c) => (axis === 'z'
        ? { a0: c.z0, a1: c.z1, y0: c.y0, y1: Math.min(c.y1, yTop) }
        : { a0: c.x0, a1: c.x1, y0: c.y0, y1: Math.min(c.y1, yTop) }));

    // montantes (caibros) verticais, evitando os vãos
    const edge = sW / 2 + 0.015;
    for (let a = a0 + edge; a < a1 - edge; a += this.STUD_SPACING) {
      const hit = bands.find((b) => a + sW / 2 > b.a0 && a - sW / 2 < b.a1);
      if (!hit) place(this._frameBox(axis, sW, yTop, sD), ...at(a, yTop / 2));
    }

    // contorno dos vãos: jack studs + verga (header)
    bands.forEach((b) => {
      const jackW = 0.03;
      const jh = Math.max(0.03, b.y1 - b.y0);
      // jack studs FORA do vão livre
      place(this._frameBox(axis, jackW, jh, sD), ...at(b.a0 - jackW / 2 - 0.002, b.y0 + jh / 2));
      place(this._frameBox(axis, jackW, jh, sD), ...at(b.a1 + jackW / 2 + 0.002, b.y0 + jh / 2));
      const hdrH = Math.max(0.05, yTop - b.y1);
      place(this._frameBox(axis, Math.max(0.05, b.a1 - b.a0 + jackW), hdrH, sD), ...at((b.a0 + b.a1) / 2, b.y1 + hdrH / 2));
    });
  }

  _buildDuplaSide(key, xOuter, cuts, yBottom = 0, z0 = null, z1 = null) {
    const { M, Lt, wth } = this;
    const g = new THREE.Group();
    const sT = this.SHEET_T, sD = this.STUD_D;
    const za = z0 != null ? z0 : (-Lt / 2 + wth);
    const zb = z1 != null ? z1 : (Lt / 2 - wth);
    g.add(this.sideWall(xOuter, sT, yBottom, M.parede, za, zb, 24, cuts));
    g.add(this.sideWall(xOuter + sT + sD, sT, yBottom, M.parede, za, zb, 24, cuts));
    this._addFrame(g, 'z', xOuter + sT + sD / 2, za, zb, cuts, null);
    g.userData.wallKey = key;
    return g;
  }

  _endSheet(zPos, yCap, cuts) {
    const { M, BODY_W } = this;
    const g = new THREE.Group();
    const xs = [-BODY_W / 2, BODY_W / 2];
    cuts.forEach((c) => { xs.push(c.x0, c.x1); });
    xs.sort((a, b) => a - b);
    const uniq = [];
    xs.forEach((x) => {
      if (!uniq.length || Math.abs(uniq[uniq.length - 1] - x) > 1e-5) uniq.push(x);
    });
    for (let i = 0; i < uniq.length - 1; i++) {
      const a = uniq[i], b = uniq[i + 1];
      if (b - a < 0.02) continue;
      const mid = (a + b) / 2;
      const hit = cuts.find((c) => mid >= c.x0 - 1e-5 && mid <= c.x1 + 1e-5);
      if (hit) {
        const capLow = yCap != null ? Math.min(hit.y0, yCap) : hit.y0;
        if (capLow > 0.02) g.add(this.endWallRange(a, b, 0, this.SHEET_T, M.parede, zPos, 4, capLow));
        if (yCap == null || hit.y1 < yCap - 0.01) {
          g.add(this.endWallRange(a, b, hit.y1, this.SHEET_T, M.parede, zPos, 4, yCap));
        }
      } else {
        g.add(this.endWallRange(a, b, 0, this.SHEET_T, M.parede, zPos, 8, yCap));
      }
    }
    return g;
  }
}
