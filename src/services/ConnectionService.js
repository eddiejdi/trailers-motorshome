/**
 * ConnectionService — auto-connect água / esgoto / 12V / 220V / solar.
 *
 * Fonte de verdade (nesta ordem):
 *   1) mesh.userData.utilities (carimbo do palette no spawn)
 *   2) data/palette-catalog.json → item.utilities
 *   3) data/utilities-network.json → kindNeeds / kindSupplies / hubs
 *
 * O JS só interpreta JSON — sem decisão de projeto embutida.
 */
const THREE = window.THREE;
const UP = new THREE.Vector3(0, 1, 0);
const NET_URL = 'data/utilities-network.json';

function parseColor(c) {
  if (typeof c === 'number') return c;
  if (typeof c === 'string') return parseInt(c, 16) || 0x888888;
  return 0x888888;
}

function prefixMatch(kind, prefixes) {
  if (!kind || !prefixes || !prefixes.length) return false;
  const k = String(kind).toLowerCase();
  return prefixes.some((p) => k === p || k.indexOf(String(p).toLowerCase()) === 0);
}

export default class ConnectionService {
  constructor({ scene, trailer, editableMeshes, waterTank, greyTank,
    FLOOR_Y, Li, Lt, BODY_W, wth, catalog, networkSpec }) {
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
    this.catalog = catalog || null;

    this._hx = (Li / 2) - Math.max(0.10, wth || 0.06);
    this._hz = (Lt / 2) - Math.max(0.10, wth || 0.06);
    this._timer = 0;
    this._t = 0;
    this.conns = new Map();
    this._visible = {};
    this._ready = false;

    this.pipes = new THREE.Group();
    this.pipes.name = 'connections-pipes';
    this.markers = new THREE.Group();
    this.markers.name = 'connections-markers';
    // fios no frame do trailer (coords trailer-world), não na scene root
    const root = this.trailer || this.scene;
    if (root) {
      root.add(this.pipes);
      root.add(this.markers);
    }

    this._markerGeo = new THREE.ConeGeometry(0.020, 0.065, 6);
    this._markerMats = {};
    this._pipeMats = {};
    this._styles = {};
    this._types = [];
    this._spec = null;

    if (networkSpec) this.applyNetworkSpec(networkSpec);
    else this.loadNetworkSpec();
  }

  async loadNetworkSpec(url = NET_URL) {
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
      const spec = await resp.json();
      this.applyNetworkSpec(spec);
      return true;
    } catch (e) {
      console.error('[utilities-network] falha ao carregar', e);
      // fallback mínimo para não quebrar a cena
      this.applyNetworkSpec({
        media: {
          water: { color: '0x2f9fe0', marker: '0x8fdcff', radius: 0.01, speed: 0.22, markers: 2, runYOffset: -0.12, flow: 'hub_to_sink', layer: 'encanamento' },
          elec12: { color: '0xe8a020', marker: '0xffd27a', radius: 0.006, speed: 0.55, markers: 3, runYOffset: 0.1, flow: 'hub_to_sink', layer: 'eletrica' },
        },
        hubs: {},
        sources: {},
        kindNeeds: {},
        kindSupplies: {},
        layers: { encanamento: ['water'], eletrica: ['elec12'] },
        routing: { rebuildIntervalSec: 0.5 },
      });
      return false;
    }
  }

  applyNetworkSpec(spec) {
    this._spec = spec || {};
    const media = this._spec.media || {};
    this._types = Object.keys(media);
    this._styles = {};
    this._types.forEach((t) => {
      const m = media[t] || {};
      this._styles[t] = {
        color: parseColor(m.color),
        marker: parseColor(m.marker),
        radius: Number(m.radius) || 0.008,
        speed: Number(m.speed) || 0.3,
        markers: Number(m.markers) || 2,
        runYOffset: m.runYOffset != null ? Number(m.runYOffset) : 0.1,
        runY: m.runY || 'baseboard',
        flow: m.flow || 'hub_to_sink',
        layer: m.layer || 'eletrica',
        generateFromSupplies: !!m.generateFromSupplies,
      };
      if (!this._pipeMats[t]) {
        this._pipeMats[t] = new THREE.MeshStandardMaterial({
          color: this._styles[t].color, roughness: 0.45, metalness: 0.35,
        });
      } else {
        this._pipeMats[t].color.setHex(this._styles[t].color);
      }
      if (!this._markerMats[t]) {
        this._markerMats[t] = new THREE.MeshBasicMaterial({ color: this._styles[t].marker });
      } else {
        this._markerMats[t].color.setHex(this._styles[t].marker);
      }
      if (this._visible[t] == null) this._visible[t] = true;
    });
    this._ready = true;
    this._rebuild();
  }

  setCatalog(catalog) {
    this.catalog = catalog || null;
  }

  setVisible(v) {
    const on = !!v;
    this._types.forEach((t) => { this._visible[t] = on; });
    this._applyVisibility();
  }

  setLayerVisible(layer, v) {
    const on = !!v;
    const layers = (this._spec && this._spec.layers) || {};
    if (layer === 'all') {
      this._types.forEach((t) => { this._visible[t] = on; });
    } else if (layers[layer]) {
      layers[layer].forEach((t) => { this._visible[t] = on; });
    } else if (this._visible[layer] != null) {
      this._visible[layer] = on;
    }
    this._applyVisibility();
  }

  _applyVisibility() {
    this.pipes.children.forEach((m) => {
      const t = m.userData && m.userData.linkType;
      m.visible = !t || !!this._visible[t];
    });
    this.markers.children.forEach((m) => {
      const t = m.userData && m.userData.linkType;
      m.visible = !t || !!this._visible[t];
    });
    const any = this._types.some((t) => this._visible[t]);
    this.pipes.visible = any;
    this.markers.visible = any;
  }

  invalidate() {
    this._timer = 1;
  }

  update(dt) {
    if (!this._ready) return;
    this._t += dt;
    this._timer += dt;
    const iv = (this._spec && this._spec.routing && this._spec.routing.rebuildIntervalSec) || 0.5;
    if (this._timer >= iv) {
      this._timer = 0;
      this._rebuild();
    }
    for (const conn of this.conns.values()) {
      const style = this._styles[conn.type];
      if (!style) continue;
      for (let i = 0; i < conn.markers.length; i++) {
        const m = conn.markers[i];
        let u = (this._t * style.speed + i / Math.max(1, conn.markers.length)) % 1;
        if (u < 0) u += 1;
        const at = this._pointAt(conn.pts, conn.lengths, conn.total, u);
        m.position.copy(at.p);
        if (at.dir && at.dir.lengthSq() > 1e-6) {
          m.quaternion.setFromUnitVectors(UP, at.dir.clone().normalize());
        }
      }
    }
  }

  // ── needs / supplies ──────────────────────────────────────────

  _alias(t) {
    const a = (this._spec && this._spec.aliases) || {};
    return a[t] || t;
  }

  _needsList(obj) {
    if (!obj || !obj.userData) return [];
    const u = obj.userData;
    const kind = String(u.kind || u.funcKind || '');
    // 1) mesh stamp
    if (u.utilities && Array.isArray(u.utilities.needs) && u.utilities.needs.length) {
      return u.utilities.needs.map((t) => this._alias(t)).filter((t) => this._styles[t]);
    }
    // 2) palette catalog
    if (this.catalog && this.catalog.items) {
      const item = this.catalog.items.find((i) => i.kind === kind);
      if (item && item.utilities && Array.isArray(item.utilities.needs) && item.utilities.needs.length) {
        return item.utilities.needs.map((t) => this._alias(t)).filter((t) => this._styles[t]);
      }
    }
    // 3) utilities-network.json kindNeeds
    const kn = (this._spec && this._spec.kindNeeds) || {};
    if (kn[kind]) return kn[kind].map((t) => this._alias(t)).filter((t) => this._styles[t]);
    return [];
  }

  _suppliesList(obj) {
    if (!obj || !obj.userData) return [];
    const u = obj.userData;
    const kind = String(u.kind || u.funcKind || '');
    if (u.utilities && Array.isArray(u.utilities.supplies) && u.utilities.supplies.length) {
      return u.utilities.supplies.map((t) => this._alias(t)).filter((t) => this._styles[t]);
    }
    if (this.catalog && this.catalog.items) {
      const item = this.catalog.items.find((i) => i.kind === kind);
      if (item && item.utilities && Array.isArray(item.utilities.supplies) && item.utilities.supplies.length) {
        return item.utilities.supplies.map((t) => this._alias(t)).filter((t) => this._styles[t]);
      }
    }
    const ks = (this._spec && this._spec.kindSupplies) || {};
    if (ks[kind]) return ks[kind].map((t) => this._alias(t)).filter((t) => this._styles[t]);
    return [];
  }

  _itemUtilities(obj) {
    if (!obj || !obj.userData) return null;
    if (obj.userData.utilities) return obj.userData.utilities;
    const kind = obj.userData.kind;
    if (this.catalog && this.catalog.items) {
      const item = this.catalog.items.find((i) => i.kind === kind);
      if (item && item.utilities) return item.utilities;
    }
    return null;
  }

  // ── graph rebuild ─────────────────────────────────────────────

  _rebuild() {
    if (!this._ready) return;
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
    this._applyVisibility();
  }

  _collect() {
    const hubs = this._hubs();
    const out = new Map();

    // sinks (needs) → hub
    for (const obj of this.editableMeshes) {
      if (!obj || !obj.parent) continue;
      const needs = this._needsList(obj);
      if (!needs.length) continue;
      const cp = this._connPoint(obj);
      for (const type of needs) {
        const hub = this._nearestHub(type, cp.bot, hubs, obj);
        if (!hub) continue;
        const pair = this._pair(type, cp, hub);
        if (!pair) continue;
        pair[0] = this._clampPt(pair[0].clone(), 0);
        pair[1] = this._clampPt(pair[1].clone(), 0);
        const runY = this._runY(type, pair[0], pair[1]);
        const pts = this._route(pair[0], pair[1], runY);
        out.set(obj.uuid + '::' + type + '::need', { type, pts });
      }
    }

    // generation: supplies with generateFromSupplies → hub
    for (const obj of this.editableMeshes) {
      if (!obj || !obj.parent || !obj.userData) continue;
      const supplies = this._suppliesList(obj);
      for (const type of supplies) {
        const st = this._styles[type];
        if (!st || !st.generateFromSupplies) continue;
        const srcCfg = (this._spec && this._spec.sources && this._spec.sources[type]) || {};
        const kind = String(obj.userData.kind || '').toLowerCase();
        if (srcCfg.kindPrefix && srcCfg.kindPrefix.length && !prefixMatch(kind, srcCfg.kindPrefix) && supplies.indexOf(type) < 0) {
          continue;
        }
        const cp = this._connPoint(obj);
        const hub = this._nearestHub(type, cp.bot, hubs, obj);
        if (!hub) continue;
        const a = this._clampPt(cp.bot.clone(), 0);
        const b = this._clampPt(hub.p.clone(), 0);
        const pts = this._route(a, b, this._runY(type, a, b));
        out.set(obj.uuid + '::' + type + '::gen', { type, pts });
      }
    }
    return out;
  }

  _hubs() {
    const list = {};
    this._types.forEach((t) => { list[t] = []; });
    const hubCfg = (this._spec && this._spec.hubs) || {};

    const push = (type, mesh, boostY) => {
      if (!list[type]) return;
      const p = new THREE.Vector3();
      mesh.updateWorldMatrix(true, false);
      mesh.getWorldPosition(p);
      const util = this._itemUtilities(mesh);
      if (util && Array.isArray(util.ports)) {
        const port = util.ports.find((pt) => {
          const med = this._alias(pt.media);
          return med === type;
        });
        if (port && Array.isArray(port.local) && mesh.localToWorld) {
          const lp = new THREE.Vector3(port.local[0] || 0, port.local[1] || 0, port.local[2] || 0);
          mesh.localToWorld(lp);
          p.copy(lp);
        } else {
          p.y += boostY || 0.05;
        }
      } else {
        p.y += boostY || 0.05;
      }
      // pipes no trailer → hub em coords locais
      const local = this._toLocal(p);
      this._clampPt(local, 0);
      if (!list[type].some((h) => h.mesh === mesh)) list[type].push({ mesh, p: local });
    };

    for (let i = 0; i < this.editableMeshes.length; i++) {
      const m = this.editableMeshes[i];
      if (!m || !m.userData) continue;
      const kind = String(m.userData.kind || m.userData.funcKind || '').toLowerCase();
      const util = this._itemUtilities(m);

      // by hub kindPrefix
      Object.keys(hubCfg).forEach((type) => {
        const cfg = hubCfg[type] || {};
        if (prefixMatch(kind, cfg.kindPrefix)) {
          push(type, m, cfg.boostY);
        }
        if (cfg.alsoIfNeeds && util && Array.isArray(util.needs)) {
          const needs = util.needs.map((t) => this._alias(t));
          if (cfg.alsoIfNeeds.some((n) => needs.indexOf(this._alias(n)) >= 0)) {
            push(type, m, cfg.boostY);
          }
        }
      });

      // supplies → hub (exceto generateFromSupplies: painel solar não é hub de carga)
      const supplies = this._suppliesList(m);
      supplies.forEach((t) => {
        const st = this._styles[t];
        if (st && st.generateFromSupplies) return;
        const cfg = hubCfg[t] || {};
        push(t, m, cfg.boostY != null ? cfg.boostY : 0.1);
      });
    }

    if (!list.water || !list.water.length) {
      if (this.waterTank) {
        const p = new THREE.Vector3();
        this.waterTank.getWorldPosition(p);
        p.y += 0.20;
        list.water = list.water || [];
        list.water.push({ mesh: this.waterTank, p });
      }
    }
    if ((!list.drain || !list.drain.length) && this.greyTank) {
      const p = new THREE.Vector3();
      this.greyTank.getWorldPosition(p);
      p.y += 0.18;
      list.drain = list.drain || [];
      list.sewage = list.sewage || [];
      list.drain.push({ mesh: this.greyTank, p });
      list.sewage.push({ mesh: this.greyTank, p });
    }
    if ((!list.elec12 || !list.elec12.length)) {
      list.elec12 = list.elec12 || [];
      list.elec12.push({
        mesh: null,
        p: new THREE.Vector3(0.35, this.FLOOR_Y + 0.15, (this.Lt || 2.9) / 2 - 0.55),
      });
    }
    return list;
  }

  _nearestHub(type, from, hubs, selfMesh) {
    const arr = hubs[type] || [];
    if (!arr.length) return null;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < arr.length; i++) {
      if (selfMesh && arr[i].mesh === selfMesh) continue;
      const d = from.distanceToSquared(arr[i].p);
      if (d < bestD) { bestD = d; best = arr[i]; }
    }
    return best;
  }

  _pair(type, cp, hub) {
    if (!hub || !hub.p) return null;
    const st = this._styles[type] || {};
    const flow = st.flow || 'hub_to_sink';
    if (flow === 'sink_to_hub') return [cp.bot.clone(), hub.p.clone()];
    if (flow === 'source_to_hub') return [cp.bot.clone(), hub.p.clone()];
    return [hub.p.clone(), cp.bot.clone()]; // hub_to_sink
  }

  /* ── geometry helpers (trailer-local) ─────────────────────────── */

  _r() { return (this._spec && this._spec.routing) || {}; }

  _wallInset() {
    const r = this._r();
    return Math.max(0.05, (this.wth || 0.015) + (r.wallInset != null ? Number(r.wallInset) : 0.035));
  }

  _wallX(side) {
    const inset = this._wallInset();
    const half = (this.BODY_W || 1.9) / 2;
    // face interna + folga para o cabo não sair da casca
    return side === 'left' ? -(half - inset) : (half - inset);
  }

  _sideX(x) {
    return Math.abs(x - this._wallX('left')) <= Math.abs(x - this._wallX('right')) ? 'left' : 'right';
  }

  _mezzY() {
    const r = this._r();
    return r.mezzFloorY != null ? Number(r.mezzFloorY) : ((this.FLOOR_Y || 0) + 0.82);
  }

  /** Z do bulkhead sala↔mez (parede maderite). */
  _bulkZ() {
    const r = this._r();
    return r.bulkheadZ != null ? Number(r.bulkheadZ) : -1.48;
  }

  /** Envelope Z da SALA (não entra no mez / lança). */
  _cabinZ0() { return this._bulkZ() + 0.04; }
  _cabinZ1() {
    const r = this._r();
    return r.cabinZ1 != null ? Number(r.cabinZ1) : ((this.Lt || 3) / 2 - 0.08);
  }

  /** Envelope Z do MEZ. */
  _mezzZ0() {
    const r = this._r();
    return r.mezzZ0 != null ? Number(r.mezzZ0) : -3.20;
  }
  _mezzZ1() { return this._bulkZ() - 0.04; }

  _zoneOf(p) {
    // mez se atrás do bulkhead OU acima do piso mez
    if (p.z <= this._bulkZ() - 0.02) return 'mezz';
    if (p.y >= this._mezzY() - 0.05) return 'mezz';
    return 'cabin';
  }

  _runYCabin(type) {
    const st = this._styles[type] || {};
    const off = st.runYOffset != null ? st.runYOffset : 0.1;
    const floor = this.FLOOR_Y || 0;
    if (st.runY === 'underfloor') return floor + off;
    if (st.runY === 'ceiling') return floor + off;
    // rodapé sala — abaixo peitoril das janelas (~1.49)
    return floor + Math.max(0.08, Math.min(off, 0.12));
  }

  _runYMezz(type) {
    const st = this._styles[type] || {};
    if (st.runY === 'underfloor') return this._runYCabin(type);
    return this._mezzY() + 0.08;
  }

  _runY(type, a, b) {
    // usado só como default; _route escolhe por zona
    const za = this._zoneOf(a);
    const zb = this._zoneOf(b);
    if (za === 'mezz' && zb === 'mezz') return this._runYMezz(type);
    return this._runYCabin(type);
  }

  /** Mundo → local do trailer (pipes vivem no trailer). */
  _toLocal(p) {
    const out = p.clone();
    if (this.trailer && typeof this.trailer.worldToLocal === 'function') {
      this.trailer.updateMatrixWorld(true);
      this.trailer.worldToLocal(out);
    }
    return out;
  }

  _connPoint(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const c = new THREE.Vector3();
    box.getCenter(c);
    const util = this._itemUtilities(obj);
    const ports = util && util.ports;
    let bot;
    if (ports && ports.length && obj.localToWorld) {
      const sink = ports.find((p) => p.role === 'sink') || ports.find((p) => p.role === 'source') || ports[0];
      if (sink && Array.isArray(sink.local)) {
        bot = new THREE.Vector3(sink.local[0] || 0, sink.local[1] || 0, sink.local[2] || 0);
        obj.localToWorld(bot);
      }
    }
    if (!bot) bot = new THREE.Vector3(c.x, box.min.y + 0.02, c.z);
    // clamps no frame local do trailer
    return { center: this._toLocal(c), bot: this._clampPt(this._toLocal(bot), 0) };
  }

  _sideWindows(side) {
    const list = Array.isArray(this._r().windows) ? this._r().windows : [];
    return list.filter((w) => String(w.wall || '') === side);
  }

  /** Z livre de janela para vertical [y0..y1]. */
  _zForVertical(side, z, y0, y1) {
    const yLo = Math.min(y0, y1);
    const yHi = Math.max(y0, y1);
    const pad = 0.10;
    let zOut = z;
    const wins = this._sideWindows(side);
    for (let pass = 0; pass < 4; pass++) {
      let moved = false;
      for (let i = 0; i < wins.length; i++) {
        const w = wins[i];
        const z0 = Number(w.z0); const z1 = Number(w.z1);
        const wy0 = Number(w.y0); const wy1 = Number(w.y1);
        if (![z0, z1, wy0, wy1].every(Number.isFinite)) continue;
        if (yHi < wy0 - 0.01 || yLo > wy1 + 0.01) continue;
        if (zOut < z0 - 0.001 || zOut > z1 + 0.001) continue;
        const next = (Math.abs(zOut - z0) <= Math.abs(zOut - z1)) ? (z0 - pad) : (z1 + pad);
        if (Math.abs(next - zOut) > 0.001) { zOut = next; moved = true; }
      }
      if (!moved) break;
    }
    return zOut;
  }

  /**
   * Rota elétrica/água em 2 zonas:
   *  CABIN: Z ∈ [bulk+ε, entry], runY = rodapé sala
   *  MEZZ:  Z ∈ [mezAft, bulk-ε], runY = rodapé mez
   * Cruzamento L↔R só no bulkhead (sala) ou aft do mez — NUNCA na porta.
   * Drop vertical só em Z fora de janela; horizontais só no rodapé.
   */
  _route(aIn, bIn, runYFallback) {
    const a = this._clampPt(aIn.clone(), 0);
    const b = this._clampPt(bIn.clone(), 0);
    const pts = [];
    const push = (x, y, z) => {
      const p = this._clampPt(new THREE.Vector3(x, y, z), 0);
      const last = pts[pts.length - 1];
      if (last && last.distanceToSquared(p) < 6.4e-5) return;
      pts.push(p);
    };

    const typeGuess = runYFallback < (this.FLOOR_Y || 0) + 0.02 ? 'water' : 'elec12';
    const underfloor = runYFallback < (this.FLOOR_Y || 0) + 0.02;

    const xL = this._wallX('left');
    const xR = this._wallX('right');
    const sideA = this._sideX(a.x);
    const sideB = this._sideX(b.x);
    const wallA = sideA === 'left' ? xL : xR;
    const wallB = sideB === 'left' ? xL : xR;

    const zoneA = this._zoneOf(a);
    const zoneB = this._zoneOf(b);
    const yCab = underfloor ? runYFallback : this._runYCabin(typeGuess);
    const yMez = underfloor ? runYFallback : this._runYMezz(typeGuess);
    const bulk = this._bulkZ();

    // Z do drop: fora de janela + dentro da zona
    const clampZZone = (z, zone) => {
      if (zone === 'mezz') return Math.max(this._mezzZ0() + 0.05, Math.min(this._mezzZ1(), z));
      return Math.max(this._cabinZ0(), Math.min(this._cabinZ1() - 0.05, z));
    };

    const zDropA = clampZZone(this._zForVertical(sideA, a.z, a.y, zoneA === 'mezz' ? yMez : yCab), zoneA);
    const zDropB = clampZZone(this._zForVertical(sideB, b.z, zoneB === 'mezz' ? yMez : yCab, b.y), zoneB);

    // ── 1. origem → parede A ──
    push(a.x, a.y, a.z);
    push(wallA, a.y, a.z);

    // ── 2. desce ao rodapé da zona A (Z safe) ──
    const yRunA = zoneA === 'mezz' ? yMez : yCab;
    if (Math.abs(zDropA - a.z) > 0.02) push(wallA, a.y, zDropA);
    push(wallA, yRunA, zDropA);

    // ── 3. horizontal(is) no rodapé, trocando zona se preciso ──
    if (zoneA === zoneB) {
      if (sideA === sideB) {
        push(wallA, yRunA, zDropB);
      } else if (underfloor) {
        const zMid = (zDropA + zDropB) * 0.5;
        push(wallA, yRunA, zMid);
        push(wallB, yRunA, zMid);
        push(wallB, yRunA, zDropB);
      } else if (zoneA === 'cabin') {
        // U no bulkhead (fundo da sala) — não na porta (+Z)
        push(wallA, yRunA, bulk + 0.06);
        push(wallB, yRunA, bulk + 0.06);
        push(wallB, yRunA, zDropB);
      } else {
        // mez: U no aft do mez
        const zAft = this._mezzZ0() + 0.08;
        push(wallA, yRunA, zAft);
        push(wallB, yRunA, zAft);
        push(wallB, yRunA, zDropB);
      }
    } else {
      // cabin ↔ mezz: sobe/desce no bulkhead na MESMA parede, depois vai ao destino
      const zBulkCab = bulk + 0.06;
      const zBulkMez = bulk - 0.06;
      if (zoneA === 'cabin') {
        push(wallA, yCab, zBulkCab);
        // sobe na parede A até rodapé mez
        const zUp = this._zForVertical(sideA, zBulkCab, yCab, yMez);
        if (Math.abs(zUp - zBulkCab) > 0.02) push(wallA, yCab, zUp);
        push(wallA, yMez, zUp);
        if (Math.abs(zUp - zBulkMez) > 0.02) push(wallA, yMez, zBulkMez);
        if (sideA === sideB) {
          push(wallA, yMez, zDropB);
        } else {
          const zAft = this._mezzZ0() + 0.08;
          push(wallA, yMez, zAft);
          push(wallB, yMez, zAft);
          push(wallB, yMez, zDropB);
        }
      } else {
        // mezz → cabin
        push(wallA, yMez, zBulkMez);
        const zDn = this._zForVertical(sideA, zBulkMez, yMez, yCab);
        if (Math.abs(zDn - zBulkMez) > 0.02) push(wallA, yMez, zDn);
        push(wallA, yCab, zDn);
        if (Math.abs(zDn - zBulkCab) > 0.02) push(wallA, yCab, zBulkCab);
        if (sideA === sideB) {
          push(wallA, yCab, zDropB);
        } else {
          push(wallA, yCab, bulk + 0.06);
          push(wallB, yCab, bulk + 0.06);
          push(wallB, yCab, zDropB);
        }
      }
    }

    // ── 4. sobe no Z safe até altura do destino ──
    const yRunB = zoneB === 'mezz' ? yMez : yCab;
    // garante que estamos em wallB no rodapé zDropB
    push(wallB, yRunB, zDropB);
    push(wallB, b.y, zDropB);

    // ── 5. stub ao ponto (sem correr Z na parede) ──
    if (Math.abs(b.z - zDropB) <= 0.04 && Math.abs(b.x - wallB) <= 0.12) {
      push(b.x, b.y, b.z);
    } else {
      const inward = sideB === 'left' ? 0.08 : -0.08;
      push(wallB + inward, b.y, zDropB);
      push(wallB + inward, b.y, b.z);
      push(b.x, b.y, b.z);
    }
    return pts;
  }

  _clampPt(p, m) {
    const inset = this._wallInset();
    const halfW = (this.BODY_W || 1.9) / 2;
    // envelope INTERNO estrito
    const hx = halfW - inset + 0.005;
    const zMin = this._mezzZ0() + m;
    const zMax = this._cabinZ1() + 0.02 - m;
    p.x = Math.max(-hx + m, Math.min(hx - m, p.x));
    p.z = Math.max(zMin, Math.min(zMax, p.z));
    const yMin = (this.FLOOR_Y || 0) - 0.30;
    const yMax = (this.FLOOR_Y || 0) + (this._r().maxRunY != null ? Number(this._r().maxRunY) : 2.15);
    p.y = Math.max(yMin, Math.min(yMax, p.y));
    return p;
  }

  _createSegs(pts, type) {
    const segs = [];
    const style = this._styles[type];
    if (!style) return segs;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      if (len < 0.001) continue;
      const geo = new THREE.CylinderGeometry(style.radius, style.radius, len, 8, 1);
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
    const style = this._styles[type];
    if (!style) return list;
    for (let i = 0; i < style.markers; i++) {
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

/** Compat: export antigo (usa catalog se passado via 2º arg não usado). */
export function linkNeedsOf(obj, catalog) {
  if (!obj || !obj.userData) return null;
  const u = obj.userData;
  if (u.utilities && Array.isArray(u.utilities.needs)) {
    const out = {};
    u.utilities.needs.forEach((t) => { out[t === 'elec' ? 'elec12' : t] = true; });
    return out;
  }
  if (catalog && catalog.items) {
    const item = catalog.items.find((i) => i.kind === (u.kind || u.funcKind));
    if (item && item.utilities && Array.isArray(item.utilities.needs)) {
      const out = {};
      item.utilities.needs.forEach((t) => { out[t === 'elec' ? 'elec12' : t] = true; });
      return out;
    }
  }
  return null;
}
