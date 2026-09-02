/**
 * WeightService — Estimativa de peso total do veículo (trailer camper).
 *
 * Pesos baseados em materiais reais (compensado naval, aço, alumínio, EPS)
 * e dimensões do projeto. Atualizado dinamicamente conforme móveis são
 * adicionados/removidos da paleta.
 */

// Pesos base por componente (kg) — estimativa industrial
const BASE_WEIGHTS = {
  chassis:      52,   // Longarinas aço + treliça + roda de gato
  wheels:       16,   // 2 pneus 14" + rodas aço
  floor:        22,   // Compensado 15mm (3.0×1.5m) + chapa aluminio
  wallsExt:     38,   // Parede sanduíche (alu+EPS+comp) 4 faces
  roof:         18,   // Telhado comp+EPS+alu curvo
  skirt:         6,   // Saia lateral (4 painéis)
  mezzanine:    14,   // Estrutura mezanino + piso
  bathCube:     10,   // Cubo banheiro (3 paredes comp 15mm)
  kitchen:      12,   // Balcão + tampo + armário superior
  stairCabs:    10,   // 4 armários-degrau
  mattress:     10,   // Colchão casal 1.80×1.88
  plumbing:      4,   // Encanamento (água fria/quente + esgoto)
  electrical:    3,   // Fiação + quadro + disjuntores
  insulation:    8,   // EPS isolante parede + telhado
  fasteners:     5,   // Parafusos, presilhas, selante
};

// Pesos dos itens da paleta (kg por item)
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
  constructor() {
    this._listeners = [];
    this._waterLevel = 0;   // litros no tanque
    this._gasLevel = 0;     // kg de gás
    this._extraItems = {};  // { itemType: count }
  }

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
    const base = { ...BASE_WEIGHTS };

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
   */
  static getWeightCategory(totalKg) {
    // PBT típico de trailer leve: 750 kg (categoria B no Brasil)
    if (totalKg <= 600) return 'ok';
    if (totalKg <= 750) return 'warn';
    return 'danger';
  }
}
