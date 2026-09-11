
function escHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
/**
 * ProjectService — carrega e gerencia o arquivo de projeto.
 *
 * O projeto (.json) contém:
 *   - meta: nome, versão, descrição
 *   - dimensions: medidas de todos os componentes
 *   - weights_kg: estimativa de peso de cada componente
 *   - specs: lista de linhas para o painel "Dimensões"
 */

const DEFAULT_PROJECT = {
  meta: {
    name: 'Trailer Nelcyr-Nardelli',
    version: '1.0.0',
    rev: 23,
    description: 'Família: 1 casal + 1 filha. Layout aberto (sem paredes divisórias), banheiro em cubo, mezanino da cama de casal sobre a lança.'
  },
  dimensions: {
    chassis:       { L: 3.00, W: 1.50 },
    body:          { L: 3.00, W: 1.90, H: 1.85 },
    interior:      { L: 2.90, W: 1.80, H: 1.80 },
    wall_thickness: 0.05,
    mattress_casal:{ L: 1.88, W: 1.38 },
    bath_cube:     { W: 0.80, H: 1.85 },
    bath_walls:    { count: 3, W: 0.80, H: 1.85, thickness: 0.015, material: 'compensado 15mm' },
    stair_cabs:    { count: 4, W: 0.30, rise: 0.34 },
    kitchen:       { counter: '0.58×0.85×0.22', geladeira: '0.32×0.585×0.22' },
    door_external: { W: 0.62, H: 1.60 },
    door_internal: { W: 0.55, H: 1.70 },
    potti:         { W: 0.42, H: 0.42 }
  },
  weights_kg: {
    chassis: 52, wheels: 16, floor: 22, wallsExt: 38, roof: 18, skirt: 6,
    mezzanine: 14, bathWalls: 6, bathFixtures: 4, kitchen: 12,
    stairCabs: 10, mattress: 10, plumbing: 4, electrical: 3,
    insulation: 8, fasteners: 5,
    pbt_limit: 750, warn_threshold: 600
  },
  specs: [
    { key: 'chassi',          label: 'Chassi',                  format: '{chassis.L} × {chassis.W}' },
    { key: 'caixa',           label: 'Caixa (fora da roda)',    format: '{body.L} × {body.W}' },
    { key: 'internas',        label: 'Internas',                format: '{interior.W} × {interior.L}' },
    { key: 'altura-interna',  label: 'Altura interna',          format: '{interior.H}' },
    { key: 'cama-casal',      label: 'Cama casal',              format: '{mattress_casal.W} × {mattress_casal.L}' },
    { key: 'armarios-degrau', label: 'Armários-degrau',         format: '{stair_cabs.W} · {stair_cabs.count} níveis' },
    { key: 'banco-mesa',      label: 'Banco + mesa',            format: 'banco 1,60×0,45 · mesa à frente' },
    { key: 'cubo-banheiro',   label: 'Cubo banheiro',           format: '{bath_cube.W} × {bath_cube.W}' },
    { key: 'paredes-banheiro',label: 'Paredes banheiro',        format: '{bath_walls.count}× ({bath_walls.W}×{bath_walls.H}m) {bath_walls.material} · {weights_kg.bathWalls} kg' },
    { key: 'geladeira',       label: 'Geladeira 12V',           format: '0,585 × 0,44' },
    { key: 'porta-potti',     label: 'Porta Potti',             format: '{potti.W} × {potti.W}' }
  ]
};

export default class ProjectService {
  constructor() {
    this.project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    this._listeners = { change: [] };
    /** @type {FileSystemFileHandle|null} */
    this._fileHandle = null;
    this._openFileName = null;
  }

  /**
   * Normaliza o projeto para o formato plano atual.
   */
  static normalize(data) {
    if (!data || typeof data !== 'object') return data;
    return data;
  }

  on(event, cb) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }

  _emit(event, payload) {
    (this._listeners[event] || []).forEach((cb) => {
      try { cb(payload); } catch (e) { /* ignore */ }
    });
  }

  getProject()        { return this.project; }
  getMeta()           { return this.project.meta; }
  getDimensions()     { return this.project.dimensions; }
  getWeights()        { return this.project.weights_kg; }
  getSpecs()          { return this.project.specs; }

  loadProject(data) {
    if (!data || typeof data !== 'object') throw new Error('Projeto inválido');
    data = ProjectService.normalize(data);
    if (!data.dimensions && !data.geometry) throw new Error('Projeto faltando dimensions ou geometry');
    this.project = data;
    this._emit('change', this.project);
    return this.project;
  }

  resetToDefault() {
    this.project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    this._fileHandle = null;
    this._openFileName = null;
    this._emit('change', this.project);
    return this.project;
  }

  /**
   * Gera geometry.parts de caixa aberta (fundo base full + 4 paredes).
   * L/P/H/t em milímetros (externo).
   */
  static buildOpenBoxParts(Lmm, Pmm, Hmm, tmm = 15) {
    const L = Lmm / 1000, P = Pmm / 1000, H = Hmm / 1000, t = tmm / 1000;
    const wallH = Math.max(t, H - t);
    const innerL = Math.max(t, L - 2 * t);
    const wallHmm = Math.round(wallH * 1000);
    const innerLmm = Math.round(innerL * 1000);
    return [
      {
        name: 'Fundo', role: 'base',
        box_mm: [Lmm, tmm, Pmm], box: [L, t, P],
        position: [0, t / 2, 0], rotation: [0, 0, 0],
        cut_mm: { comp: Math.max(Lmm, Pmm), larg: Math.min(Lmm, Pmm), esp: tmm },
      },
      {
        name: 'Lateral 1', role: 'lateral_esquerda',
        box_mm: [tmm, wallHmm, Pmm], box: [t, wallH, P],
        position: [-(L / 2 - t / 2), t + wallH / 2, 0], rotation: [0, 0, 0],
        cut_mm: { comp: wallHmm, larg: Pmm, esp: tmm },
      },
      {
        name: 'Lateral 2', role: 'lateral_direita',
        box_mm: [tmm, wallHmm, Pmm], box: [t, wallH, P],
        position: [+(L / 2 - t / 2), t + wallH / 2, 0], rotation: [0, 0, 0],
        cut_mm: { comp: wallHmm, larg: Pmm, esp: tmm },
      },
      {
        name: 'Frente', role: 'frente',
        box_mm: [innerLmm, wallHmm, tmm], box: [innerL, wallH, t],
        position: [0, t + wallH / 2, -(P / 2 - t / 2)], rotation: [0, 0, 0],
        cut_mm: { comp: Math.max(innerLmm, wallHmm), larg: Math.min(innerLmm, wallHmm), esp: tmm },
      },
      {
        name: 'Trás', role: 'fundo_parede',
        box_mm: [innerLmm, wallHmm, tmm], box: [innerL, wallH, t],
        position: [0, t + wallH / 2, +(P / 2 - t / 2)], rotation: [0, 0, 0],
        cut_mm: { comp: Math.max(innerLmm, wallHmm), larg: Math.min(innerLmm, wallHmm), esp: tmm },
      },
    ];
  }

  /**
   * Atualiza this.project a partir do grupo 3D project-box (escala → mm reais).
   * Garante que download/save gravem as medidas atuais, não o JSON antigo.
   */
  syncFromBoxGroup(boxGroup) {
    if (!boxGroup || !boxGroup.userData || boxGroup.userData.kind !== 'project-box') return null;
    const base = boxGroup.userData.baseSizeMm || { L: 1200, P: 500, H: 950 };
    const L = Math.max(50, Math.round(base.L * (boxGroup.scale.x || 1)));
    const P = Math.max(50, Math.round(base.P * (boxGroup.scale.z || 1)));
    const H = Math.max(50, Math.round(base.H * (boxGroup.scale.y || 1)));
    const t = Math.max(3, Math.round(boxGroup.userData.thicknessMm || 15));

    if (!this.project.geometry) this.project.geometry = { format: 'parts', parts: [] };
    this.project.geometry.format = 'parts';
    this.project.geometry.kind = 'open-box';
    this.project.geometry.projectType = 'box';
    this.project.geometry.unit = 'm';
    this.project.geometry.parts = ProjectService.buildOpenBoxParts(L, P, H, t);
    if (!this.project.geometry.material) {
      this.project.geometry.material = {
        type: 'standard', color: '#c9a86c', roughness: 0.85,
        thickness_mm: t, label: 'COMPENSADO CRU NU ' + t + ' mm MULTIMARCAS BR',
      };
    } else {
      this.project.geometry.material.thickness_mm = t;
      this.project.geometry.material.label = 'COMPENSADO CRU NU ' + t + ' mm MULTIMARCAS BR';
    }
    if (!this.project.dimensions_mm) this.project.dimensions_mm = {};
    this.project.dimensions_mm.externo = { largura_X: L, profundidade_Z: P, altura_Y: H };
    this.project.dimensions_mm.espessura = t;
    this.project.dimensions_mm.interno = {
      largura_X: Math.max(0, L - 2 * t),
      profundidade_Z: Math.max(0, P - 2 * t),
      altura_Y: Math.max(0, H - t),
    };
    if (!this.project.meta) this.project.meta = { name: 'Caixa', version: '1.0.0', rev: 1 };
    this.project.meta.rev = (Number(this.project.meta.rev) || 0) + 1;
    // Reset scale conceptual: próximo load reconstrói em 1:1
    boxGroup.userData.baseSizeMm = { L, P, H };
    boxGroup.userData.thicknessMm = t;
    this._emit('change', this.project);
    return { L, P, H, t, rev: this.project.meta.rev };
  }


  getOpenFileName() {
    return this._openFileName || (this.project.meta && this.project.meta.name) || null;
  }

  getFileHandle() {
    return this._fileHandle;
  }

  clearFileHandle() {
    this._fileHandle = null;
    this._openFileName = null;
  }

  downloadProject() {
    if (!this.project.meta) this.project.meta = {};
    this.project.meta.exportedAt = new Date().toISOString();
    const blob = new Blob([JSON.stringify(this.project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (this.project.meta?.name || 'projeto').replace(/[^a-z0-9-_]+/gi, '-');
    const rev = this.project.meta?.rev != null ? '_rev' + this.project.meta.rev : '';
    a.download = safeName + rev + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Grava this.project no arquivo que foi aberto (sobrescreve).
   * Requer File System Access API + handle com permissão de escrita.
   * @returns {Promise<{ok:boolean, mode:'overwrite'|'download'|'none', name?:string, error?:string}>}
   */
  async saveToOpenFile() {
    if (!this.project.meta) this.project.meta = {};
    this.project.meta.exportedAt = new Date().toISOString();
    const text = JSON.stringify(this.project, null, 2);
    const handle = this._fileHandle;

    if (handle && typeof handle.createWritable === 'function') {
      try {
        // Garante permissão de escrita
        if (handle.queryPermission) {
          let perm = await handle.queryPermission({ mode: 'readwrite' });
          if (perm !== 'granted' && handle.requestPermission) {
            perm = await handle.requestPermission({ mode: 'readwrite' });
          }
          if (perm !== 'granted') {
            return { ok: false, mode: 'none', error: 'Sem permissão para gravar o arquivo' };
          }
        }
        const w = await handle.createWritable();
        await w.write(text);
        await w.close();
        const name = handle.name || this._openFileName || 'projeto.json';
        this._openFileName = name;
        return { ok: true, mode: 'overwrite', name };
      } catch (err) {
        return { ok: false, mode: 'none', error: err && err.message ? err.message : String(err) };
      }
    }

    // Sem handle: fallback download (não sobrescreve disco)
    this.downloadProject();
    return {
      ok: true,
      mode: 'download',
      name: (this.project.meta?.name || 'projeto') + '.json',
    };
  }

  openProjectFile() {
    const self = this;
    // Chromium: showOpenFilePicker mantém handle para sobrescrever no Salvar
    if (typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function') {
      return (async () => {
        try {
          const [handle] = await window.showOpenFilePicker({
            multiple: false,
            types: [{
              description: 'Projeto JSON',
              accept: { 'application/json': ['.json'] },
            }],
          });
          const file = await handle.getFile();
          const text = await file.text();
          const data = JSON.parse(text);
          self._fileHandle = handle;
          self._openFileName = handle.name || file.name;
          return self.loadProject(data);
        } catch (err) {
          // Usuário cancelou
          if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return null;
          throw err;
        }
      })();
    }

    // Fallback: <input type=file> (não permite sobrescrever o mesmo path)
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json,.json';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return resolve(null);
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          self._fileHandle = null; // input file não dá handle de escrita
          self._openFileName = file.name;
          const proj = self.loadProject(data);
          resolve(proj);
        } catch (err) { reject(err); }
      };
      input.click();
    });
  }

  formatSpec(spec) {
    const lookup = (path) => {
      const parts = path.split('.');
      let v = this.project;
      for (const p of parts) {
        if (v == null) return '';
        v = v[p];
      }
      if (typeof v === 'number') return v.toFixed(2).replace('.', ',');
      return v ?? '';
    };
    return spec.format.replace(/\{([^}]+)\}/g, (_, path) => lookup(path));
  }

  renderSpecPanel(rootEl) {
    if (!rootEl) return;
    const rows = this.project.specs.map((s) => {
      return '<div class="s"><span>' + escHtml(s.label) + '</span><strong>' + escHtml(this.formatSpec(s)) + '</strong></div>';
    }).join('');
    rootEl.innerHTML = rows;
  }
}
