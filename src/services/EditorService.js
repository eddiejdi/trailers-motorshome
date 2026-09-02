const THREE = window.THREE;

export default class EditorService {
  constructor({ scene, camera, renderer, trailer, controls, editableMeshes, FLOOR_Y, WALL_H, Li, Lt, wth, BODY_W, interior }) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.trailer = trailer;
    this.orbitControls = controls;
    this.editableMeshes = editableMeshes;
    this.FLOOR_Y = FLOOR_Y;
    this.WALL_H = WALL_H;
    this.Li = Li;
    this.Lt = Lt;
    this.wth = wth;
    this.BODY_W = BODY_W;
    this.interior = interior;

    this.selected = null;
    this.transformCtrl = null;
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.magnetCtrlDown = false;
    this.magnetLastTarget = null;
    this.MAGNET_RANGE = 0.50;
    this.undoStack = [];
    this.redoStack = [];
    this.UNDO_MAX = 60;
    this.onSelectionChange = null;

    this._initTransformControls();
    this._initMagnetListeners();
    this._initClickHandler();
  }

  _initClickHandler() {
    const dom = this.renderer.domElement;
    dom.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      if (this.transformCtrl.dragging || this.transformCtrl.axis) return;
      const rect = dom.getBoundingClientRect();
      this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObjects(this.editableMeshes, true);
      const obj = this.pickFromHits(hits);
      if (obj) this.selectObject(obj);
      else this.deselectObject();
    });
  }

  _initTransformControls() {
    this.transformCtrl = new THREE.TransformControls(this.camera, this.renderer.domElement);
    this.transformCtrl.setSize(1.35);
    this.transformCtrl.setSpace('world');
    this.scene.add(this.transformCtrl);

    this.transformCtrl.addEventListener('dragging-changed', (e) => {
      this.orbitControls.enabled = !e.value;
      if (!e.value && this.selected) {
        if (this.magnetCtrlDown) this.magnetSnap(this.selected);
        else this.resolvePlacement(this.selected);
        const hint = document.getElementById('magnet-hint');
        if (hint && !this.magnetCtrlDown) hint.textContent = 'Ctrl + arrastar = ímã no vizinho';
      }
    });
    this.transformCtrl.addEventListener('mouseDown', () => this.pushUndo());
    this.transformCtrl.addEventListener('change', () => {
      if (this.transformCtrl.dragging && this.magnetCtrlDown && this.selected) this.magnetSnap(this.selected);
    });
    this.transformCtrl.addEventListener('mouseUp', () => {});
  }

  _initMagnetListeners() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') this.magnetCtrlDown = true;
    });
    window.addEventListener('keyup', (e) => {
      if (e.key === 'Control' || e.key === 'Meta') this.magnetCtrlDown = false;
    });
    window.addEventListener('blur', () => { this.magnetCtrlDown = false; });
  }

  addEditable(mesh, name, cat, kind) {
    mesh.userData.editable = true;
    mesh.userData.name = name;
    mesh.userData.category = cat || 'acessorios';
    mesh.userData.collider = true;
    if (kind) mesh.userData.kind = kind;
    this.editableMeshes.push(mesh);
  }

  addGroupEditable(grp, name, cat) {
    grp.userData.editable = true;
    grp.userData.name = name;
    grp.userData.category = cat || 'paredes';
    grp.traverse(c => { c.userData.collider = true; });
    this.editableMeshes.push(grp);
  }

  editableRoot(obj) {
    while (obj && !obj.userData.editable) obj = obj.parent;
    return (obj && obj.userData.editable) ? obj : null;
  }

  pickFromHits(hits) {
    const seen = new Set();
    const roots = [];
    hits.forEach((h) => {
      const r = this.editableRoot(h.object);
      if (!r || seen.has(r)) return;
      seen.add(r);
      roots.push(r);
    });
    if (!roots.length) return null;
    return roots[0];
  }

  selectObject(obj) {
    if (this.selected && this.selected !== obj) this.selected.userData.funcTarget = 0;
    this.selected = obj;
    if (!obj.userData.skipFunc) obj.userData.funcTarget = 1;
    this.transformCtrl.attach(obj);
    this.transformCtrl.visible = true;
    const selInfo = document.getElementById('sel-info');
    if (selInfo) selInfo.innerHTML = this._productInfoHtml(obj);
    const selControls = document.getElementById('sel-controls');
    if (selControls) selControls.style.display = 'block';
    if (typeof this.onSelectionChange === 'function') this.onSelectionChange(obj);
  }

  deselectObject() {
    if (this.selected) this.selected.userData.funcTarget = 0;
    this.selected = null;
    this.transformCtrl.detach();
    const selInfo = document.getElementById('sel-info');
    if (selInfo) selInfo.innerHTML = 'Clique num objeto para selecionar';
    const selControls = document.getElementById('sel-controls');
    if (selControls) selControls.style.display = 'none';
    if (typeof this.onSelectionChange === 'function') this.onSelectionChange(null);
  }

  _productInfoHtml(obj) {
    let html = 'Selecionado: <b>' + obj.userData.name + '</b>';
    const kind = obj.userData.kind;
    if (kind && !obj.userData.buyUrl) this.attachProductMeta(obj, kind);
    const buy = obj.userData.buyUrl;
    const search = obj.userData.searchUrl || (obj.userData.productQuery ? this.productSearchUrl(obj.userData.productQuery) : '');
    if (buy) html += '<br><a class="buy-link" href="' + buy + '" target="_blank" rel="noopener">Comprar / ficha</a>';
    if (search && search !== buy) html += ' · <a class="buy-link" href="' + search + '" target="_blank" rel="noopener">Buscar no mercado</a>';
    return html;
  }

  productSearchUrl(q) {
    return 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(q);
  }

  attachProductMeta(mesh, kind) {
    // Placeholder — delega para PaletteService quando disponível
  }

  pushUndo() {
    this.undoStack.push(this.captureLayout());
    if (this.undoStack.length > this.UNDO_MAX) this.undoStack.shift();
    this.redoStack.length = 0;
  }

  undoEdit() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.captureLayout());
    this.applyCaptured(this.undoStack.pop());
  }

  redoEdit() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.captureLayout());
    this.applyCaptured(this.redoStack.pop());
  }

  captureLayout() {
    return this.editableMeshes.map((m) => ({
      mesh: m,
      parent: m.parent,
      p: m.position.clone(),
      r: m.rotation.clone(),
      s: m.scale.clone(),
    }));
  }

  applyCaptured(entry) {
    entry.forEach((st) => {
      st.mesh.position.copy(st.p);
      st.mesh.rotation.copy(st.r);
      st.mesh.scale.copy(st.s);
      if (st.parent && st.mesh.parent !== st.parent) {
        st.parent.add(st.mesh);
        if (this.editableMeshes.indexOf(st.mesh) < 0) this.editableMeshes.push(st.mesh);
      }
    });
  }

  snapAxis(amin, amax, bmin, bmax, range) {
    const ac = (amin + amax) / 2, bc = (bmin + bmax) / 2;
    const cands = [bmax - amin, bmin - amax, bmin - amax, bmax - amax, bc - ac];
    let best = 0, bestAbs = range;
    for (let i = 0; i < cands.length; i++) {
      const ad = Math.abs(cands[i]);
      if (ad > 1e-4 && ad < bestAbs) { bestAbs = ad; best = cands[i]; }
    }
    return bestAbs < range ? best : 0;
  }

  magnetSnap(obj) {
    if (!obj) return null;
    obj.updateWorldMatrix(true, true);
    const a = new THREE.Box3().setFromObject(obj);
    if (a.isEmpty()) return null;
    const wp = new THREE.Vector3();
    obj.getWorldPosition(wp);

    let bestDx = 0, bestDy = 0, bestDz = 0, bestScore = this.MAGNET_RANGE, bestName = null, bestObj = null;

    // Ímã na face INTERNA da parede mais próxima
    const innerXp = this.BODY_W / 2 - this.wth;
    const innerXm = -this.BODY_W / 2 + this.wth;
    const innerZp = this.Lt / 2 - this.wth;
    const innerZm = -this.Lt / 2 + this.wth;
    const innerCands = [
      { d: innerXp - a.max.x, axis: 'x', name: 'Parede +X (interna)' },
      { d: innerXm - a.min.x, axis: 'x', name: 'Parede −X (interna)' },
      { d: innerZp - a.max.z, axis: 'z', name: 'Parede traseira (interna)' },
      { d: innerZm - a.min.z, axis: 'z', name: 'Parede dianteira (interna)' },
    ];
    for (let i = 0; i < innerCands.length; i++) {
      const c = innerCands[i];
      const ad = Math.abs(c.d);
      if (ad > 1e-4 && ad < bestScore) {
        bestScore = ad;
        bestDx = c.axis === 'x' ? c.d : 0;
        bestDy = 0;
        bestDz = c.axis === 'z' ? c.d : 0;
        bestName = c.name;
      }
    }

    for (let i = 0; i < this.editableMeshes.length; i++) {
      const other = this.editableMeshes[i];
      if (other === obj || !other.parent || other.visible === false) continue;
      other.updateWorldMatrix(true, true);
      const b = new THREE.Box3().setFromObject(other);
      if (b.isEmpty()) continue;
      const dx = this.snapAxis(a.min.x, a.max.x, b.min.x, b.max.x, this.MAGNET_RANGE);
      const dy = this.snapAxis(a.min.y, a.max.y, b.min.y, b.max.y, this.MAGNET_RANGE);
      const dz = this.snapAxis(a.min.z, a.max.z, b.min.z, b.max.z, this.MAGNET_RANGE);
      if (!dx && !dy && !dz) continue;
      const score = Math.min(
        dx ? Math.abs(dx) : this.MAGNET_RANGE,
        dy ? Math.abs(dy) : this.MAGNET_RANGE,
        dz ? Math.abs(dz) : this.MAGNET_RANGE
      );
      if (score < bestScore) {
        bestScore = score;
        bestDx = dx; bestDy = dy; bestDz = dz;
        bestName = other.userData.name || 'objeto';
        bestObj = other;
      }
    }

    if (!bestObj && !bestDy && !bestDx && !bestDz) return null;
    if (bestScore >= this.MAGNET_RANGE) return null;
    obj.position.x += bestDx;
    obj.position.y += bestDy;
    obj.position.z += bestDz;
    this.magnetLastTarget = bestObj;
    const hint = document.getElementById('magnet-hint');
    if (hint) hint.textContent = 'ímã → ' + (bestName || 'objeto');
    return bestObj;
  }

  resolvePlacement(obj) {
    if (!obj) return;
    const floorY = this.FLOOR_Y;
    let box = new THREE.Box3().setFromObject(obj);
    if (box.min.y < floorY - 0.002) obj.position.y += floorY - box.min.y;
    const wx0 = -this.Li / 2 + this.wth, wx1 = this.Li / 2 - this.wth;
    const wz0 = -this.Lt / 2 + this.wth, wz1 = this.Lt / 2 - this.wth;
    box = new THREE.Box3().setFromObject(obj);
    if (box.max.z > wz0 && box.min.z < wz1 && box.min.y < this.WALL_H + floorY) {
      if (box.min.x < wx0) obj.position.x += wx0 - box.min.x;
      if (box.max.x > wx1) obj.position.x += wx1 - box.max.x;
      if (box.min.z < wz0) obj.position.z += wz0 - box.min.z;
      if (box.max.z > wz1) obj.position.z += wz1 - box.max.z;
    }
    for (let n = 0; n < 10; n++) {
      const a = new THREE.Box3().setFromObject(obj);
      let moved = false;
      this.editableMeshes.forEach((other) => {
        if (other === obj || !other.parent || other.visible === false) return;
        const b = new THREE.Box3().setFromObject(other);
        if (!a.intersectsBox(b)) return;
        const dxL = b.max.x - a.min.x, dxR = a.max.x - b.min.x;
        const dzL = b.max.z - a.min.z, dzR = a.max.z - b.min.z;
        const px = Math.min(dxL, dxR), pz = Math.min(dzL, dzR);
        if (px < 0.001 && pz < 0.001) return;
        if (px <= pz) obj.position.x += (dxL < dxR ? px + 0.004 : -(px + 0.004));
        else obj.position.z += (dzL < dzR ? pz + 0.004 : -(pz + 0.004));
        moved = true;
      });
      if (!moved) break;
    }
  }
}
