/**
 * Project Spec — fonte única de verdade para o painel "Dimensões".
 *
 * Cada item referencia constantes de Dimensions.js (modelo do projeto)
 * em vez de hardcodar valores. O main.js popula o #specs dinamicamente.
 *
 * Formato:
 *   { key, label, value }            — valor já calculado (string)
 *   { key, label, compute(d) }       — valor dinâmico a partir das dimensões
 *   { key, label, ref: 'NAME' }      — lê de Dimensions.js (valor fixo formatado)
 */

import {
  L, BODY_W, Li, Lt, Hint, WALL_H, BATH_W, wth,
  MATTRESS_CASAL_L, N_STEPS, STAIR_W, TREAD_D,
  DOOR_W, DOOR_H, mzL, mzW, CHASSIS_BEAM_H, CHASSIS_BEAM_W,
  ROOF_W, ROOF_RISE, mzFloorH,
} from './Dimensions.js';

const m2 = (n) => n.toFixed(2).replace('.', ',') + ' m';

/**
 * Lista de specs do projeto (ordem = ordem de exibição).
 * Manter alinhado com o que aparece no painel "Dimensões" do frontend.
 */
export const PROJECT_SPECS = [
  { key: 'chassi',         label: 'Chassi',                  value: m2(L) + ' × ' + m2(BODY_W - 0.40) },
  { key: 'caixa',          label: 'Caixa (fora da roda)',    value: m2(L) + ' × ' + m2(BODY_W) },
  { key: 'internas',       label: 'Internas',                value: m2(Li) + ' × ' + m2(Lt) },
  { key: 'altura-interna', label: 'Altura interna',          value: m2(Hint) },
  { key: 'cama-casal',     label: 'Cama casal',              value: m2(MATTRESS_CASAL_L) + ' × ' + m2(Li) },
  { key: 'armarios-degrau',label: 'Armários-degrau',         value: m2(STAIR_W) + ' · ' + N_STEPS + ' níveis' },
  { key: 'banco-mesa',     label: 'Banco + mesa',            value: 'banco ' + m2(1.60) + '×' + m2(0.45) + ' · mesa à frente · cama ' + m2(1.60) + '×' + m2(0.99) },
  { key: 'cubo-banheiro',  label: 'Cubo banheiro',           value: m2(BATH_W) + ' × ' + m2(BATH_W) },
  { key: 'paredes-banheiro', label: 'Paredes banheiro',       value: '3× (' + m2(BATH_W) + '×' + m2(WALL_H) + ') comp 15mm · 6 kg' },
  { key: 'geladeira',      label: 'Geladeira 12V',           value: m2(0.585) + ' × ' + m2(0.44) },
  { key: 'porta-potti',    label: 'Porta Potti',             value: m2(0.42) + ' × ' + m2(0.42) },
];

/**
 * Renderiza o painel #specs dinamicamente.
 * Idempotente — pode ser chamado várias vezes.
 */
export function renderSpecPanel(rootEl) {
  if (!rootEl) return;
  const rows = PROJECT_SPECS.map(s => {
    return '<div class="s"><span>' + s.label + '</span><strong>' + s.value + '</strong></div>';
  }).join('');
  rootEl.innerHTML = rows;
}
