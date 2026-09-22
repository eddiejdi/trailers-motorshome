/**
 * TrailerCatalogService — catálogo de reboques conhecidos (data/trailer-catalog.json).
 * Tanques/underfloor vêm do template JSON do modelo, nunca hardcoded no motor.
 */

const TANK_KINDS = new Set(['caixa-agua-100', 'caixa-detrito-100']);
const UNDERFLOOR_KINDS = new Set(['caixa-agua-100', 'caixa-detrito-100', 'segundo-piso']);

export default class TrailerCatalogService {
  constructor() {
    this.catalog = { version: 0, items: [] };
    this._byId = {};
  }

  async load(url = 'data/trailer-catalog.json') {
    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
    this.catalog = await resp.json();
    this._byId = {};
    for (const it of this.catalog.items || []) {
      if (it && it.id) this._byId[it.id] = it;
    }
    return this.catalog;
  }

  list() {
    return this.catalog.items || [];
  }

  get(id) {
    return this._byId[id] || null;
  }

  /**
   * Monta um projeto a partir do template do catálogo + scene_layout mínimo de underfloor.
   * Garante no máximo 1 de cada tank kind (nunca 4 caixas).
   */
  buildProjectFromTemplate(id, baseProject = null) {
    const item = this.get(id);
    if (!item || !item.template) return null;
    const t = item.template;
    const proj = baseProject && typeof baseProject === 'object'
      ? JSON.parse(JSON.stringify(baseProject))
      : {};

    proj.meta = Object.assign({}, proj.meta || {}, t.meta || {}, {
      catalogId: item.id,
      brand: item.brand,
      class: item.class,
      rev: (Number(proj.meta && proj.meta.rev) || 0) + 1,
    });
    if (t.dimensions) {
      proj.dimensions = Object.assign({}, proj.dimensions || {}, JSON.parse(JSON.stringify(t.dimensions)));
    }
    if (t.structure) {
      proj.structure = JSON.parse(JSON.stringify(t.structure));
    }

    const objects = Array.isArray(proj.scene_layout && proj.scene_layout.objects)
      ? proj.scene_layout.objects.filter((o) => !UNDERFLOOR_KINDS.has(o && o.kind))
      : [];

    const uf = t.underfloor || {};
    const tanks = Array.isArray(uf.tanks) ? uf.tanks : [];
    const seen = new Set();
    for (const tank of tanks) {
      if (!tank || !tank.kind || !TANK_KINDS.has(tank.kind)) continue;
      if (seen.has(tank.kind)) continue;
      seen.add(tank.kind);
      objects.push({
        name: tank.name || tank.kind,
        kind: tank.kind,
        p: tank.p || [0, 0.105, 0],
        r: tank.r || [0, 0, 0],
        s: tank.s || [1, 1, 1],
        mat: tank.mat || null,
      });
    }
    if (uf.segundo_piso && uf.segundo_piso.kind === 'segundo-piso') {
      const sp = uf.segundo_piso;
      objects.push({
        name: sp.name || 'Segundo piso (mezzanine)',
        kind: 'segundo-piso',
        p: sp.p || [0, 0.285, 0],
        r: sp.r || [0, 0, 0],
        s: sp.s || [1, 1, 1],
      });
    }

    proj.scene_layout = {
      v: 3,
      savedAt: new Date().toISOString(),
      catalogId: item.id,
      objects,
    };
    proj.underfloor = JSON.parse(JSON.stringify(uf));
    return proj;
  }

  /** Remove da lista de scene objects qualquer tank duplicado (mantém 1 por kind). */
  static pruneTankDuplicates(objects) {
    if (!Array.isArray(objects)) return [];
    const seen = new Set();
    const out = [];
    for (const o of objects) {
      const k = o && o.kind;
      if (TANK_KINDS.has(k)) {
        if (seen.has(k)) continue;
        seen.add(k);
      }
      out.push(o);
    }
    return out;
  }
}
