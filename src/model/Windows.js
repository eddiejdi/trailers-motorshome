/**
 * Windows — factory de geometria de janela RV (paleta).
 * Nenhuma janela de projeto é criada aqui; só makeRvWindow(w,h).
 */
export default class Windows {
  constructor(THREE, M, dims = {}) {
    this.THREE = THREE;
    this.M = M;
    // dims opcionais (legado); não usados para layout
    Object.assign(this, dims);
    this.windowMeshes = [];
    this.windowGroups = [];
    this.sky = null;
    this.mzSky = null;
  }

  _roundedRectShape(w, h, r) {
    const { THREE } = this;
    const s = new THREE.Shape();
    const x0 = -w / 2, y0 = -h / 2;
    const x1 = w / 2, y1 = h / 2;
    r = Math.max(0.001, Math.min(r, Math.min(w, h) / 2));
    s.moveTo(x0 + r, y0);
    s.lineTo(x1 - r, y0);
    s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r);
    s.quadraticCurveTo(x1, y1, x1 - r, y1);
    s.lineTo(x0 + r, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - r);
    s.lineTo(x0, y0 + r);
    s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }

  /**
   * Geometria genérica de janela (objeto de paleta).
   * w,h em metros (vão de vidro). r>0 → cantos arredondados.
   */
  makeRvWindow(w = 0.50, h = 0.50, r = 0) {
    const { THREE, M } = this;
    w = Math.max(0.15, Number(w) || 0.50);
    h = Math.max(0.15, Number(h) || 0.50);
    const g = new THREE.Group();
    const t = 0.028;
    const d = 0.036;
    r = Math.max(0, Number(r) || 0);

    if (r > 0) {
      // Moldura retangular com cantos arredondados: extrude do anel externo/interno
      const outer = this._roundedRectShape(w + t * 2, h + t * 2, r + t);
      const inner = this._roundedRectShape(w, h, r);
      outer.holes.push(inner);
      const frameGeo = new THREE.ExtrudeGeometry(outer, {
        depth: d,
        bevelEnabled: false,
        curveSegments: 8,
      });
      frameGeo.translate(0, 0, -d / 2);
      const frame = new THREE.Mesh(frameGeo, M.aluminioD);
      frame.castShadow = true;
      const glassGeo = new THREE.ShapeGeometry(this._roundedRectShape(w, h, r), 8);
      const glassMat = M.vidro.clone ? M.vidro.clone() : M.vidro;
      if (glassMat.side !== undefined) glassMat.side = THREE.DoubleSide;
      const glass = new THREE.Mesh(glassGeo, glassMat);
      const sash = new THREE.Group();
      sash.add(glass);
      sash.userData.role = 'sash';
      g.add(frame, sash);
    } else {
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
      g.add(top, bot, left, right, sash);
    }
    g.userData.glassW = w;
    g.userData.glassH = h;
    g.userData.winW = w;
    g.userData.winH = h;
    g.userData.funcKind = 'janela';
    g.userData.kind = 'janela';
    g.userData.editable = true;
    g.userData.collider = true;
    g.userData.fromPalette = true;
    return g;
  }

  /** Sem layout de projeto — janelas só via paleta/JSON. */
  build() {
    this.windowMeshes = [];
    this.windowGroups = [];
    this.sky = null;
    this.mzSky = null;
    return {
      windowMeshes: this.windowMeshes,
      sky: null,
      mzSky: null,
      winLCuts: [],
      winRCuts: [],
    };
  }
}
