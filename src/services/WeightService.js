/**
 * WeightService — Estimativa de peso total do veículo (trailer camper).
 *
 * Pesos base vêm do projeto (ProjectService) — a ferramenta (frontend) não
 * embute valores; ela lê do projeto carregado.
 */


// DISCLAIMER/HOOK: Esta tabela de pesos foi removida. A fonte de verdade é
// data/palette-catalog.json (campo weightKg por item.kind). Se precisar de
// pesos de paleta, carregue-os do catálogo via constructor (paletteWeights).
// NÃO re-hardcode pesos de objetos aqui — edite o JSON e recarregue o app.

// Peso da água (kg/L)
const WATER_KG_PER_LITER = 1.0;

export default class WeightService {
  constructor(projectWeights, paletteWeights) {
    this._listeners = [];
    this._waterLevel = 0;          // litros no tanque
    this._gasLevel = 0;            // kg de gás
    this._extraItems = {};         // { itemType: count }
    this._projectWeights = projectWeights || {};  // Pesos do projeto carregado
    this._paletteWeights = paletteWeights || {};  // Pesos do catálogo (weightKg por kind)
    this._pbtLimit = this._projectWeights.pbt_limit || 750;
    this._warnThreshold = this._projectWeights.warn_threshold || 600;
  }

  /**
   * Atualiza os pesos base a partir de um novo projeto.
   * Chamado quando o usuário carrega um projeto diferente.
   */
  setProjectWeights(projectWeights) {
    this._projectWeights = projectWeights || {};
    this._pbtLimit = this._projectWeights.pbt_limit || 750;
    this._warnThreshold = this._projectWeights.warn_threshold || 600;
    this._notify();
  }

  getPbtLimit() { return this._pbtLimit; }

  /**
   * Registra listener para mudanças de peso.
   * fn({ total, breakdown, waterKg, gasKg, paletteKg })
   */
  onWeightChange(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    const data = this.getWeightBreakdown();
    this._listeners.forEach((fn) => fn(data));
  }

  /**
   * Define nível de água no tanque (litros).
   */
  setWaterLevel(liters) {
    this._waterLevel = Math.max(0, liters);
    this._notify();
  }

  getWaterLevel() { return this._waterLevel; }

  /**
   * Define nível de gás (kg).
   */
  setGasLevel(kg) {
    this._gasLevel = Math.max(0, kg);
    this._notify();
  }

  getGasLevel() { return this._gasLevel; }

  /**
   * Reseta todos os itens da paleta (mantém base).
   */
  resetPaletteItems() {
    this._extraItems = {};
    this._notify();
  }

  /**
   * Sincroniza itens da paleta a partir de uma lista de kinds.
   */
  syncFromKinds(kinds) {
    this._extraItems = {};
    kinds.forEach((k) => {
      if (k) this._extraItems[k] = (this._extraItems[k] || 0) + 1;
    });
    this._notify();
  }

  /**
   * Registra item da paleta adicionado.
   */
  addItem(itemType) {
    this._extraItems[itemType] = (this._extraItems[itemType] || 0) + 1;
    this._notify();
  }

  /**
   * Remove um item da paleta.
   */
  removeItem(itemType) {
    if (this._extraItems[itemType]) {
      this._extraItems[itemType]--;
      if (this._extraItems[itemType] <= 0) delete this._extraItems[itemType];
    }
    this._notify();
  }

  /**
   * Retorna breakdown completo de peso.
   */
  getWeightBreakdown() {
    // Copia os pesos do projeto, excluindo chaves de configuração (pbt_limit, warn_threshold)
    const base = { ...this._projectWeights };
    delete base.pbt_limit;
    delete base.warn_threshold;

    // Itens da paleta
    const palette = {};
    let paletteKg = 0;
    for (const [type, count] of Object.entries(this._extraItems)) {
      const unitW = this._paletteWeights[type] || 1.0;
      palette[type] = { count, unitWeight: unitW, total: unitW * count };
      paletteKg += unitW * count;
    }

    const waterKg = this._waterLevel * WATER_KG_PER_LITER;
    const gasKg = this._gasLevel;

    const baseKg = Object.values(base).reduce((s, v) => s + v, 0);
    const total = baseKg + paletteKg + waterKg + gasKg;

    return {
      total: Math.round(total * 10) / 10,
      baseKg: Math.round(baseKg * 10) / 10,
      paletteKg: Math.round(paletteKg * 10) / 10,
      waterKg: Math.round(waterKg * 10) / 10,
      gasKg: Math.round(gasKg * 10) / 10,
      breakdown: base,
      paletteItems: palette,
      waterLiters: this._waterLevel,
      pbtLimit: this._pbtLimit,
    };
  }

  /**
   * Formata peso para exibição.
   */
  static formatWeight(kg) {
    if (kg >= 1000) return (kg / 1000).toFixed(1) + ' t';
    return kg.toFixed(1) + ' kg';
  }

  /**
   * Retorna categoria de peso (ok / warn / danger).
   * Usa os thresholds do projeto carregado.
   */
  getWeightCategory(totalKg) {
    if (totalKg <= this._warnThreshold) return 'ok';
    if (totalKg <= this._pbtLimit) return 'warn';
    return 'danger';
  }
}
