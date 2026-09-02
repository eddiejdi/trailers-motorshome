const THREE = window.THREE;

export default class MarcenariaService {
  constructor({ M, matFn, editableMeshes, selectedRef, pushUndoFn, selectObjectFn, resolvePlacementFn, saveLayoutFn, roofTopFn, FLOOR_Y }) {
    this.M = M;
    this.mat = matFn;
    this.editableMeshes = editableMeshes;
    this._selectedRef = selectedRef;
    this.pushUndo = pushUndoFn;
    this.selectObject = selectObjectFn;
    this.resolvePlacement = resolvePlacementFn;
    this.saveLayout = saveLayoutFn;
    this.roofTop = roofTopFn;
    this.FLOOR_Y = FLOOR_Y;

    this.CARPENTRY_CATALOG = null;
    this.mcFurnObj = null;
    this.mcFurnRenderer = null;
    this.mcFurnScene = null;
    this.mcFurnCam = null;
    this.mcFurnPivot = null;
    this.mcFurnControls = null;
    this.mcFurnRay = null;
  }

  set selected(val) { this._selectedRef.current = val; }
  get selected() { return this._selectedRef.current; }

  carpentryRole(ctx) {
    const n = ((ctx && ctx.name) || '') + ' ' + ((ctx && ctx.kind) || '');
    const t = n.toLowerCase();
    if (/escada|stair/.test(t)) return 'stair';
    if (/cama|bed|colch/.test(t)) return 'bed';
    if (/banco|dinette|mesa|poltrona/.test(t)) return 'dinette';
    if (/cozinha|pia|balc|tampo/.test(t)) return 'kitchen';
    if (/arm[aá]rio.*roupa|guarda.roupa|closet|wardrobe/.test(t)) return 'wardrobe';
    if (/arm[aá]rio.*a[eé]reo|locker|overhead/.test(t)) return 'overhead';
    if (/ba[uú]|storage|bench.*storage/.test(t)) return 'bench_storage';
    return 'cabinet';
  }

  furnitureContext(obj) {
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const near = [];
    this.editableMeshes.forEach((m) => {
      if (m === obj || !m.parent) return;
      const b = new THREE.Box3().setFromObject(m);
      if (b.intersectsBox(box.clone().expandByScalar(0.25))) {
        near.push(m.userData.name || 'obj');
      }
    });
    return {
      name: obj.userData.name || 'Móvel',
      kind: obj.userData.kind || null,
      size: { w: size.x, h: size.y, d: size.z },
      near: near.slice(0, 8),
    };
  }

  async loadCarpentryCatalog() {
    if (this.CARPENTRY_CATALOG) return this.CARPENTRY_CATALOG;
    try {
      const r = await fetch('carpentry_catalog.json', { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      this.CARPENTRY_CATALOG = await r.json();
    } catch (e) {
      this.CARPENTRY_CATALOG = { roles: {}, meta: {} };
    }
    return this.CARPENTRY_CATALOG;
  }

  fallbackCarpentrySuggestions(ctx) {
    const role = this.carpentryRole(ctx);
    const w = Math.max(0.18, Math.min(0.55, (ctx.size.w || 0.6) * 0.55));
    const d = Math.max(0.18, Math.min(0.42, (ctx.size.d || 0.5) * 0.7));
    const hCab = Math.max(0.2, ctx.size.h || 0.5);
    const byRole = {
      stair: [
        { id: 'gaveta-degrau', type: 'drawer', title: 'Gaveta no degrau', rationale: 'Gaveta rasa na frente de um degrau.', w: Math.min(w, 0.32), h: Math.min(0.14, hCab * 0.35), d: 0.28, face: 'front' },
        { id: 'porta-degrau', type: 'door', title: 'Porta do nicho', rationale: 'Porta de batente no corpo do degrau.', w: Math.min(w, 0.28), h: Math.min(0.28, hCab * 0.7), d: 0.016, face: 'front' },
      ],
      dinette: [
        { id: 'gaveta-banco', type: 'drawer', title: 'Gaveta sob o banco', rationale: 'Gaveta no assento.', w, h: 0.12, d, face: 'front' },
        { id: 'porta-bau', type: 'door', title: 'Porta do baú', rationale: 'Tampo/porta do baú do banco.', w: w * 0.9, h: 0.018, d, face: 'top' },
      ],
      kitchen: [
        { id: 'gaveta-front', type: 'drawer', title: 'Gaveta frontal', rationale: 'Gaveta baixa na frente.', w, h: 0.12, d, face: 'front' },
        { id: 'porta-batente', type: 'door', title: 'Porta de batente', rationale: 'Porta fina com recorte.', w: w * 0.95, h: Math.min(0.55, hCab * 0.72), d: 0.018, face: 'front' },
      ],
      cabinet: [
        { id: 'gaveta-front', type: 'drawer', title: 'Gaveta frontal', rationale: 'Gaveta rasa no terço inferior.', w, h: 0.12, d, face: 'front' },
        { id: 'porta-batente', type: 'door', title: 'Porta de batente', rationale: 'Porta fina, dobradiça oculta.', w: w * 0.95, h: Math.min(0.55, hCab * 0.72), d: 0.018, face: 'front' },
      ],
    };
    return byRole[role] || byRole.cabinet;
  }

  async fetchCarpentrySuggestions(ctx) {
    await this.loadCarpentryCatalog();
    return this.fallbackCarpentrySuggestions(ctx);
  }

  attachCarpentryPart(parent, spec, worldPoint, localPoint) {
    if (!parent || !spec) return null;
    const wood = this.M.madeiraD || this.M.madeira;
    const g = new THREE.Group();
    g.userData.carpentryPart = spec;
    g.userData.kind = 'carpentry-' + spec.type;
    g.userData.name = (parent.userData.name || 'Móvel') + ' · ' + spec.title;
    g.userData.editable = true;
    g.userData.matFamily = 'wood';
    const w = spec.w || 0.3, h = spec.h || 0.12, d = spec.d || 0.25;
    if (spec.type === 'cutout') {
      const cut = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(0x2a241c, { roughness: 0.9 }));
      g.add(cut);
    } else if (spec.type === 'door') {
      const door = new THREE.Mesh(new THREE.BoxGeometry(w, h, Math.max(0.016, d)), wood);
      const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 8), this.M.aluminio);
      kn.rotation.z = Math.PI / 2;
      kn.position.set(w * 0.38, 0, d / 2 + 0.01);
      g.add(door);
      g.add(kn);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(Math.min(0.12, w * 0.4), 0.01, 0.012), this.M.aluminio);
      handle.position.set(0, 0, d / 2 + 0.008);
      g.add(body);
      g.add(handle);
    }
    parent.add(g);
    if (localPoint) {
      g.position.copy(localPoint);
    } else if (worldPoint) {
      g.position.copy(parent.worldToLocal(worldPoint.clone()));
    } else {
      const pbox = new THREE.Box3().setFromObject(parent);
      const psize = new THREE.Vector3();
      pbox.getSize(psize);
      const face = spec.face || 'front';
      if (face === 'left') g.position.set(-psize.x / 2 + d / 2, 0, 0);
      else if (face === 'right') g.position.set(psize.x / 2 - d / 2, 0, 0);
      else if (face === 'top') g.position.set(0, psize.y / 2 - h / 2, 0);
      else g.position.set(0, psize.y * 0.15, psize.z / 2 - d / 2);
    }
    if (!this.editableMeshes.includes(g)) this.editableMeshes.push(g);
    return g;
  }

  async openMarcenaria() {
    if (!this.selected) return;
    const ov = document.getElementById('marcenaria-overlay');
    const ctxEl = document.getElementById('mc-ctx');
    const st = document.getElementById('mc-status');
    const ctx = this.furnitureContext(this.selected);
    if (ctxEl) ctxEl.innerHTML = '<b>' + ctx.name + '</b>';
    this.mcFurnObj = this.selected;
    const local = this.fallbackCarpentrySuggestions(ctx);
    this._renderMcCards(local);
    if (st) st.textContent = 'Arraste uma peça até a miniatura do móvel.';
    if (ov) ov.classList.add('open');
    try {
      const list = await this.fetchCarpentrySuggestions(ctx);
      this._renderMcCards(list);
    } catch (err) {
      if (st) st.textContent = 'IA indisponível. Arraste as peças locais.';
    }
  }

  _renderMcCards(list) {
    const wrap = document.getElementById('mc-sugs');
    if (!wrap) return;
    wrap.innerHTML = '';
    list.forEach((s) => {
      const el = document.createElement('div');
      el.className = 'mc-card';
      el.innerHTML = '<div class="mc-type">' + s.type + '</div><h4>' + s.title + '</h4><p>' + (s.rationale || '') + '</p>';
      const apply = document.createElement('button');
      apply.type = 'button';
      apply.className = 'mc-apply';
      apply.textContent = 'Aplicar no móvel';
      apply.addEventListener('click', () => {
        this.pushUndo();
        this.attachCarpentryPart(this.mcFurnObj || this.selected, s, null, null);
        if (this.mcFurnObj) this.selectObject(this.mcFurnObj);
        if (typeof this.saveLayout === 'function') this.saveLayout();
      });
      el.appendChild(apply);
      wrap.appendChild(el);
    });
  }

  updateMarcenariaButton(selected, materialFamilyOfFn) {
    const btn = document.getElementById('btn-marcenaria');
    if (!btn) return;
    const ok = !!selected && materialFamilyOfFn(selected) === 'wood';
    btn.disabled = !ok;
    btn.classList.toggle('enabled', ok);
    btn.title = ok ? 'Personalizar marcenaria deste móvel' : 'Selecione um elemento de madeira';
  }
}
