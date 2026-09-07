export default class Interior {
  constructor(THREE, M, { BODY_W, Li, Lt, wth, FLOOR_Y, WALL_H, mzFloorH, mzW, mzL, mzInnerZ, mzInnerW, CHASSIS_Y, zRoofFront, roofTop, MATTRESS_CASAL_L }) {
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
    this.bath = null;
    this.kitchen = null;
    this.stairCabs = null;
    this.mezz = null;
  }

  wall(w, h, d, mat) {
    const { THREE } = this;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
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
    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.55, h * 0.28, 0.008), M.vidro);
    win.position.set(right ? -w / 2 : w / 2, h * 0.72, thick * 0.4);
    hinge.add(win);
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
      box.castShadow = true; box.receiveShadow = true;
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(benchD - 0.06, 0.08, benchL - 0.04), foam);
      cushion.position.set(0.02 * sign, seatH + 0.04, 0);
      const back = new THREE.Mesh(new THREE.BoxGeometry(0.08, backH, benchL - 0.02), foam);
      back.position.set(sign * (-benchD / 2 + 0.04), seatH + backH / 2, 0);
      back.userData.role = 'back';
      back.userData.foldSign = sign;
      bench.add(box); bench.add(cushion); bench.add(back);
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
    if (fill.material) { fill.material = fill.material.clone(); fill.material.transparent = true; fill.material.opacity = 0; }
    g.add(top); g.add(ped); g.add(fill);
    g.userData.kind = opts.kind || 'dinette';
    g.userData.funcKind = 'dinette';
    return g;
  }

  makeStairCab(w, h, d) {
    const { THREE, M } = this;
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.madeira);
    body.position.y = h / 2;
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xc4a060, roughness: 0.55 });
    const dw = w * 0.42, dh = Math.max(0.18, h - 0.10), dd = 0.018;
    for (const sx of [-w * 0.22, w * 0.22]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, dd), doorMat);
      door.position.set(sx, h / 2, d / 2 + dd / 2 + 0.002);
      g.add(door);
      const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8), M.aluminioD);
      kn.rotation.x = Math.PI / 2;
      kn.position.set(sx + dw * 0.28, h / 2, d / 2 + dd + 0.012);
      g.add(kn);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, 0.025, d + 0.01), M.madeiraD);
    top.position.y = h + 0.012;
    g.add(top);
    return g;
  }

  build(chassisG) {
    const { THREE, M, BODY_W, Li, Lt, wth, FLOOR_Y, mzFloorH, mzW, mzL, mzInnerZ, mzInnerW, CHASSIS_Y, MATTRESS_CASAL_L } = this;
    const trailer = new THREE.Group();

    const interior = new THREE.Group();
    trailer.add(interior);
    interior.position.y = FLOOR_Y;
    this.group = interior;
    this.interior = interior;

    const wallsInt = new THREE.Group();
    interior.add(wallsInt);
    this.wallsInt = wallsInt;

    const bath = new THREE.Group();
    wallsInt.add(bath);
    this.bath = bath;
    const bw = 0.80;
    const bh = this.WALL_H;
    const bathX0 = -BODY_W / 2 + wth;
    const bathZ0 = -Lt / 2 + wth;
    const bathX1 = bathX0 + bw;
    const bathZ1 = bathZ0 + bw;
    const INT_DOOR_W = 0.55, INT_DOOR_H = 1.70, INT_SILL = 0.02;
    const intDoorZ = bathZ0 + bw / 2;

    const cubBack = this.wall(bw, bh, wth, M.madeiraD);
    cubBack.position.set(bathX0 + bw / 2, bh / 2, bathZ1 - wth / 2);
    bath.add(cubBack);
    const cubFront = this.wall(bw, bh, wth, M.madeiraD);
    cubFront.position.set(bathX0 + bw / 2, bh / 2, bathZ0 + wth / 2);
    bath.add(cubFront);
    const cubLeft = this.wall(wth, bh, bw, M.madeiraD);
    cubLeft.position.set(bathX0 + wth / 2, bh / 2, bathZ0 + bw / 2);
    bath.add(cubLeft);
    const jambL = (bw - INT_DOOR_W) / 2;
    const cubJambL = this.wall(wth, bh, jambL, M.madeiraD);
    cubJambL.position.set(bathX1 - wth / 2, bh / 2, bathZ0 + jambL / 2);
    bath.add(cubJambL);
    const cubJambR = this.wall(wth, bh, jambL, M.madeiraD);
    cubJambR.position.set(bathX1 - wth / 2, bh / 2, bathZ1 - jambL / 2);
    bath.add(cubJambR);
    const cubLintel = this.wall(wth, Math.max(0.08, bh - INT_SILL - INT_DOOR_H), INT_DOOR_W, M.madeiraD);
    cubLintel.position.set(bathX1 - wth / 2, INT_SILL + INT_DOOR_H + (bh - INT_SILL - INT_DOOR_H) / 2, intDoorZ);
    bath.add(cubLintel);
    const cubDoor = this.makeHingedDoor({ w: INT_DOOR_W, h: INT_DOOR_H, open: 0, hingeRight: true });
    cubDoor.position.set(bathX1 - wth / 2, INT_SILL, intDoorZ);
    cubDoor.rotation.y = Math.PI / 2;
    cubDoor.userData.funcKind = 'porta';
    if (cubDoor.userData.hinge) {
      cubDoor.userData.hinge.userData.restY = 0;
      cubDoor.userData.hinge.userData.openY = -1.55;
    }
    bath.add(cubDoor);

    // Teto do banheiro (fecha o vão entre cubBack/Front/Left/Jamb e o telhado).
    const cubCeiling = this.wall(bw, 0.02, bw, M.madeiraD);
    cubCeiling.position.set(bathX0 + bw / 2, bh + 0.01, bathZ0 + bw / 2);
    bath.add(cubCeiling);

    const potti = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), M.vaso);
    potti.position.set(bathX0 + 0.28, 0.21, bathZ0 + 0.28);
    potti.castShadow = true;
    bath.add(potti);
    const pottiLid = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.04, 0.10), M.vaso);
    pottiLid.position.set(bathX0 + 0.28, 0.44, bathZ0 + 0.14);
    bath.add(pottiLid);
    const ducha = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), M.aluminio);
    ducha.position.set(bathX0 + 0.06, 1.20, bathZ0 + 0.40);
    const duchaSpray = new THREE.Mesh(
      new THREE.ConeGeometry(0.09, 0.28, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xa8d8f0, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })
    );
    duchaSpray.position.set(0, -0.18, 0);
    duchaSpray.userData.role = 'spray';
    ducha.add(duchaSpray);
    ducha.userData.funcKind = 'ducha';
    bath.add(ducha);
    const duchaHose = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), M.aluminioD);
    duchaHose.position.set(bathX0 + 0.06, 1.05, bathZ0 + 0.40);
    bath.add(duchaHose);
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.01), M.vidro);
    mirror.position.set(bathX0 + 0.06, 1.15, bathZ0 + 0.62);
    bath.add(mirror);
    const grey = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x3a3a3a, transparent: true, opacity: 0.6 }));
    grey.position.set(-Li / 2 + 0.20, CHASSIS_Y - 0.15, -Lt / 2 + 0.40);
    chassisG.add(grey);

    const kitchen = new THREE.Group();
    interior.add(kitchen);
    this.kitchen = kitchen;
    const kZ = Lt / 2 - 0.16;
    const kX = 0.22;
    const counter = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.85, 0.22), M.madeira);
    counter.position.set(kX, 0.42, kZ);
    counter.castShadow = true; counter.receiveShadow = true;
    kitchen.add(counter);
    const counterTop = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.24), M.vaso);
    counterTop.position.set(kX, 0.86, kZ);
    kitchen.add(counterTop);
    const gel = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.585, 0.22), M.geladeira);
    gel.position.set(kX - 0.14, 0.295, kZ);
    gel.castShadow = true;
    kitchen.add(gel);
    const gelHandle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.02), M.aluminioD);
    gelHandle.position.set(kX - 0.04, 0.30, kZ - 0.14);
    kitchen.add(gelHandle);
    const piaBowl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.10, 16), new THREE.MeshStandardMaterial({ color: 0xa0a0a0, metalness: 0.6, roughness: 0.4 }));
    piaBowl.position.set(kX + 0.18, 0.86, kZ);
    kitchen.add(piaBowl);
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 8), M.aluminio);
    tap.position.set(kX + 0.18, 0.95, kZ + 0.06);
    kitchen.add(tap);
    const tapHead = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.08), M.aluminio);
    tapHead.position.set(kX + 0.18, 1.04, kZ);
    kitchen.add(tapHead);
    const upCab = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.22), M.madeiraD);
    upCab.position.set(kX, 1.52, kZ + 0.02);
    kitchen.add(upCab);
    const freshWater = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.32, 12), new THREE.MeshStandardMaterial({ color: 0x4a8ab0, roughness: 0.6, transparent: true, opacity: 0.7 }));
    freshWater.position.set(kX + 0.28, 0.16, kZ);
    kitchen.add(freshWater);
    const fogIcon = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), M.chassis);
    fogIcon.rotation.x = Math.PI / 2;
    fogIcon.position.set(0.50, 0.85, -Lt / 2 - 0.04);
    kitchen.add(fogIcon);
    const fogIcon2 = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 16), M.chassis);
    fogIcon2.rotation.x = Math.PI / 2;
    fogIcon2.position.set(0.20, 0.85, -Lt / 2 - 0.04);
    kitchen.add(fogIcon2);

    const stairCabs = new THREE.Group();
    interior.add(stairCabs);
    this.stairCabs = stairCabs;
    const N_STEPS = 4;
    const stairW = 0.30;
    const treadD = 0.34;
    const stairRise = (mzFloorH + 0.06 - FLOOR_Y) / N_STEPS;
    const innerWallXp = BODY_W / 2 - wth;
    const stairX = innerWallXp - stairW / 2;
    const stairTreads = [];
    for (let i = 0; i < N_STEPS; i++) {
      const h = (i + 1) * stairRise;
      const z = -Lt / 2 + 0.08 + (N_STEPS - 1 - i) * treadD + treadD / 2;
      const cab = this.makeStairCab(stairW, h, treadD - 0.02);
      cab.position.set(stairX, 0, z);
      cab.userData.name = 'Armário-escada ' + (i + 1);
      cab.userData.matFamily = 'wood';
      cab.userData.kind = 'stair-cab';
      stairCabs.add(cab);
      stairTreads.push({
        minx: stairX - stairW / 2, maxx: stairX + stairW / 2,
        minz: z - treadD / 2, maxz: z + treadD / 2,
        h: h, topWorld: FLOOR_Y + h, top: i === N_STEPS - 1
      });
    }
    const HATCH_X = stairX;
    const HATCH_Z = stairTreads[N_STEPS - 1].minz + treadD / 2;

    const kidBed = this.makeDinetteGroup();
    interior.add(kidBed);
    this.kidBed = kidBed;
    const bedW = 0.99;
    const bedL = 1.60;
    const wallX = -Li / 2 + wth;
    const bedX = wallX + bedW / 2;
    const bedZ = bathZ1 + 0.03 + bedL / 2;
    kidBed.position.set(bedX, 0, bedZ);

    const mezz = new THREE.Group();
    trailer.add(mezz);
    this.mezz = mezz;

    const colTopY = mzFloorH + 0.02;
    const colH = colTopY;
    for (const sx of [-mzW / 2 + 0.05, mzW / 2 - 0.05]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.05, colH, 0.05), M.aluminio);
      col.position.set(sx, colH / 2, -Lt / 2 - 0.05);
      col.castShadow = true;
      mezz.add(col);
    }
    for (const sx of [-mzW / 2 + 0.05, mzW / 2 - 0.05]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.05, colH, 0.05), M.aluminio);
      col.position.set(sx, colH / 2, -Lt / 2 - mzL + 0.05);
      col.castShadow = true;
      mezz.add(col);
    }
    for (const sz of [-Lt / 2 - 0.05, -Lt / 2 - mzL + 0.05]) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(mzW - 0.08, 0.04, 0.05), M.aluminio);
      t.position.set(0, colTopY, sz);
      mezz.add(t);
    }

    const mzInnerWLocal = Li;
    const mzFloor = new THREE.Mesh(new THREE.BoxGeometry(mzInnerWLocal, 0.04, mzL), M.madeira);
    mzFloor.position.set(0, colTopY + 0.02, mzInnerZ);
    mzFloor.castShadow = true; mzFloor.receiveShadow = true;
    mezz.add(mzFloor);

    const casalBed = new THREE.Group();
    mezz.add(casalBed);
    this.casalBed = casalBed;
    casalBed.position.set(0, colTopY + 0.12, mzInnerZ - 0.04);
    const casalMatt = new THREE.Mesh(new THREE.BoxGeometry(mzInnerWLocal - 0.06, 0.10, MATTRESS_CASAL_L - 0.08), M.colchaoC);
    casalMatt.position.set(0, 0, 0);
    casalMatt.castShadow = true;
    casalBed.add(casalMatt);
    casalBed.rotation.y = Math.PI;
    for (const sx of [-mzInnerWLocal / 4, mzInnerWLocal / 4]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(mzInnerWLocal / 2 - 0.06, 0.10, 0.35), M.travesseiro);
      p.position.set(sx, 0.10, MATTRESS_CASAL_L / 2 - 0.20);
      casalBed.add(p);
    }
    const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, mzW - 0.10, 8), new THREE.MeshStandardMaterial({ color: 0xaa0000, metalness: 0.7 }));
    guard.rotation.z = Math.PI / 2;
    guard.position.set(0, colTopY + 0.30, -Lt / 2 - mzL + 0.10);
    mezz.add(guard);

    return {
      group: trailer, interior, wallsInt, bath, kitchen, stairCabs, mezz,
      kidBed, casalBed, mzFloor, guard, colTopY,
      kX, kZ, bedX, bedZ, stairX, HATCH_Z,
      gel, gelHandle, piaBowl, tap, tapHead, upCab, freshWater,
      fogIcon, fogIcon2, potti, pottiLid, ducha, mirror,
      counter, counterTop, cubDoor
    };
  }
}
