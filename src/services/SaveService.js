/** kinds no máximo 1× na cena */
const UNIQUE_KINDS = new Set(['caixa-agua-100','caixa-detrito-100','segundo-piso','dinette','carro-hb20']);
const REBUILD_KINDS = new Set([
  'segundo-piso', 'dinette', 'stair-cab', 'porta-int', 'potti', 'ducha', 'espelho',
  'coluna-mez', 'viga-mez', 'piso-mezanino', 'colchao-casal', 'travesseiro', 'guarda-corpo',
  'ecoflow-delta2', 'bateria-100ah', 'prateleira-60', 'prateleira-canto',
  'toldo-lateral', 'luz-externa', 'carro-hb20', 'engate-trailer-link',
  // janelas: NÃO rebuild por kind genérico — cada peça é kind da paleta (janela, janela-70x40, …)
]);

export default class SaveService {
  constructor({ editableMeshes, scene = null, body = null, SAVE_KEY = 'trailer3d-layout-v10' }) {
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
    const THREE = window.THREE;
    return {
      v: 4,
      coord: 'trailer-world',
      savedAt: new Date().toISOString(),
      objects: this.editableMeshes.filter((m) => m.parent).map((m) => {
        // p sempre em coords do trailer (mundo local do root), não do parent intermediário
        let px = m.position.x, py = m.position.y, pz = m.position.z;
        if (THREE && typeof m.getWorldPosition === 'function' && this.scene) {
          const wp = new THREE.Vector3();
          m.getWorldPosition(wp);
          // se trailer existe como ancestral, converter para local do trailer
          let trailer = m.parent;
          while (trailer && trailer.parent && trailer.parent !== this.scene) trailer = trailer.parent;
          if (trailer && trailer !== this.scene && typeof trailer.worldToLocal === 'function') {
            const lp = trailer.worldToLocal(wp.clone());
            px = lp.x; py = lp.y; pz = lp.z;
          } else {
            px = wp.x; py = wp.y; pz = wp.z;
          }
        }
        const obj = {
          name: m.userData.name,
          kind: m.userData.kind || null,
          buyUrl: m.userData.buyUrl || null,
          searchUrl: m.userData.searchUrl || null,
          productQuery: m.userData.productQuery || null,
          p: [px, py, pz],
          r: [m.rotation.x, m.rotation.y, m.rotation.z],
          s: [m.scale.x, m.scale.y, m.scale.z],
          fixedLayout: true,
          // Caixa geometry.parts: guarda medidas base para reabrir corretamente
          baseSizeMm: m.userData.baseSizeMm || null,
          thicknessMm: m.userData.thicknessMm || null,
          box_mm: m.userData.box_mm || null,
          cut_mm: m.userData.cut_mm || null,
          cuts: Array.isArray(m.userData.cuts) ? m.userData.cuts : null,
          params: m.userData.dinetteParams || m.userData.stairParams || null,
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


  _findMeshForState(st) {
    if (!st) return null;
    const byName = this.editableMeshes.find((x) => x && x.userData && x.userData.name === st.name);
    if (byName) return byName;
    if (st.kind && UNIQUE_KINDS.has(st.kind)) {
      return this.editableMeshes.find((x) => x && x.userData && x.userData.kind === st.kind) || null;
    }
    return null;
  }

  _dedupeUniqueKinds() {
    const keep = new Map();
    for (let i = this.editableMeshes.length - 1; i >= 0; i--) {
      const m = this.editableMeshes[i];
      const kind = m && m.userData ? m.userData.kind : null;
      if (!kind || !UNIQUE_KINDS.has(kind)) continue;
      if (keep.has(kind)) {
        if (m.parent) m.parent.remove(m);
        this.editableMeshes.splice(i, 1);
      } else keep.set(kind, m);
    }
  }

  applySaved(data, { spawnPaletteItem, attachProductMeta, attachCarpentryPart, applyMaderiteState } = {}) {
    if (!data || !data.objects) return 0;
    let n = 0;
    data.objects.forEach((st) => {
      let m = this._findMeshForState(st);
      const isMaderite = st.kind && String(st.kind).indexOf('maderite-painel') === 0;
      const isJanela = st.kind && String(st.kind).indexOf('janela') === 0;
      const wantsRebuild = st.kind && (REBUILD_KINDS.has(st.kind) || isMaderite || isJanela)
        && typeof spawnPaletteItem === 'function';
      if (wantsRebuild) {
        // Multi-instância (stair-cab, janela, maderite…): remove SÓ pelo nome.
        // Unique kinds (dinette, tanques…): remove pelo kind. Nunca apagar irmãos do mesmo kind.
        const toDrop = [];
        for (let i = 0; i < this.editableMeshes.length; i++) {
          const x = this.editableMeshes[i];
          if (!x || !x.userData) continue;
          const sameName = st.name && x.userData.name === st.name;
          const sameUniqueKind = !st.name && st.kind && UNIQUE_KINDS.has(st.kind)
            && x.userData.kind === st.kind;
          if (sameName || sameUniqueKind) toDrop.push(x);
        }
        toDrop.forEach((x) => {
          if (x.parent) x.parent.remove(x);
          const ix = this.editableMeshes.indexOf(x);
          if (ix >= 0) this.editableMeshes.splice(ix, 1);
        });
        m = null;
        const spawnOpts = { forceNew: true };
        if (st.name) spawnOpts.name = st.name;
        if (st.params) spawnOpts.params = st.params;
        if (st.box_mm) spawnOpts.box_mm = st.box_mm;
        if (st.cuts) spawnOpts.cuts = st.cuts;
        if (st.cut_mm) spawnOpts.cut_mm = st.cut_mm;
        const fresh = spawnPaletteItem(st.kind, spawnOpts);
        if (fresh) {
          fresh.userData.name = st.name || fresh.userData.name;
          m = fresh;
        }
      }
      if (!m && st.kind && !wantsRebuild && typeof spawnPaletteItem === 'function') {
        const spawnOpts = {};
        if (st.params) spawnOpts.params = st.params;
        if (st.box_mm) spawnOpts.box_mm = st.box_mm;
        if (st.cuts) spawnOpts.cuts = st.cuts;
        if (st.cut_mm) spawnOpts.cut_mm = st.cut_mm;
        const fresh = spawnPaletteItem(st.kind, spawnOpts);
        if (fresh) {
          fresh.userData.name = st.name;
          m = fresh;
        }
      }
      if (!m || !st.p) return;
      if (st.kind && typeof attachProductMeta === 'function') attachProductMeta(m, st.kind);
      if (isMaderite) {
        if (typeof applyMaderiteState === 'function') applyMaderiteState(m, st);
        else if (Array.isArray(st.box_mm) && st.box_mm.length >= 3 && window.THREE) {
          if (m.geometry && m.geometry.dispose) m.geometry.dispose();
          m.geometry = new window.THREE.BoxGeometry(st.box_mm[0] / 1000, st.box_mm[1] / 1000, st.box_mm[2] / 1000);
          m.userData.box_mm = st.box_mm.slice(0, 3);
          m.userData.cut_mm = st.cut_mm || null;
          m.userData.cuts = st.cuts || [];
        }
      }
      if (st.params) {
        m.userData.dinetteParams = st.params;
        if (st.kind === 'stair-cab') m.userData.stairParams = st.params;
      }
      if (st.buyUrl) m.userData.buyUrl = st.buyUrl;
      if (st.searchUrl) m.userData.searchUrl = st.searchUrl;
      if (st.productQuery) m.userData.productQuery = st.productQuery;
      // HOOK: geolocalização ABSOLUTA — p literal do JSON, sem somar FLOOR_Y/deck
      m.userData.fixedLayout = true;
      m.userData.coord = 'trailer-world';
      // anexa ao root do trailer se spawn colocou em grupo intermediário
      if (m.parent && m.parent.userData && m.parent.userData.kind === 'interior') {
        /* ok se interior.y=0 */
      }
      const px = Number(st.p[0]) || 0;
      const py = Number(st.p[1]) || 0;
      const pz = Number(st.p[2]) || 0;
      m.position.set(px, py, pz);
      if (st.r) m.rotation.set(Number(st.r[0]) || 0, Number(st.r[1]) || 0, Number(st.r[2]) || 0);
      if (st.s) m.scale.set(Number(st.s[0]) || 1, Number(st.s[1]) || 1, Number(st.s[2]) || 1);
      if (typeof m.updateMatrixWorld === 'function') m.updateMatrixWorld(true);
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
    this._dedupeUniqueKinds();
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
    const allowed = new Set((layout && layout.objects || []).map((o) => o && o.name).filter(Boolean));
    if (typeof this._removeExtraByName === 'function') {
      this._removeExtraByName(allowed, { pruneProtected: true });
    }
    const n = this.applySaved(layout, deps || {});
    this._dedupeUniqueKinds();
    if (typeof this._cleanupOrphans === 'function') this._cleanupOrphans();
    if (deps && typeof deps.pruneEditor === 'function') {
      try { deps.pruneEditor(); } catch (e) { /* ignore */ }
    }
    return n;
  }
}
