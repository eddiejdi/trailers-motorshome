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
    if (!data.dimensions || !data.weights_kg) throw new Error('Projeto faltando dimensions ou weights_kg');
    this.project = data;
    this._emit('change', this.project);
    return this.project;
  }

  resetToDefault() {
    this.project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    this._emit('change', this.project);
    return this.project;
  }

  downloadProject() {
    const blob = new Blob([JSON.stringify(this.project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (this.project.meta?.name || 'projeto').replace(/[^a-z0-9-_]+/gi, '-');
    a.download = safeName + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  openProjectFile() {
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
          const proj = this.loadProject(data);
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
      return '<div class="s"><span>' + s.label + '</span><strong>' + this.formatSpec(s) + '</strong></div>';
    }).join('');
    rootEl.innerHTML = rows;
  }
}
