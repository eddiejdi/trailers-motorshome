/**
 * WeightService — Estimativa de peso total do veículo (trailer camper).
 *
 * Pesos base vêm do projeto (ProjectService) — a ferramenta (frontend) não
 * embute valores; ela lê do projeto carregado.
 */

const PALETTE_WEIGHTS = {
  // Móveis & Eletro
  'pia':             2.5,
  'comoda':          8.0,
  'armario':        10.0,
  'banco':           6.0,
  'mesa':            4.0,
  'dinette':        12.0,
  'recpro-38':       8.0,
  'recpro-44':      10.0,
  'camper-40':       9.0,
  'pe-dinete-12v':   3.0,
  'snap-base':       4.0,
  'geladeira':       8.5,

  // Portas & Janelas
  'porta':           6.0,
  'porta-int':       4.0,
  'janela':          3.5,
  'janela-50x35':    3.0,
  'janela-70x40':    3.5,
  'janela-90x45':    4.0,
  'janela-120x50':   5.0,
  'janela-pp-350':   2.5,
  'janela-fixa-120': 4.5,
  'janela-kg-750':   4.0,
  'janela-kg-leitosa': 3.5,
  'exaustor':        1.5,
  'exaustor-anti':   2.0,
  'vent-exaust':     1.8,
  'exaustor-coifa':  2.5,

  // Instalações
  'potti':           3.0,
  'tanque':          2.0,  // vazio
  'quadro':          1.5,
  'tanque-40':       3.5,  // vazio
  'caixa-agua-80':   4.5,  // vazio
  'caixa-agua-100':  5.5,  // vazio
  'caixa-agua-130':  6.0,  // vazio
  'caixa-agua-152':  7.0,  // vazio
  'tanque-agua-30':  2.5,  // vazio 30/40L
  'reservatorio-40': 4.0,  // vazio c/ rodas

  // Iluminação
  'led-strip':       0.5,
  'plafon':          0.4,
  'spot-led':        0.2,

  // Ventilação
  'claraboia-280':   1.0,
  'claraboia-400':   1.5,
  'grade-vent':      0.8,

  // Banheiro
  'box-banheiro':    4.0,
  'ducha-ext':       1.5,

  // Acessórios
  'escada-ret':      3.0,
  'porta-copo':      0.8,
  'mesa-dob':        2.5,
  'calco':           1.0,
  'calco-inox':      1.2,
  'pingadeira':      0.6,
  'boiler':          3.0,
  'cozinha-compacta': 8.0,
  'trava-porta':     0.3,
  'caixa-gas':       2.0,

  // Climatização
  'clima-evap':      4.0,
  'ac-portatil':    12.0,
  'ac-teto':         6.0,

  // Elétrica
  'entrada-cabos':   0.5,
  'painel-dj':       1.0,
};

// Peso da água (kg/L)
const WATER_KG_PER_LITER = 1.0;

export default class WeightService {
  constructor(projectWeights) {
    this._listeners = [];
    this._waterLevel = 0;          // litros no tanque
    this._gasLevel = 0;            // kg de gás
    this._extraItems = {};         // { itemType: count }
    this._projectWeights = projectWeights || {};  // Pesos do projeto carregado
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
      const unitW = PALETTE_WEIGHTS[type] || 1.0;
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
