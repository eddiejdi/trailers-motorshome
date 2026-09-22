/**
 * Interior — factories genéricas (sem layout de projeto).
 * Banheiro, escada, mezanino, dinette, cozinha vêm do JSON / paleta.
 */
export default class Interior {
  constructor(THREE, M, {
    BODY_W, Li, Lt, wth, FLOOR_Y, WALL_H, mzFloorH, mzW, mzL,
    mzInnerZ, mzInnerW, CHASSIS_Y, zRoofFront, roofTop, MATTRESS_CASAL_L,
  }) {
    this.THREE = THREE;
    this.M = M;
    this.BODY_W = BODY_W;
    this.Li = Li;
    this.Lt = Lt;
    this.wth = wth;
    this.FLOOR_Y = FLOOR_Y;
    this.WALL_H = WALL_H;
    this.mzFloorH = mzFloorH;
    this.mzW = mzW;
    this.mzL = mzL;
    this.mzInnerZ = mzInnerZ;
    this.mzInnerW = mzInnerW;
    this.CHASSIS_Y = CHASSIS_Y;
    this.zRoofFront = zRoofFront;
    this.roofTop = roofTop;
    this.MATTRESS_CASAL_L = MATTRESS_CASAL_L;
    this.group = null;
    this.interior = null;
    this.bath = null;
    this.kitchen = null;
    this.stairCabs = null;
    this.mezz = null;
    this.wallsInt = null;
    this.kidBed = null;
    this.casalBed = null;
  }

  wall(w, h, d, mat) {
    const { THREE } = this;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  makeHingedDoor(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w || 0.55;
    const h = opts.h || 1.70;
    const thick = opts.thick || 0.035;
    const g = new THREE.Group();
    const frameM = new THREE.MeshStandardMaterial({
      color: 0x6a7076, metalness: 0.7, roughness: 0.35, side: THREE.DoubleSide,
    });
    const leafM = new THREE.MeshStandardMaterial({
      color: 0xcfd3d6, metalness: 0.55, roughness: 0.4, side: THREE.DoubleSide,
    });
    const fw = 0.035;
    [
      [w + fw * 2, fw, thick, 0, h + fw / 2, 0],
      [fw, h, thick, -(w / 2 + fw / 2), h / 2, 0],
      [fw, h, thick, (w / 2 + fw / 2), h / 2, 0],
    ].forEach((d) => {
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
    g.userData.kind = opts.kind || 'porta-int';
    g.userData.funcKind = 'porta';
    return g;
  }

  makeDinetteGroup(opts = {}) {
    const { THREE, M } = this;
    const foam = M.colchaoS;
    const wood = M.madeiraD;
    const dual = !!opts.dual;
    const benchD = opts.benchD || 0.45;
    const benchL = opts.benchL || 1.60;
    const seatH = opts.seatH || 0.42;
    const backH = opts.backH || 0.32;
    const tableD = opts.tableD || 0.50;
    const tableL = opts.tableL || Math.max(0.8, benchL - 0.10);
    const tableH = opts.tableH || 0.70;
    const gap = 0.04;
    const g = new THREE.Group();
    const makeBench = (sign) => {
      const bench = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(benchD, seatH, benchL), wood);
      box.position.y = seatH / 2;
      box.castShadow = true;
      box.receiveShadow = true;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(benchD - 0.06, 0.08, benchL - 0.04), foam);
      cushion.position.set(0.02 * sign, seatH + 0.04, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, backH, benchL - 0.02), foam);
      back.position.set(sign * (-benchD / 2 + 0.04), seatH + backH / 2, 0);
      back.userData.role = 'back';
      back.userData.foldSign = sign;
      bench.add(box);
      bench.add(cushion);
      bench.add(back);
      return bench;
    };
    const spanX = dual ? (benchD + gap + tableD + gap + benchD) : (benchD + gap + tableD);
    const b1 = makeBench(1);
    b1.position.x = -spanX / 2 + benchD / 2;
    g.add(b1);
    if (dual) {
      const b2 = makeBench(-1);
      b2.position.x = spanX / 2 - benchD / 2;
      g.add(b2);
    }
    const tableX = dual ? 0 : (spanX / 2 - tableD / 2);
    const top = new THREE.Mesh(new THREE.BoxGeometry(tableD, 0.03, tableL), wood);
    top.position.set(tableX, tableH, 0);
    top.castShadow = true;
    if (top.material) {
      top.material = top.material.clone();
      top.material.transparent = false;
      top.material.opacity = 1;
    }
    top.userData.role = 'table';
    top.userData.restY = tableH;
    top.userData.bedY = seatH + 0.015;
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, tableH - 0.03, 10), M.aluminio);
    ped.position.set(tableX, (tableH - 0.03) / 2, 0);
    ped.userData.role = 'ped';
    ped.userData.restH = tableH - 0.03;
    const fill = new THREE.Mesh(new THREE.BoxGeometry(tableD - 0.02, 0.08, tableL - 0.02), foam);
    fill.position.set(tableX, seatH + 0.04, 0);
    fill.userData.role = 'fill';
    fill.visible = false;
    if (fill.material) {
      fill.material = fill.material.clone();
      fill.material.transparent = true;
      fill.material.opacity = 0;
    }
    g.add(top);
    g.add(ped);
    g.add(fill);
    g.userData.kind = opts.kind || 'dinette';
    g.userData.funcKind = 'dinette';
    g.userData.benchL = benchL;
    g.userData.benchD = benchD;
    g.userData.tableL = tableL;
    g.userData.tableD = tableD;
    g.userData.dinetteParams = { benchL, benchD, tableL, tableD, seatH, dual };
    return g;
  }

  makeStairCab(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w != null ? opts.w : 0.30;
    const h = opts.h != null ? opts.h : 0.34;
    const d = opts.d != null ? opts.d : 0.32;
    // doorFace: face das portas — 'x-' lateral interna (cabine), 'x+', 'z+', 'z-'
    const doorFace = String(opts.doorFace || 'x-').toLowerCase();
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.madeira);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xc4a060, roughness: 0.55 });
    const dh = Math.max(0.12, h - 0.08);
    const dd = 0.018;
    const gap = 0.002;
    const placeDoors = (axis) => {
      // axis 'x' = portas na face ±X (lateral); 'z' = face ±Z (frente/fundo)
      if (axis === 'x') {
        const sign = doorFace === 'x+' ? 1 : -1;
        const dz = d * 0.42;
        for (const sz of [-d * 0.22, d * 0.22]) {
          const door = new THREE.Mesh(new THREE.BoxGeometry(dd, dh, dz), doorMat);
          door.position.set(sign * (w / 2 + dd / 2 + gap), h / 2, sz);
          g.add(door);
          const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8), M.aluminioD);
          kn.rotation.z = Math.PI / 2;
          kn.position.set(sign * (w / 2 + dd + 0.012), h / 2, sz + dz * 0.28 * sign);
          g.add(kn);
        }
      } else {
        const sign = doorFace === 'z-' ? -1 : 1;
        const dw = w * 0.42;
        for (const sx of [-w * 0.22, w * 0.22]) {
          const door = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), doorMat);
          door.position.set(sx, h / 2, sign * (d / 2 + dd / 2 + gap));
          g.add(door);
          const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8), M.aluminioD);
          kn.rotation.x = Math.PI / 2;
          kn.position.set(sx + dw * 0.28, h / 2, sign * (d / 2 + dd + 0.012));
          g.add(kn);
        }
      }
    };
    if (doorFace === 'x-' || doorFace === 'x+') placeDoors('x');
    else placeDoors('z');
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.025, d + 0.01), M.madeiraD);
    top.position.y = h + 0.012;
    g.add(top);
    g.userData.kind = 'stair-cab';
    g.userData.matFamily = 'wood';
    g.userData.stairParams = { w, h, d, doorFace };
    return g;
  }

  makePotti(opts = {}) {
    const { THREE, M } = this;
    const g = new THREE.Group();
    const w = opts.w || 0.38;
    const h = opts.h || 0.42;
    const d = opts.d || 0.38;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.vaso);
    body.position.y = h / 2;
    body.castShadow = true;
    g.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(w, 0.04, 0.10), M.vaso);
    lid.position.set(0, h + 0.02, -d / 2 + 0.06);
    g.add(lid);
    g.userData.kind = 'potti';
    return g;
  }

  makeDucha(opts = {}) {
    const { THREE, M } = this;
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(opts.r || 0.05, 8, 8), M.aluminio);
    const spray = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.28, 12, 1, true),
      new THREE.MeshStandardMaterial({
        color: 0xa8d8f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    spray.position.set(0, -0.18, 0);
    spray.userData.role = 'spray';
    head.add(spray);
    g.add(head);
    const hose = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), M.aluminioD);
    hose.position.set(0, -0.15, 0);
    g.add(hose);
    g.userData.kind = 'ducha';
    g.userData.funcKind = 'ducha';
    return g;
  }

  makeMirror(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w || 0.28;
    const h = opts.h || 0.32;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, opts.d || 0.01), M.vidro);
    m.userData.kind = 'espelho';
    return m;
  }

  makeMattress(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w || (this.Li - 0.06);
    const h = opts.h || 0.10;
    const d = opts.d || (this.MATTRESS_CASAL_L - 0.08);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.colchaoC);
    m.castShadow = true;
    m.userData.kind = 'colchao-casal';
    return m;
  }

  makePillow(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w || 0.40;
    const h = opts.h || 0.10;
    const d = opts.d || 0.35;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.travesseiro);
    m.userData.kind = 'travesseiro';
    return m;
  }

  makeMezzColumn(opts = {}) {
    const { THREE, M } = this;
    const s = opts.s || 0.05;
    const h = opts.h || (this.mzFloorH + 0.02);
    const m = new THREE.Mesh(new THREE.BoxGeometry(s, h, s), M.aluminio);
    m.position.y = h / 2;
    m.castShadow = true;
    m.userData.kind = 'coluna-mez';
    return m;
  }

  makeMezzBeam(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w || (this.mzW - 0.08);
    const h = opts.h || 0.04;
    const d = opts.d || 0.05;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.aluminio);
    m.userData.kind = 'viga-mez';
    return m;
  }

  makeMezzFloor(opts = {}) {
    const { THREE, M } = this;
    const w = opts.w || this.Li;
    const h = opts.h || 0.04;
    const d = opts.d || this.mzL;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.madeira);
    m.castShadow = true;
    m.receiveShadow = true;
    m.userData.kind = 'piso-mezanino';
    m.userData.matFamily = 'wood';
    return m;
  }

  makeGuardRail(opts = {}) {
    const { THREE, M } = this;
    const len = Math.max(0.4, Number(opts.len) || (this.mzW - 0.10) || 1.70);
    const h = Math.max(0.35, Number(opts.h) || 0.55);
    const postS = 0.04;
    const railT = 0.03;
    const nPosts = Math.max(3, Math.round(len / 0.45) + 1);
    const wood = (M && M.madeiraD) || new THREE.MeshStandardMaterial({ color: 0xa08050, roughness: 0.65 });
    const metal = (M && M.aluminioD) || new THREE.MeshStandardMaterial({ color: 0x8a8a8a, metalness: 0.6, roughness: 0.4 });
    const g = new THREE.Group();

    const addBox = (sx, sy, sz, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      return m;
    };

    // montantes verticais
    for (let i = 0; i < nPosts; i++) {
      const t = nPosts === 1 ? 0.5 : i / (nPosts - 1);
      const x = -len / 2 + t * len;
      addBox(postS, h, postS, wood, x, h / 2, 0);
    }
    // corrimão superior
    addBox(len + postS, railT, postS * 1.1, metal, 0, h - railT / 2, 0);
    // corrimão intermediário
    addBox(len + postS * 0.5, railT * 0.7, postS * 0.8, metal, 0, h * 0.55, 0);
    // rodapé / soleira
    addBox(len + postS, railT * 0.8, postS * 1.2, wood, 0, railT * 0.4, 0);
    // balustres finos entre montantes
    const balS = 0.012;
    const balH = h - railT * 2 - 0.04;
    for (let i = 0; i < nPosts - 1; i++) {
      const x0 = -len / 2 + (i / (nPosts - 1)) * len;
      const x1 = -len / 2 + ((i + 1) / (nPosts - 1)) * len;
      for (let k = 1; k <= 2; k++) {
        const x = x0 + (k / 3) * (x1 - x0);
        addBox(balS, balH, balS, metal, x, railT + 0.02 + balH / 2, 0);
      }
    }

    g.userData.kind = 'guarda-corpo';
    g.userData.funcKind = 'guarda-corpo';
    g.userData.railLen = len;
    g.userData.railH = h;
    g.userData.editable = true;
    return g;
  }

  /**
   * build — só estrutura vazia. Layout vem do scene_layout JSON.
   */
  build(chassisG) {
    const { THREE, FLOOR_Y, mzFloorH } = this;
    const trailer = new THREE.Group();

    const interior = new THREE.Group();
    trailer.add(interior);
    // Y=0: scene_layout.p é coordenada de mundo no trailer (valores fixos do JSON).
    interior.position.y = 0;
    this.group = interior;
    this.interior = interior;

    const wallsInt = new THREE.Group();
    interior.add(wallsInt);
    this.wallsInt = wallsInt;

    const bath = new THREE.Group();
    wallsInt.add(bath);
    this.bath = bath;

    const kitchen = new THREE.Group();
    interior.add(kitchen);
    this.kitchen = kitchen;

    const stairCabs = new THREE.Group();
    interior.add(stairCabs);
    this.stairCabs = stairCabs;

    const mezz = new THREE.Group();
    trailer.add(mezz);
    this.mezz = mezz;

    this.kidBed = null;
    this.casalBed = null;

    const colTopY = mzFloorH + 0.02;
    const stairX = 0;
    const HATCH_Z = 0;

    return {
      group: trailer,
      interior,
      wallsInt,
      bath,
      kitchen,
      stairCabs,
      mezz,
      kidBed: null,
      casalBed: null,
      mzFloor: null,
      guard: null,
      colTopY,
      kX: 0,
      kZ: 0,
      bedX: 0,
      bedZ: 0,
      stairX,
      HATCH_Z,
      gel: null,
      gelHandle: null,
      fogIcon: null,
      fogIcon2: null,
      potti: null,
      pottiLid: null,
      ducha: null,
      mirror: null,
      counter: null,
      counterTop: null,
      cubDoor: null,
    };
  }
}
