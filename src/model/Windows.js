export default class Windows {
  constructor(THREE, M, { BODY_W, wth, Lt, WALL_H, roofTop, roofY, zRoofFront, zRoofRear, mzFloorH, mzWallY0, mzInnerZ, mzInnerW, colTopY, mzW }) {
    this.THREE = THREE;
    this.M = M;
    this.BODY_W = BODY_W;
    this.wth = wth;
    this.Lt = Lt;
    this.WALL_H = WALL_H;
    this.roofTop = roofTop;
    this.roofY = roofY;
    this.zRoofFront = zRoofFront;
    this.zRoofRear = zRoofRear;
    this.mzFloorH = mzFloorH;
    this.mzWallY0 = mzWallY0;
    this.mzInnerZ = mzInnerZ;
    this.mzInnerW = mzInnerW;
    this.colTopY = colTopY;
    this.mzW = mzW;
    this.windowMeshes = [];
    this.sky = null;
    this.mzSky = null;
  }

  makeRvWindow(w, h) {
    const { THREE, M } = this;
    const g = new THREE.Group();
    const t = 0.028, d = 0.036;
    const top = new THREE.Mesh(new THREE.BoxGeometry(w + t * 2, t, d), M.aluminioD);
    top.position.y = h / 2 + t / 2;
    const bot = new THREE.Mesh(new THREE.BoxGeometry(w + t * 2, t, d), M.aluminioD);
    bot.position.y = -h / 2 - t / 2;
    const left = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), M.aluminioD);
    left.position.x = -w / 2 - t / 2;
    const right = new THREE.Mesh(new THREE.BoxGeometry(t, h, d), M.aluminioD);
    right.position.x = w / 2 + t / 2;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), M.vidro);
    const sash = new THREE.Group();
    sash.position.x = -w / 2;
    glass.position.x = w / 2;
    sash.add(glass);
    sash.userData.role = 'sash';
    g.add(top); g.add(bot); g.add(left); g.add(right); g.add(sash);
    g.userData.glassW = w; g.userData.glassH = h;
    g.userData.funcKind = 'janela';
    return g;
  }

  janela(wallsExt, w, h, x, y, z, ry, nome) {
    const g = this.makeRvWindow(w, h);
    g.position.set(x, y, z);
    g.rotation.y = ry || 0;
    wallsExt.add(g);
    g.userData.winName = nome || 'Janela';
    this.windowMeshes.push(g);
    return g;
  }

  mzJanela(mezz, w, h, x, y, z, ry, nome) {
    const g = this.makeRvWindow(w, h);
    g.position.set(x, y, z);
    g.rotation.y = ry || 0;
    mezz.add(g);
    g.userData.winName = nome || 'Janela mezanino';
    this.windowMeshes.push(g);
    return g;
  }

  build(wallsExt, wallG, mezz) {
    const { THREE, M, BODY_W, wth, Lt, roofTop, mzInnerZ, mzInnerW, colTopY, mzW, zRoofFront, WALL_H } = this;

    const DOOR_W = 0.62, DOOR_H = 1.60, DOOR_SILL = 0.08;
    const DOOR_Z = Lt / 2 - 0.52;
    const doorZ0 = DOOR_Z - DOOR_W / 2, doorZ1 = DOOR_Z + DOOR_W / 2;
    const winCut = (z, y, w, h) => ({ z0: z - w / 2, z1: z + w / 2, y0: y - h / 2, y1: y + h / 2 });
    const winLCuts = [winCut(0.20, 1.20, 0.50, 0.50), winCut(0.95, 1.20, 0.50, 0.50)];
    const winRCuts = [
      { z0: doorZ0, z1: doorZ1, y0: DOOR_SILL, y1: DOOR_SILL + DOOR_H },
      winCut(-0.35, 1.20, 0.50, 0.50),
      winCut(0.85, 1.20, 0.50, 0.50),
    ];

    this.janela(wallsExt, 0.50, 0.50, -BODY_W / 2 + wth / 2, 1.20, 0.20, -Math.PI / 2, 'Janela esquerda 1');
    this.janela(wallsExt, 0.50, 0.50, -BODY_W / 2 + wth / 2, 1.20, 0.95, -Math.PI / 2, 'Janela esquerda 2');
    this.janela(wallsExt, 0.50, 0.50, BODY_W / 2 - wth / 2, 1.20, -0.35, Math.PI / 2, 'Janela direita 1');
    this.janela(wallsExt, 0.50, 0.50, BODY_W / 2 - wth / 2, 1.20, 0.85, Math.PI / 2, 'Janela direita 2');
    this.janela(wallsExt, 0.80, 0.50, 0, 1.20, Lt / 2 - wth / 2, 0, 'Janela traseira');
    this.janela(wallsExt, 0.70, 0.32, 0, 0.32, -Lt / 2 + wth / 2, Math.PI, 'Janela frontal');

    const sky = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.04, 0.40), M.vidro);
    sky.position.set(0, roofTop(0.4) + 0.02, 0.4);
    wallG.add(sky);
    this.sky = sky;

    this.mzJanela(mezz, 0.50, 0.40, -BODY_W / 2 + 0.012, colTopY + 0.60, mzInnerZ, Math.PI / 2, 'Janela mez. esquerda');
    this.mzJanela(mezz, 0.50, 0.40, BODY_W / 2 - 0.012, colTopY + 0.60, mzInnerZ, -Math.PI / 2, 'Janela mez. direita');
    this.mzJanela(mezz, 0.80, 0.45, 0, colTopY + 0.70, zRoofFront + wth / 2, Math.PI, 'Janela mez. frontal');

    const mzSky = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.04, 0.30), M.vidro);
    mzSky.position.set(0, roofTop(0) + 0.03, 0);
    wallG.add(mzSky);
    this.mzSky = mzSky;

    return { windowMeshes: this.windowMeshes, sky, mzSky, winLCuts, winRCuts };
  }
}
