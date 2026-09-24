/**
 * PaletteService — Serviço de paleta de objetos (data-driven).
 *
 * DISCLAIMER/HOOK:
 *   Esta é a ÚNICA fonte de geometria/metadata de objetos da paleta.
 *   Tudo vem de data/palette-catalog.json.
 *   NÃO re-hardcode objetos aqui — edite o JSON.
 *   Se adicionar um novo tipo, adicione-o ao JSON e este service o
 *   constrói automaticamente (genérico ou via factory).
 */
const THREE = window.THREE;

export default class PaletteService {
  constructor({ catalog, interior, body, FLOOR_Y, editableMeshes,
                pushUndoFn, resolvePlacementFn, selectObjectFn,
                addEditableFn, uniqueNameFn, roofTopFn,
                makeHingedDoorFn, makeRvWindowFn, makeDinetteGroupFn,
                M, matFn, weightService,
                rootGroupFn = null, onFatalErrorFn = null }) {
    this.catalog = catalog;
    this.interior = interior;
    this.body = body || null;
    this.FLOOR_Y = FLOOR_Y;
    this.editableMeshes = editableMeshes;
    this.pushUndo = pushUndoFn;
    this.resolvePlacement = resolvePlacementFn;
    this.selectObject = selectObjectFn;
    this.addEditable = addEditableFn;
    this.uniqueName = uniqueNameFn;
    this.roofTop = roofTopFn;
    this.makeHingedDoor = makeHingedDoorFn;
    this.makeRvWindow = makeRvWindowFn;
    this.makeDinetteGroup = makeDinetteGroupFn;
    this.M = M;
    this.mat = matFn;
    this.weightService = weightService || null;
    this.rootGroup = rootGroupFn;
    this.onFatalError = onFatalErrorFn;
  }

  /* ── metadata / product info ────────────────────────────────────── */

  productMeta(kind) {
    const item = this._item(kind);
    if (!item) return null;
    const q = item.q || (item.name || kind);
    return {
      kind,
      buyUrl: item.buy || null,
      searchUrl: 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(q),
      query: q,
    };
  }

  attachProductMeta(mesh, kind) {
    const meta = this.productMeta(kind);
    if (!mesh || !meta) return;
    mesh.userData.kind = kind;
    mesh.userData.buyUrl = meta.buyUrl;
    mesh.userData.searchUrl = meta.searchUrl;
    mesh.userData.productQuery = meta.query;
  }

  /* ── lookup helpers ─────────────────────────────────────────────── */

  _item(kind) {
    if (!this.catalog || !this.catalog.items) return null;
    return this.catalog.items.find((i) => i.kind === kind) || null;
  }

  _namedMat(name) {
    const M = this.M;
    if (!name) return null;
    const key = name + 'D';
    if (M && M[key]) return M[key];
    if (M && M[name]) return M[name];
    return null;
  }

  /* ── generic geometry builder ───────────────────────────────────── */

  _buildMaterial(spec) {
    if (spec.namedMat) {
      const nm = this._namedMat(spec.namedMat);
      if (nm) return nm;
    }
    const matOpts = {};
    if (spec.color != null) {
      matOpts.color = parseInt(spec.color, 16) || spec.color;
    }
    matOpts.roughness = spec.roughness ?? 0.7;
    matOpts.metalness = spec.metalness ?? 0.1;
    matOpts.opacity = spec.opacity ?? 1.0;
    matOpts.transparent = spec.transparent ?? false;
    if (spec.emissive != null) {
      matOpts.emissive = parseInt(spec.emissive, 16) || spec.emissive;
      matOpts.emissiveIntensity = spec.emissiveIntensity ?? 0.3;
    }
    if (spec.envMapIntensity != null) matOpts.envMapIntensity = spec.envMapIntensity;
    if (spec.flatShading != null) matOpts.flatShading = !!spec.flatShading;
    // clearcoat / physical paint (tinta automotiva) via MeshPhysicalMaterial
    if (spec.clearcoat != null || spec.clearcoatRoughness != null || spec.sheen != null) {
      const phys = new THREE.MeshPhysicalMaterial(matOpts);
      if (spec.clearcoat != null) phys.clearcoat = spec.clearcoat;
      if (spec.clearcoatRoughness != null) phys.clearcoatRoughness = spec.clearcoatRoughness;
      if (spec.sheen != null) phys.sheen = spec.sheen;
      if (spec.reflectivity != null) phys.reflectivity = spec.reflectivity;
      return phys;
    }
    return new THREE.MeshStandardMaterial(matOpts);
  }

  _finishMesh(mesh) {
    if (!mesh) return mesh;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  _buildBox(spec) {
    const mat = this._buildMaterial(spec);
    const [w, h, d] = spec.size;
    return this._finishMesh(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat));
  }

  _buildCylinder(spec) {
    const mat = this._buildMaterial(spec);
    const [r1, r2, h, seg] = spec.args;
    const radial = Math.max(8, Number(seg) || 16);
    return this._finishMesh(new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, radial), mat));
  }

  _buildPart(partSpec) {
    const mesh = partSpec.type === 'box' ? this._buildBox(partSpec)
              : partSpec.type === 'cylinder' ? this._buildCylinder(partSpec)
              : null;
    return mesh;
  }

  _buildGroup(spec) {
    const g = new THREE.Group();
    for (const entry of spec.parts) {
      // formats: [partSpec, offset] | [partSpec, offset, rotation]
      const partSpec = entry[0];
      const off = entry[1];
      const rot = entry[2];
      const m = this._buildPart(partSpec);
      if (!m) continue;
      if (off) m.position.set(off[0] || 0, off[1] || 0, off[2] || 0);
      if (rot) m.rotation.set(rot[0] || 0, rot[1] || 0, rot[2] || 0);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    g.traverse((ch) => {
      if (ch.isMesh) {
        ch.castShadow = true;
        ch.receiveShadow = true;
      }
    });
    return g;
  }

  /**
   * Modelo externo genérico (GLB/GLTF). O JSON só declara url/escala —
   * o frontend não sabe o que é "carro" ou "trailer".
   * Retorna Group síncrono; geometria assíncrona via cache + clone.
   */
  _buildModel(spec) {
    const holder = new THREE.Group();
    const url = spec.url;
    if (!url) return holder;
    if (spec.pos) holder.position.set(spec.pos[0] || 0, spec.pos[1] || 0, spec.pos[2] || 0);
    if (spec.rotation) holder.rotation.set(spec.rotation[0] || 0, spec.rotation[1] || 0, spec.rotation[2] || 0);
    if (spec.scale != null) {
      if (Array.isArray(spec.scale)) holder.scale.set(spec.scale[0] ?? 1, spec.scale[1] ?? 1, spec.scale[2] ?? 1);
      else holder.scale.setScalar(Number(spec.scale) || 1);
    }
    holder.userData.modelUrl = url;
    holder.userData.modelReady = false;

    const attachTo = (holderRef, template) => {
      try {
        if (!template || !holderRef || holderRef.userData.modelReady) return;
        const clone = template.clone(true);
        clone.traverse((ch) => {
          if (ch.isMesh) {
            ch.castShadow = true;
            ch.receiveShadow = true;
            if (ch.material) {
              const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
              mats.forEach((m) => {
                if (!m) return;
                if (m.name && /vidro|glass/i.test(m.name)) {
                  m.transparent = true;
                  m.opacity = Math.min(m.opacity ?? 1, 0.35);
                  m.depthWrite = false;
                }
                // sem baseColorFactor no glTF → branco metálico default; evita estouro
                if (m.color && m.metalness >= 0.95 && m.color.r > 0.95 && m.color.g > 0.95 && m.color.b > 0.95) {
                  m.metalness = 0.15;
                  m.roughness = 0.65;
                }
                if ('envMapIntensity' in m) m.envMapIntensity = Math.min(m.envMapIntensity ?? 1, 0.45);
              });
            }
          }
        });
        if (typeof holderRef.clear === 'function') holderRef.clear();
        else {
          while (holderRef.children.length) holderRef.remove(holderRef.children[0]);
        }
        holderRef.add(clone);
        holderRef.userData.modelReady = true;
        holderRef.dispatchEvent({ type: 'model-loaded', url });
      } catch (err) {
        console.warn('[PaletteService] attach model failed', url, err);
      }
    };

    if (typeof THREE.GLTFLoader !== 'function') {
      console.warn('[PaletteService] GLTFLoader indisponível:', url);
      return holder;
    }

    if (!PaletteService._modelCache) PaletteService._modelCache = new Map();
    const cache = PaletteService._modelCache;

    const cached = cache.get(url);
    if (cached) {
      if (cached.ready) attachTo(holder, cached.template);
      else cached.waiters.push(holder);
      return holder;
    }

    const entry = { ready: false, template: null, waiters: [holder] };
    cache.set(url, entry);
    const settle = (template) => {
      entry.template = template;
      entry.ready = true;
      entry.waiters.splice(0).forEach((h) => attachTo(h, template));
    };
    try {
      const loader = new THREE.GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          const root = gltf.scene || (gltf.scenes && gltf.scenes[0]);
          if (root) {
            root.traverse((ch) => {
              if (ch.isMesh) {
                ch.castShadow = true;
                ch.receiveShadow = true;
              }
            });
          }
          settle(root || null);
        },
        undefined,
        (err) => {
          console.warn('[PaletteService] falha ao carregar modelo', url, err);
          settle(null);
        }
      );
    } catch (err) {
      console.warn('[PaletteService] GLTFLoader threw', url, err);
      settle(null);
    }
    return holder;
  }

  _buildFromGeometry(spec) {
    if (!spec || !spec.type) return null;
    switch (spec.type) {
      case 'box':     return this._buildBox(spec);
      case 'cylinder': return this._buildCylinder(spec);
      case 'group':   return this._buildGroup(spec);
      case 'factory': return this._buildFactory(spec);
      case 'model':
      case 'glb':
      case 'gltf':
        return this._buildModel(spec);
      default:        return null;
    }
  }

  /* ── factory builders (portas, janelas, dinette) ────────────────── */

  _buildFactory(spec) {
    const f = spec.factory;
    const p = (spec.params && typeof spec.params === 'object') ? spec.params : {};
    const I = this.interior;
    if (f === 'hingedDoor' && this.makeHingedDoor) return this.makeHingedDoor(p);
    if (f === 'rvWindow' && this.makeRvWindow) {
      let w = 0.50, h = 0.50, cornerRadius = 0;
      if (Array.isArray(spec.params) && spec.params.length >= 2) {
        w = Number(spec.params[0]) || w;
        h = Number(spec.params[1]) || h;
        if (spec.params.length >= 3) cornerRadius = Number(spec.params[2]) || 0;
      } else if (p && typeof p === 'object') {
        w = Number(p.w) || w;
        h = Number(p.h) || h;
        cornerRadius = Number(p.cornerRadius) || 0;
      }
      // opts.params do JSON (applySaved) tem prioridade
      if (spec._jsonParams) {
        w = Number(spec._jsonParams.w) || w;
        h = Number(spec._jsonParams.h) || h;
        if (spec._jsonParams.cornerRadius != null) cornerRadius = Number(spec._jsonParams.cornerRadius) || 0;
      }
      const g = this.makeRvWindow(w, h, cornerRadius);
      if (g) {
        g.userData.funcKind = 'janela';
        g.userData.winW = w;
        g.userData.winH = h;
        g.userData.glassW = w;
        g.userData.glassH = h;
        g.userData.fromPalette = true;
      }
      return g;
    }
    if (f === 'dinetteGroup' && this.makeDinetteGroup) return this.makeDinetteGroup(p);
    if (f === 'maderitePanel') return this._buildMaderitePanel(p);
    if (f === 'stairCab' && I && I.makeStairCab) return I.makeStairCab(p);
    if (f === 'potti' && I && I.makePotti) return I.makePotti(p);
    if (f === 'ducha' && I && I.makeDucha) return I.makeDucha(p);
    if (f === 'mirror' && I && I.makeMirror) return I.makeMirror(p);
    if (f === 'mattress' && I && I.makeMattress) return I.makeMattress(p);
    if (f === 'pillow' && I && I.makePillow) return I.makePillow(p);
    if (f === 'mezzColumn' && I && I.makeMezzColumn) return I.makeMezzColumn(p);
    if (f === 'mezzBeam' && I && I.makeMezzBeam) return I.makeMezzBeam(p);
    if (f === 'mezzFloor' && I && I.makeMezzFloor) return I.makeMezzFloor(p);
    if (f === 'guardRail' && I && I.makeGuardRail) {
      const gp = Object.assign({}, (p && !Array.isArray(p)) ? p : {});
      if (spec._jsonParams && typeof spec._jsonParams === 'object' && !Array.isArray(spec._jsonParams)) {
        Object.assign(gp, spec._jsonParams);
      }
      return I.makeGuardRail(gp);
    }
    if (f === 'telhado') return this._buildTelhado(p);
    return null;
  }

  _buildTelhado(params = {}) {
    const THREE = this.THREE || window.THREE;
    if (!THREE) return null;
    const p = params;
    const BODY_W = Number(p.BODY_W) || 1.90;
    const Lt = Number(p.Lt) || 3.00;
    const WALL_H = Number(p.WALL_H) || 1.85;
    const zRoofFront = Number(p.zRoofFront) || -(Lt / 2) - 1.88;
    const zRoofRear = Number(p.zRoofRear) || Lt / 2;
    const roofTotalL = zRoofRear - zRoofFront;
    const roofCurveR = Number(p.roofCurveR) || 0.40;
    const roofRise = Number(p.roofRise) || roofCurveR;
    const roofFlatStart = zRoofFront + roofCurveR;
    const roofFlatEnd = zRoofRear - roofCurveR;
    function roofY(z) {
      if (z < roofFlatStart) { const dz = z - roofFlatStart; return Math.sqrt(Math.max(0, roofCurveR * roofCurveR - dz * dz)); }
      if (z > roofFlatEnd) { const dz = z - roofFlatEnd; return Math.sqrt(Math.max(0, roofCurveR * roofCurveR - dz * dz)); }
      return roofRise;
    }
    const roofGroup = new THREE.Group();
    const roofW = BODY_W;
    const roofSegs = 40, roofWSegs = 10;
    const halfW = roofW / 2;
    const rVerts = [], rIdx = [], rUVs = [];
    const rows = roofWSegs + 1;
    for (let ix = 0; ix <= roofWSegs; ix++) {
      const x = -halfW + ix * (roofW / roofWSegs);
      for (let iz = 0; iz <= roofSegs; iz++) {
        const t = iz / roofSegs;
        const z = zRoofFront + t * roofTotalL;
        rVerts.push(x, roofY(z), z);
        rUVs.push(ix / roofWSegs, t);
      }
    }
    for (let ix = 0; ix < roofWSegs; ix++) {
      for (let iz = 0; iz < roofSegs; iz++) {
        const a = ix * rows + iz, b = a + 1, c = a + rows, d = c + 1;
        rIdx.push(a, b, c, b, d, c);
      }
    }
    const roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUVs, 2));
    roofGeo.setIndex(rIdx);
    roofGeo.computeVertexNormals();
    const M = this.M || {};
    const telhMat = M.telhado || new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.7, metalness: 0.2 });
    const aluminioMat = M.aluminioD || new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.3, metalness: 0.6 });
    const roofMesh = new THREE.Mesh(roofGeo, telhMat);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofGroup.add(roofMesh);
    const addEaveRibbon = (sx, xOut) => {
      const segs = 56, drop = 0.045, out = xOut;
      const verts = [], idx = [];
      for (let i = 0; i <= segs; i++) {
        const z = zRoofFront + (i / segs) * roofTotalL;
        const y = roofY(z);
        verts.push(sx, y, z, sx + out, y, z, sx + out, y - drop, z, sx, y - drop, z);
        if (i > 0) {
          const b = (i - 1) * 4, c = i * 4;
          idx.push(b, c, b + 1, c, c + 1, b + 1, b + 1, c + 1, b + 2, c + 1, c + 2, b + 2, b + 2, c + 2, b + 3, c + 2, c + 3, b + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      roofGroup.add(new THREE.Mesh(geo, aluminioMat));
    };
    addEaveRibbon(-halfW, -0.04);
    addEaveRibbon(halfW, 0.04);
    const addEndEave = (zPos) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(roofW + 0.08, 0.045, 0.04), aluminioMat);
      e.position.set(0, roofY(zPos) - 0.02, zPos);
      roofGroup.add(e);
    };
    addEndEave(zRoofFront);
    addEndEave(zRoofRear);
    roofGroup.userData.kind = 'telhado';
    roofGroup.userData.name = 'Telhado';
    roofGroup.userData.funcKind = 'telhado';
    return roofGroup;
  }

  /**
   * Painel maderite.
   * box_mm SEMPRE [X, Y, Z] em mm no eixo local Three.js:
   *   Y = altura (vertical) para parede em pé
   *   X,Z = largura/espessura na horizontal
   * Igual Interior.wall(w,h,d) antigo: BoxGeometry(w,h,d).
   */
  _buildMaderitePanel(params = {}) {
    const box = this._normalizeMaderiteBoxMm(params.box_mm, params);
    const sx = box[0] / 1000;
    const sy = box[1] / 1000;
    const sz = box[2] / 1000;
    const mat = this.mat
      ? this.mat(0xc9a86c, { roughness: 0.85, metalness: 0.05 })
      : new THREE.MeshStandardMaterial({ color: 0xc9a86c, roughness: 0.85, metalness: 0.05 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.box_mm = box;
    mesh.userData.cuttable = true;
    mesh.userData.matFamily = 'wood';
    mesh.userData.category = 'paredes-int';
    mesh.userData.baseSizeMm = { L: box[0], H: box[1], P: box[2] };
    mesh.userData.upright = true;
    const face = [box[0], box[1], box[2]].filter((v, i, a) => true);
    const dims = [box[0], box[1], box[2]].slice().sort((a, b) => b - a);
    mesh.userData.cut_mm = params.cut_mm || {
      comp: dims[0], larg: dims[1], esp: Math.min(box[0], box[1], box[2]), sheet: '2200x1100',
    };
    mesh.userData.cuts = Array.isArray(params.cuts) ? params.cuts : [];
    return mesh;
  }

  /**
   * box_mm do JSON é a fonte de verdade: [X,Y,Z] = BoxGeometry(w,h,d).
   * NÃO reordenar eixos — o autor do JSON (ou o export factory) já definiu.
   */
  _normalizeMaderiteBoxMm(boxMm, params = {}) {
    if (Array.isArray(boxMm) && boxMm.length >= 3) {
      return [
        Math.max(1, Math.round(Number(boxMm[0]) || 15)),
        Math.max(1, Math.round(Number(boxMm[1]) || 15)),
        Math.max(1, Math.round(Number(boxMm[2]) || 15)),
      ];
    }
    const t = Math.max(1, Math.round(Number(params.esp_mm) || 15));
    return [800, 1200, t];
  }

  applyMaderiteState(mesh, st) {
    if (!mesh || !st) return mesh;
    const box = this._normalizeMaderiteBoxMm(st.box_mm, {
      esp_mm: st.cut_mm && st.cut_mm.esp,
      role: st.role,
    });
    const sx = box[0] / 1000;
    const sy = box[1] / 1000;
    const sz = box[2] / 1000;
    if (mesh.geometry && mesh.geometry.dispose) mesh.geometry.dispose();
    mesh.geometry = new THREE.BoxGeometry(sx, sy, sz);
    mesh.userData.box_mm = box;
    mesh.userData.baseSizeMm = { L: box[0], H: box[1], P: box[2] };
    if (st.cut_mm) mesh.userData.cut_mm = st.cut_mm;
    if (Array.isArray(st.cuts)) mesh.userData.cuts = st.cuts;
    if (st.role) mesh.userData.role = st.role;
    mesh.userData.cuttable = true;
    mesh.userData.matFamily = 'wood';
    mesh.userData.category = 'paredes-int';
    mesh.userData.upright = true;
    mesh.userData.fixedLayout = true;
    return mesh;
  }

  /* ── target group ──────────────────────────────────────────────── */

  interiorGroup() {
    return (this.interior && this.interior.interior) ? this.interior.interior : this.interior;
  }

  _isAttachedToRoot(group) {
    if (!group) return false;
    const root = typeof this.rootGroup === 'function' ? this.rootGroup() : null;
    if (!root) return !!group.parent;
    let cur = group;
    while (cur) {
      if (cur === root) return true;
      cur = cur.parent;
    }
    return false;
  }

  targetGroup(kind) {
    // Tudo sob o trailer root: JSON.p = posição fixa no trailer (não relativa a FLOOR_Y).
    if (typeof this.rootGroup === 'function') {
      const root = this.rootGroup();
      if (root) return root;
    }
    if (this.interior && this.interior.mezz && kind &&
        /^(coluna-mez|viga-mez|piso-mezanino|colchao-casal|travesseiro|guarda-corpo)$/.test(kind)) {
      return this.interior.mezz;
    }
    return this.interiorGroup();
  }

  /* ── spawn (data-driven) ────────────────────────────────────────── */

  spawnPaletteItem(kind, opts = {}) {
    const item = this._item(kind);
    if (!item) return null;

    if (!opts.forceNew && (item.unique || item.maxCount === 1)) {
      const existing = this.editableMeshes.find((m) => m && m.userData && m.userData.kind === kind);
      if (existing) return existing;
    }

    const spec = item.geometry ? Object.assign({}, item.geometry) : null;
    // permite sobrescrever params (ex.: dinette benchL=1.80 do JSON)
    if (spec && opts.params) {
      if (Array.isArray(spec.params) && Array.isArray(opts.params)) {
        spec.params = opts.params.slice();
      } else if (Array.isArray(opts.params)) {
        spec.params = opts.params.slice();
      } else {
        spec.params = Object.assign({}, spec.params || {}, opts.params);
      }
      spec._jsonParams = opts.params;
    }
    if (spec && opts.box_mm && spec.factory === 'maderitePanel') {
      spec.params = Object.assign({}, spec.params || {}, { box_mm: opts.box_mm, cuts: opts.cuts, cut_mm: opts.cut_mm });
    }
    let mesh;

    if (spec) {
      mesh = this._buildFromGeometry(spec);
    }

    if (!mesh) return null;

    // posição
    const pos = (spec && spec.pos) || [0, 0, 0];
    mesh.position.set(pos[0], pos[1], pos[2]);

    // roof offset (itens de teto)
    if (spec && spec.roof != null && typeof this.roofTop === 'function') {
      mesh.position.y = this.roofTop(0) + spec.roof;
    }

    // role / restY / bedY (mesa Lagun)
    if (spec && spec.role) {
      mesh.userData.role = spec.role;
      if (spec.restY != null) mesh.userData.restY = spec.restY;
      if (spec.bedY != null)  mesh.userData.bedY  = spec.bedY;
    }

    const name = opts.name || item.spawnName || item.name || kind;
    const cat  = item.spawnCat || null;

    mesh.userData.kind = kind;
    mesh.userData.name = name;
    mesh.userData.fromPalette = true;
    if (String(kind).indexOf('janela') === 0) {
      mesh.userData.funcKind = 'janela';
      mesh.userData.editable = true;
      const wallH = 1.85;
      mesh.position.set(-0.70, wallH / 2, 0);
    }
    // carimba utilities do catálogo (auto-connect 12V/220V/água)
    if (item.utilities) {
      mesh.userData.utilities = item.utilities;
    }
    if (item.spawnCat) mesh.userData.category = item.spawnCat;
    else if (item.cat) {
      const c = String(item.cat).toLowerCase();
      if (c.indexOf('el') >= 0) mesh.userData.category = 'eletrica';
      else if (c.indexOf('encan') >= 0 || c.indexOf('hidr') >= 0) mesh.userData.category = 'encanamento';
    }
    this.attachProductMeta(mesh, kind);
    mesh.castShadow = true;

    const group = this.targetGroup(kind);
    if (!group || typeof group.add !== 'function') {
      const err = new Error('Grupo de interior indisponível para spawn da paleta.');
      if (typeof this.onFatalError === 'function') this.onFatalError(err, 'spawnPaletteItem');
      throw err;
    }
    group.add(mesh);
    this.addEditable(mesh, this.uniqueName(name), cat, kind);
    if (this.weightService) this.weightService.addItem(kind);
    return mesh;
  }

  finalizeWallOpening(item) {
    if (!item || !this.body || typeof this.body.applyOpening !== 'function') return;
    const kind = item.userData && item.userData.kind;
    if (this.body.isWallOpeningKind(kind) || (item.userData && item.userData.funcKind === 'janela')) {
      this.body.applyOpening(item);
    }
  }

  placePaletteAtClient(kind, clientX, clientY, renderer, raycaster, mouse, camera) {
    this.pushUndo();
    const item = this.spawnPaletteItem(kind);
    if (!item) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.FLOOR_Y);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      const group = this.targetGroup();
      if (!group || typeof group.worldToLocal !== 'function') return null;
      const local = group.worldToLocal(hit.clone());
      item.position.x = local.x;
      item.position.z = local.z;
    } else {
      this.resolvePlacement(item);
    }
    this.finalizeWallOpening(item);
    this.selectObject(item);
    return item;
  }

  setupDragAndDrop(renderer, camera) {
    const buttons = document.querySelectorAll('#palette .pi[data-item]');
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    buttons.forEach((btn) => {
      const kind = btn.dataset.item;
      btn.setAttribute('draggable', 'true');
      btn.addEventListener('click', () => {
        this.pushUndo();
        const item = this.spawnPaletteItem(kind);
        if (!item) return;
        this.resolvePlacement(item);
        this.finalizeWallOpening(item);
        this.selectObject(item);
      });
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', kind);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
    if (!renderer || !renderer.domElement) return;
    const dom = renderer.domElement;
    dom.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    dom.addEventListener('drop', (e) => {
      const kind = e.dataTransfer.getData('text/plain');
      if (!kind) return;
      e.preventDefault();
      this.placePaletteAtClient(kind, e.clientX, e.clientY, renderer, raycaster, mouse, camera);
    });
  }
}
