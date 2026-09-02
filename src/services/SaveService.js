export default class SaveService {
  constructor({ editableMeshes, SAVE_KEY = 'trailer3d-layout-v7' }) {
    this.editableMeshes = editableMeshes;
    this.SAVE_KEY = SAVE_KEY;
    this.factoryLayout = null;
  }

  captureFactoryLayout(captureFn) {
    this.factoryLayout = captureFn();
  }

  serializeLayout() {
    return {
      v: 2,
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
        };
        const mat = m.material;
        if (mat && mat.isMeshStandardMaterial) {
          const c = mat.color;
          obj.mat = {
            color: [c.r, c.g, c.b],
            roughness: mat.roughness,
            metalness: mat.metalness,
            opacity: mat.opacity,
            transparent: mat.transparent,
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
        m.material.color.setRGB(st.mat.color[0], st.mat.color[1], st.mat.color[2]);
        if (st.mat.roughness != null) m.material.roughness = st.mat.roughness;
        if (st.mat.metalness != null) m.material.metalness = st.mat.metalness;
        if (st.mat.opacity != null) m.material.opacity = st.mat.opacity;
        if (st.mat.transparent != null) m.material.transparent = st.mat.transparent;
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

  resetLayout(aiLog) {
    const raw = localStorage.getItem(this.SAVE_KEY);
    if (raw) {
      const n = this.applySaved(JSON.parse(raw), {});
      if (typeof aiLog === 'function') aiLog('Reset: última posição salva (' + n + ' objetos).', 'sys');
      return;
    }
    if (this.factoryLayout) {
      this.factoryLayout.forEach((st) => {
        if (!st.mesh) return;
        if (st.parent && st.mesh.parent !== st.parent) st.parent.add(st.mesh);
        st.mesh.position.copy(st.p);
        st.mesh.rotation.copy(st.r);
        st.mesh.scale.copy(st.s);
      });
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
