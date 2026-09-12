export default class SaveService {
  constructor({ editableMeshes, scene = null, body = null, SAVE_KEY = 'trailer3d-layout-v7' }) {
    this.editableMeshes = editableMeshes;
    this.scene = scene;
    this.body = body;
    this.SAVE_KEY = SAVE_KEY;
    this.factoryLayout = null;
  }

  captureFactoryLayout(captureFn) {
    this.factoryLayout = captureFn();
  }

  serializeLayout() {
    return {
      v: 3,
      savedAt: new Date().toISOString(),
      objects: this.editableMeshes.filter((m) => m.parent).map((m) => {
        const obj = {
          name: m.userData.name,
          kind: m.userData.kind || null,
          buyUrl: m.userData.buyUrl || null,
          searchUrl: m.userData.searchUrl || null,
          productQuery: m.userData.productQuery || null,
          p: [m.position.x, m.position.y, m.position.z],
          r: [m.rotation.x, m.rotation.y, m.rotation.z],
          s: [m.scale.x, m.scale.y, m.scale.z],
          // Caixa geometry.parts: guarda medidas base para reabrir corretamente
          baseSizeMm: m.userData.baseSizeMm || null,
          thicknessMm: m.userData.thicknessMm || null,
          box_mm: m.userData.box_mm || null,
        };
        const mat = m.material;
        if (mat && mat.isMeshStandardMaterial) {
          const c = mat.color;
          const opaque = !(mat.transparent && (mat.opacity == null || mat.opacity <= 0.01));
          obj.mat = {
            color: [c.r, c.g, c.b],
            roughness: mat.roughness,
            metalness: mat.metalness,
            opacity: opaque ? mat.opacity : 1,
            transparent: opaque ? mat.transparent : false,
          };
        }
        const parts = [];
        m.traverse((ch) => {
          if (ch !== m && ch.userData && ch.userData.carpentryPart) {
            parts.push({
              spec: ch.userData.carpentryPart,
              p: [ch.position.x, ch.position.y, ch.position.z],
              r: [ch.rotation.x, ch.rotation.y, ch.rotation.z],
            });
          }
        });
        if (parts.length) obj.carpentry = parts;
        return obj;
      }),
    };
  }

  applySaved(data, { spawnPaletteItem, attachProductMeta, attachCarpentryPart }) {
    if (!data || !data.objects) return 0;
    let n = 0;
    data.objects.forEach((st) => {
      let m = this.editableMeshes.find((x) => x.userData.name === st.name);
      if (!m && st.kind && typeof spawnPaletteItem === 'function') {
        const fresh = spawnPaletteItem(st.kind);
        if (fresh) {
          fresh.userData.name = st.name;
          m = fresh;
        }
      }
      if (!m || !st.p) return;
      if (st.kind && typeof attachProductMeta === 'function') attachProductMeta(m, st.kind);
      if (st.buyUrl) m.userData.buyUrl = st.buyUrl;
      if (st.searchUrl) m.userData.searchUrl = st.searchUrl;
      if (st.productQuery) m.userData.productQuery = st.productQuery;
      m.position.set(st.p[0], st.p[1], st.p[2]);
      if (st.r) m.rotation.set(st.r[0], st.r[1], st.r[2]);
      if (st.s) m.scale.set(st.s[0], st.s[1], st.s[2]);
      if (st.mat && m.material && m.material.isMeshStandardMaterial) {
        m.material = m.material.clone();
        const label = `${st.kind || ''} ${st.name || ''}`.toLowerCase();
        const looksGlass = /vidro|janela|glass|spray/.test(label);
        const looksWood = /parede banheiro|dinete|mesa/.test(label);
        const greenLegacy = Array.isArray(st.mat.color)
          && Math.abs(st.mat.color[0] - 0.5019607843137255) < 1e-6
          && Math.abs(st.mat.color[1] - 0.7529411764705882) < 1e-6
          && Math.abs(st.mat.color[2] - 0.6274509803921569) < 1e-6;
        if (looksWood && greenLegacy) {
          m.material.color.setHex(0xa08050);
        } else {
          m.material.color.setRGB(st.mat.color[0], st.mat.color[1], st.mat.color[2]);
        }
        if (st.mat.roughness != null) m.material.roughness = st.mat.roughness;
        if (st.mat.metalness != null) m.material.metalness = st.mat.metalness;
        if (st.mat.transparent != null) m.material.transparent = st.mat.transparent;
        if (st.mat.opacity != null) m.material.opacity = st.mat.opacity;
        if (!looksGlass && st.mat.opacity != null && st.mat.opacity <= 0.01) {
          m.material.transparent = false;
          m.material.opacity = 1;
        }
        m.material.needsUpdate = true;
      }
      if (st.carpentry && Array.isArray(st.carpentry) && typeof attachCarpentryPart === 'function') {
        st.carpentry.forEach((p) => {
          const g = attachCarpentryPart(m, p.spec, null);
          if (g && p.p) g.position.set(p.p[0], p.p[1], p.p[2]);
          if (g && p.r) g.rotation.set(p.r[0], p.r[1], p.r[2]);
        });
      }
      n++;
    });
    return n;
  }

  saveLayout(aiLog) {
    try {
      const data = this.serializeLayout();
      localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
      const btn = document.getElementById('btn-save');
      if (btn) {
        const old = btn.textContent;
        btn.textContent = 'salvo';
        btn.classList.add('active');
        setTimeout(() => { btn.textContent = old; btn.classList.remove('active'); }, 1200);
      }
      if (typeof aiLog === 'function') aiLog('Layout salvo (' + data.objects.length + ' objetos).', 'sys');
    } catch (err) {
      alert('Falha ao salvar: ' + err.message);
    }
  }

  loadLayout(deps) {
    try {
      const raw = localStorage.getItem(this.SAVE_KEY);
      if (!raw) return;
      const n = this.applySaved(JSON.parse(raw), deps);
      if (n && typeof deps?.aiLog === 'function') deps.aiLog('Layout restaurado (' + n + ' objetos).', 'sys');
    } catch (err) { console.warn('loadLayout', err); }
  }

  _removeExtraByName(allowedNames) {
    if (!allowedNames || !allowedNames.size) return;
    for (let i = this.editableMeshes.length - 1; i >= 0; i--) {
      const m = this.editableMeshes[i];
      if (m && m.userData && m.userData.layoutProtected) {
        this.editableMeshes.splice(i, 1);
        continue;
      }
      const name = m && m.userData ? m.userData.name : null;
      if (!name || allowedNames.has(name)) continue;
      if (m.parent) m.parent.remove(m);
      this.editableMeshes.splice(i, 1);
    }
  }

  _removeExtraByMesh(allowedMeshes) {
    if (!allowedMeshes || !allowedMeshes.size) return;
    for (let i = this.editableMeshes.length - 1; i >= 0; i--) {
      const m = this.editableMeshes[i];
      if (m && m.userData && m.userData.layoutProtected) {
        this.editableMeshes.splice(i, 1);
        continue;
      }
      if (allowedMeshes.has(m)) continue;
      if (m.parent) m.parent.remove(m);
      this.editableMeshes.splice(i, 1);
    }
  }

  _cleanupOrphans() {
    if (this.scene && typeof this.scene.traverse === 'function') {
      const keep = new Set(this.editableMeshes.filter(Boolean));
      const toRemove = [];
      this.scene.traverse((obj) => {
        if (!obj || !obj.userData || !obj.userData.editable) return;
        if (obj.userData.layoutProtected) return;
        if (keep.has(obj)) return;
        if (!obj.parent) return;
        toRemove.push(obj);
      });
      toRemove.forEach((obj) => {
        if (obj.parent) obj.parent.remove(obj);
      });
    }
    if (this.body && typeof this.body.clearUserOpenings === 'function') {
      this.body.clearUserOpenings();
    }
  }

  resetLayout(aiLog, options = {}) {
    const forceFactory = options === true || !!options.forceFactory;
    const raw = !forceFactory ? localStorage.getItem(this.SAVE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      const allowed = new Set((parsed.objects || []).map((o) => o && o.name).filter(Boolean));
      this._removeExtraByName(allowed);
      const n = this.applySaved(parsed, {});
      (parsed.objects || []).forEach((o) => {
        if (!o || !o.name) return;
        const m = this.editableMeshes.find((x) => x && x.userData && x.userData.name === o.name);
        if (m && this.editableMeshes.indexOf(m) < 0) this.editableMeshes.push(m);
      });
      this._cleanupOrphans();
      if (typeof aiLog === 'function') aiLog('Reset: última posição salva (' + n + ' objetos).', 'sys');
      return;
    }
    if (this.factoryLayout) {
      const allowedMeshes = new Set(this.factoryLayout.map((st) => st.mesh));
      this._removeExtraByMesh(allowedMeshes);
      this.factoryLayout.forEach((st) => {
        if (!st.mesh) return;
        if (st.parent && st.mesh.parent !== st.parent) st.parent.add(st.mesh);
        st.mesh.position.copy(st.p);
        st.mesh.rotation.copy(st.r);
        st.mesh.scale.copy(st.s);
        if (this.editableMeshes.indexOf(st.mesh) < 0) this.editableMeshes.push(st.mesh);
      });
      this._cleanupOrphans();
      if (typeof aiLog === 'function') aiLog('Reset: layout original.', 'sys');
    }
  }

  /**
   * Aplica um layout serializado a partir de um arquivo do usuário.
   * Aceita as dependências necessárias (spawnPaletteItem, attachProductMeta, attachCarpentryPart).
   */
  applyCapturedFromLayout(layout, deps = {}) {
    return this.applySaved(layout, deps);
  }
}
