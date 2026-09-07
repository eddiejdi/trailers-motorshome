const THREE = window.THREE;

const UP = new THREE.Vector3(0, 1, 0);

// Estilo visual de cada tipo de ligação (tubo + marcador de fluxo).
const LINK_STYLES = {
  water:  { color: 0x2f9fe0, radius: 0.010, marker: 0x8fdcff, speed: 0.22, markers: 2 },
  drain:  { color: 0x45584e, radius: 0.014, marker: 0x86a58f, speed: 0.09, markers: 2 },
  sewage: { color: 0x4b3621, radius: 0.015, marker: 0x9a7a52, speed: 0.06, markers: 2 },
  elec:   { color: 0xf2b93b, radius: 0.006, marker: 0xffe59b, speed: 0.55, markers: 3 },
};

const TYPES = ['water', 'drain', 'sewage', 'elec'];

// "Inteligência" das ligações: cada item declara o que precisa e o serviço
// conecta ao ponto mais próximo (tanque de água limpa, tanque cinza, quadro).
export function linkNeedsOf(obj) {
  if (!obj || !obj.userData) return null;
  const u = obj.userData;
  const kind = String(u.kind || u.funcKind || '').toLowerCase();
  const name = String(u.name || '').toLowerCase();
  if (kind === 'boiler' || name.indexOf('boiler') >= 0) return { water: true, elec: true };
  if (kind === 'clima-evap' || name.indexOf('climatiz') >= 0 || name.indexOf('evap') >= 0) return { water: true, elec: true };
  if (kind === 'pia' || name.indexOf('pia') >= 0 || name.indexOf('torneira') >= 0) return { water: true, drain: true };
  if (kind === 'ducha' || kind === 'ducha-ext' || name.indexOf('ducha') >= 0 || name.indexOf('chuveiro') >= 0) return { water: true, drain: true };
  if (kind === 'potti' || name.indexOf('potti') >= 0 || name.indexOf('vaso') >= 0 || name.indexOf('sanit') >= 0) return { sewage: true };
  if (kind === 'plafon' || kind === 'led-strip' || kind === 'spot-led' ||
      kind === 'exaustor' || kind.indexOf('exaustor') === 0 || kind === 'vent-exaust' ||
      kind === 'entrada-cabos' || kind === 'geladeira' ||
      kind === 'ac-teto' || kind === 'ac-portatil') return { elec: true };
  return null;
}

export default class ConnectionService {
  constructor({ scene, trailer, editableMeshes, waterTank, greyTank,
    FLOOR_Y, Li, Lt, BODY_W, wth }) {
    this.scene = scene;
    this.trailer = trailer;
    this.editableMeshes = editableMeshes || [];
    this.waterTank = waterTank || null;
    this.greyTank = greyTank || null;
    this.FLOOR_Y = FLOOR_Y || 0;
    this.Li = Li;
    this.Lt = Lt;
    this.BODY_W = BODY_W;
    this.wth = wth;

    this._hx = (Li / 2) - Math.max(0.10, wth || 0.06);
    this._hz = (Lt / 2) - Math.max(0.10, wth || 0.06);
    this._timer = 0;
    this._t = 0;
    this.conns = new Map();

    this.pipes = new THREE.Group();
    this.pipes.name = 'connections-pipes';
    this.scene.add(this.pipes);

    this.markers = new THREE.Group();
    this.markers.name = 'connections-markers';
    this.scene.add(this.markers);

    // Geometria/material compartilhados dos marcadores de fluxo.
    this._markerGeo = new THREE.ConeGeometry(0.020, 0.065, 6);
    this._markerMats = {};
    this._pipeMats = {};
    TYPES.forEach((t) => {
      const s = LINK_STYLES[t];
      this._markerMats[t] = new THREE.MeshBasicMaterial({ color: s.marker });
      this._pipeMats[t] = new THREE.MeshStandardMaterial({
        color: s.color, roughness: 0.45, metalness: 0.35,
      });
    });

    this._rebuild();
  }

  setVisible(v) {
    this.pipes.visible = !!v;
    this.markers.visible = !!v;
  }

  update(dt) {
    this._t += dt;
    this._timer += dt;
    if (this._timer >= 0.5) {
      this._timer = 0;
      this._rebuild();
    }
    for (const conn of this.conns.values()) {
      const style = LINK_STYLES[conn.type];
      for (let i = 0; i < conn.markers.length; i++) {
        const m = conn.markers[i];
        let u = (this._t * style.speed + i / conn.markers.length) % 1;
        if (u < 0) u += 1;
        const at = this._pointAt(conn.pts, conn.lengths, conn.total, u);
        m.position.copy(at.p);
        if (at.dir && at.dir.lengthSq() > 1e-6) {
          m.quaternion.setFromUnitVectors(UP, at.dir.clone().normalize());
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  _rebuild() {
    if (this.trailer) this.trailer.updateMatrixWorld(true);
    const desired = this._collect();
    const next = new Map();
    for (const [key, d] of desired) {
      let conn = this.conns.get(key);
      if (conn && !this._samePts(conn.pts, d.pts)) {
        this._disposeSegs(conn);
        conn.pts = d.pts;
        conn.segs = this._createSegs(d.pts, d.type);
        this._recomputeLengths(conn);
      }
      if (!conn) {
        conn = {
          key, type: d.type, pts: d.pts,
          segs: this._createSegs(d.pts, d.type),
          markers: this._createMarkers(d.type),
        };
        this._recomputeLengths(conn);
      }
      next.set(key, conn);
    }
    for (const [key, conn] of this.conns) {
      if (!desired.has(key)) this._disposeConn(conn);
    }
    this.conns = next;
  }

  // Monta a lista desejada: item → pares (fonte/destino) e caminho em L.
  _collect() {
    const anchors = this._anchors();
    const out = new Map();
    for (const obj of this.editableMeshes) {
      if (!obj || !obj.parent) continue;
      const needs = linkNeedsOf(obj);
      if (!needs) continue;
      const cp = this._connPoint(obj);
      for (const type of TYPES) {
        if (!needs[type]) continue;
        const pair = this._pair(type, cp, anchors);
        if (!pair) continue;
        const runY = this._runY(type);
        const pts = this._route(pair[0], pair[1], runY);
        const key = obj.uuid + '::' + type;
        out.set(key, { type, pts });
      }
    }
    return out;
  }

  _anchors() {
    const tp = new THREE.Vector3();
    const tank = this._placedWaterTank();
    if (tank) tank.getWorldPosition(tp);
    else if (this.waterTank) this.waterTank.getWorldPosition(tp);
    tp.y += 0.20; // topo do tanque/caixa de água limpa
    const gp = new THREE.Vector3();
    if (this.greyTank) this.greyTank.getWorldPosition(gp);
    gp.y += 0.18; // boca do tanque cinza

    let elec = null;
    for (let i = 0; i < this.editableMeshes.length; i++) {
      const m = this.editableMeshes[i];
      const k = m && m.userData && (m.userData.kind || m.userData.funcKind);
      if (k === 'quadro' || k === 'painel-dj') { elec = m; break; }
    }
    const ep = new THREE.Vector3();
    if (elec) elec.getWorldPosition(ep);
    else ep.set(0.35, this.FLOOR_Y + 0.15, this.Lt / 2 - 0.55); // ponto do "barramento"

    return { water: tp, grey: gp, elec: ep };
  }

  // Se o usuário colocou um tanque/caixa de água na paleta, ele vira a fonte.
  _placedWaterTank() {
    const waterKinds = /^(tanque|tanque-agua|caixa-agua|reservatorio|water-tank)/;
    for (let i = 0; i < this.editableMeshes.length; i++) {
      const m = this.editableMeshes[i];
      const k = m && m.userData && (m.userData.kind || m.userData.funcKind);
      if (!k) continue;
      if (waterKinds.test(String(k).toLowerCase())) return m;
    }
    return null;
  }

  _pair(type, cp, anchors) {
    if (type === 'water') return [anchors.water, cp.bot];
    if (type === 'drain' || type === 'sewage') return [cp.bot, anchors.grey];
    if (type === 'elec') return [anchors.elec, cp.bot];
    return null;
  }

  _runY(type) {
    // água/esgoto correm sob o assoalho; elétrica na rodapé.
    if (type === 'elec') return this.FLOOR_Y + 0.12;
    return this.FLOOR_Y - 0.12;
  }

  _connPoint(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3();
    box.getCenter(c);
    const bot = new THREE.Vector3(c.x, box.min.y + 0.02, c.z);
    return { center: c, bot };
  }

  // Caminho realista em L: desce do item, corre na altura do cano, sobe no destino.
  _route(a, b, runY) {
    const m = 0;
    const pts = [
      a.clone(),
      this._clampPt(new THREE.Vector3(a.x, runY, a.z), m),
      this._clampPt(new THREE.Vector3(b.x, runY, a.z), m),
      this._clampPt(new THREE.Vector3(b.x, runY, b.z), m),
      b.clone(),
    ];
    return pts;
  }

  _clampPt(p, m) {
    p.x = Math.max(-this._hx + m, Math.min(this._hx - m, p.x));
    p.z = Math.max(-this._hz + m, Math.min(this._hz - m, p.z));
    return p;
  }

  _createSegs(pts, type) {
    const segs = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 0.001) continue;
      const geo = new THREE.CylinderGeometry(LINK_STYLES[type].radius, LINK_STYLES[type].radius, len, 8, 1);
      const mesh = new THREE.Mesh(geo, this._pipeMats[type]);
      mesh.position.lerpVectors(a, b, 0.5);
      mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
      mesh.userData.linkType = type;
      this.pipes.add(mesh);
      segs.push(mesh);
    }
    return segs;
  }

  _createMarkers(type) {
    const list = [];
    const n = LINK_STYLES[type].markers;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this._markerGeo, this._markerMats[type]);
      m.userData.linkType = type;
      this.markers.add(m);
      list.push(m);
    }
    return list;
  }

  _recomputeLengths(conn) {
    conn.lengths = [];
    conn.total = 0;
    for (let i = 0; i < conn.pts.length - 1; i++) {
      const len = conn.pts[i].distanceTo(conn.pts[i + 1]);
      conn.lengths.push(len);
      conn.total += len;
    }
  }

  _samePts(a, b) {
    if (!a || !b || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (Math.abs(a[i].x - b[i].x) > 1e-3 ||
          Math.abs(a[i].y - b[i].y) > 1e-3 ||
          Math.abs(a[i].z - b[i].z) > 1e-3) return false;
    }
    return true;
  }

  _pointAt(pts, lengths, total, u) {
    if (total <= 1e-6) return { p: pts[0].clone(), dir: null };
    let t = u * total;
    for (let i = 0; i < lengths.length; i++) {
      if (t <= lengths[i]) {
        const f = lengths[i] > 1e-6 ? t / lengths[i] : 0;
        const p = new THREE.Vector3().lerpVectors(pts[i], pts[i + 1], f);
        const dir = new THREE.Vector3().subVectors(pts[i + 1], pts[i]).normalize();
        return { p, dir };
      }
      t -= lengths[i];
    }
    const last = pts[pts.length - 1];
    const prev = pts.length > 1 ? pts[pts.length - 2] : last;
    return { p: last.clone(), dir: new THREE.Vector3().subVectors(last, prev).normalize() };
  }

  _disposeSegs(conn) {
    if (!conn || !conn.segs) return;
    conn.segs.forEach((m) => {
      this.pipes.remove(m);
      if (m.geometry) m.geometry.dispose();
    });
    conn.segs = [];
  }

  _disposeConn(conn) {
    this._disposeSegs(conn);
    if (conn && conn.markers) {
      conn.markers.forEach((m) => this.markers.remove(m));
      conn.markers = [];
    }
  }
}