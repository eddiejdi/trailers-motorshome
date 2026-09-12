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
    return new THREE.MeshStandardMaterial(matOpts);
  }

  _buildBox(spec) {
    const mat = this._buildMaterial(spec);
    const [w, h, d] = spec.size;
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  }

  _buildCylinder(spec) {
    const mat = this._buildMaterial(spec);
    const [r1, r2, h, seg] = spec.args;
    return new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat);
  }

  _buildPart(partSpec) {
    const mesh = partSpec.type === 'box' ? this._buildBox(partSpec)
              : partSpec.type === 'cylinder' ? this._buildCylinder(partSpec)
              : null;
    return mesh;
  }

  _buildGroup(spec) {
    const g = new THREE.Group();
    for (const [partSpec, off] of spec.parts) {
      const m = this._buildPart(partSpec);
      if (m && off) m.position.set(off[0], off[1], off[2]);
      if (m) g.add(m);
    }
    return g;
  }

  _buildFromGeometry(spec) {
    if (!spec || !spec.type) return null;
    switch (spec.type) {
      case 'box':     return this._buildBox(spec);
      case 'cylinder': return this._buildCylinder(spec);
      case 'group':   return this._buildGroup(spec);
      case 'factory': return this._buildFactory(spec);
      default:        return null;
    }
  }

  /* ── factory builders (portas, janelas, dinette) ────────────────── */

  _buildFactory(spec) {
    const f = spec.factory;
    if (f === 'hingedDoor' && this.makeHingedDoor) {
      const p = spec.params || {};
      return this.makeHingedDoor(p);
    }
    if (f === 'rvWindow' && this.makeRvWindow) {
      const [w, h] = spec.params || [0.50, 0.50];
      return this.makeRvWindow(w, h);
    }
    if (f === 'dinetteGroup' && this.makeDinetteGroup) {
      return this.makeDinetteGroup();
    }
    return null;
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

  targetGroup() {
    const interior = this.interiorGroup();
    if (interior) return interior;
    return typeof this.rootGroup === 'function' ? this.rootGroup() : null;
  }

  /* ── spawn (data-driven) ────────────────────────────────────────── */

  spawnPaletteItem(kind) {
    const item = this._item(kind);
    if (!item) return null;

    const spec = item.geometry;
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

    const name = item.spawnName || item.name || kind;
    const cat  = item.spawnCat || null;

    mesh.userData.kind = kind;
    this.attachProductMeta(mesh, kind);
    mesh.castShadow = true;

    const group = this.targetGroup();
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
