export default class ExportService {
  constructor() {
    this.CUT_W = 1.50;
    this.CUT_BW = 1.90;
    this.CUT_L = 3.00;
    this.CUT_LT = 2.90;
    this.CUT_LI = 1.80;
    this.CUT_HINT = 1.80;
    this.CUT_WTH = 0.05;
    this.CUT_WALLH = 1.85;
    this.CUT_MZL = 1.88;
    this.CUT_MZW = 1.90;
    this.CUT_MZFH = 1.50;
    this.CUT_FY = 0.55;
    this.CUT_DW = 0.62;
    this.CUT_DH = 1.60;
    this.CUT_DS = 0.08;
    this.CUT_IW = 0.55;
    this.CUT_IH = 1.70;
    this.CUT_IS = 0.02;
    this.CUT_BW_BATH = 0.80;
    this.CUT_BH = 1.85;
    this.CUT_BED_W = 0.70;
    this.CUT_BED_L = 1.60;
    this.CUT_ROOFW = 1.90;
    this.CUT_ROOFL = 2.90 + 1.88;
    this.CUT_ROOFR = 0.40;
    this.CUT_KX = 0.58;
    this.CUT_KY = 0.85;
    this.CUT_KZ = 0.22;
    this.CUT_STAIR_W = 0.30;
    this.CUT_TREAD_D = 0.32;
    this.CUT_STAIR_RISE = 0.2525;
    this.CUT_SKIRT_H = 0.27;
    this.CUT_SKIRT_D = 1.08;
    this.CUT_SKIRT_T = 0.03;
    this.CUT_WING_W = 0.20;

    this.CUT_PIECES = this._buildPieces();
    this._scenePieces = null;
    this.CUT_SHEETS = {
      10: { comp: 2.17, larg: 1.07, nome: 'Chapa 2200x1100mm (util 2170x1070mm)' },
      15: { comp: 2.17, larg: 1.07, nome: 'Chapa 2200x1100mm (util 2170x1070mm)' },
      18: { comp: 2.17, larg: 1.07, nome: 'Chapa 2200x1100mm (util 2170x1070mm)' },
      25: { comp: 2.17, larg: 1.07, nome: 'Chapa 2200x1100mm (util 2170x1070mm)' },
      40: { comp: 2.17, larg: 1.07, nome: 'Chapa 2200x1100mm (util 2170x1070mm)' },
    };
  }

  _buildPieces() {
    const pieces = [
      { nome: 'Piso interno', qtd: 1, comp: 2.90, larg: 1.80, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Piso', obs: 'Sobre assoalho metálico' },
      { nome: 'Piso mezanino', qtd: 1, comp: 1.88, larg: 1.80, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Piso', obs: 'Sobre a lança' },
      { nome: 'Parede lateral esquerda (caçamba)', qtd: 1, comp: 2.90, larg: 2.25, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Altura segue perfil do telhado' },
      { nome: 'Parede lateral direita (frente porta)', qtd: 1, comp: 2.07, larg: 2.25, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Da frente até o vão da porta' },
      { nome: 'Parede lateral direita (após porta)', qtd: 1, comp: 0.52, larg: 2.25, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Atrás do vão da porta' },
      { nome: 'Parede traseira', qtd: 1, comp: 1.90, larg: 2.00, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Topo curvo' },
      { nome: 'Parede frontal caçamba', qtd: 1, comp: 1.90, larg: 2.25, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Com vão do alçapão do mezanino' },
      { nome: 'Parede lateral esq. mezanino', qtd: 1, comp: 1.88, larg: 1.26, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Sobre a lança' },
      { nome: 'Parede lateral dir. mezanino', qtd: 1, comp: 1.88, larg: 1.26, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Sobre a lança' },
      { nome: 'Lintel porta entrada', qtd: 1, comp: 0.62, larg: 0.17, esp: 0.010, material: 'Compensado Naval 10mm', grupo: 'Parede externa', obs: 'Sobre a porta 62×160cm' },
      { nome: 'Soleira porta entrada', qtd: 1, comp: 0.62, larg: 0.08, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Parede externa', obs: 'Base da porta' },
      { nome: 'Parede banheiro fundo (+Z)', qtd: 1, comp: 0.80, larg: 1.85, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Banheiro', obs: 'Cabeceira da dinete' },
      { nome: 'Parede banheiro frente (-Z)', qtd: 1, comp: 0.80, larg: 1.85, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Banheiro', obs: 'Lado corredor' },
      { nome: 'Parede banheiro lateral (-X)', qtd: 1, comp: 0.80, larg: 1.85, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Banheiro', obs: 'Encosta na externa' },
      { nome: 'Batente porta banheiro esq.', qtd: 1, comp: 0.125, larg: 1.85, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Banheiro', obs: 'Vão 55cm' },
      { nome: 'Batente porta banheiro dir.', qtd: 1, comp: 0.125, larg: 1.85, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Banheiro', obs: 'Vão 55cm' },
      { nome: 'Lintel porta banheiro', qtd: 1, comp: 0.55, larg: 0.13, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Banheiro', obs: 'Acima da porta 55×170cm' },
      { nome: 'Painel saia lateral', qtd: 4, comp: 1.08, larg: 0.27, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Saia', obs: '2 por lado, fora das rodas' },
      { nome: 'Soffit da asa', qtd: 4, comp: 1.08, larg: 0.20, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Saia', obs: 'Embaixo da asa' },
      { nome: 'Frente do mezanino', qtd: 1, comp: 1.90, larg: 1.26, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Mezanino', obs: 'Parede frontal do loft' },
      { nome: 'Balcão pia (corpo)', qtd: 1, comp: 0.58, larg: 0.85, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Cozinha', obs: 'Fundo, parede traseira' },
      { nome: 'Tampo balcão cozinha', qtd: 1, comp: 0.62, larg: 0.24, esp: 0.018, material: 'Compensado Naval 18mm', grupo: 'Cozinha', obs: 'Sobre o balcão' },
      { nome: 'Armário superior cozinha', qtd: 1, comp: 0.62, larg: 0.38, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Cozinha', obs: 'Parede traseira, superior' },
      { nome: 'Banco-baú dinete', qtd: 1, comp: 1.60, larg: 0.45, esp: 0.42, material: 'Compensado Naval 15mm + espuma', grupo: 'Dinete', obs: 'Encosto na parede −X' },
      { nome: 'Tampo mesa (à frente)', qtd: 1, comp: 1.50, larg: 0.50, esp: 0.030, material: 'Compensado Naval 18mm', grupo: 'Dinete', obs: 'Pé 12V 740→370 mm' },
      { nome: 'Marco janela 50×50 (lateral)', qtd: 4, comp: 0.55, larg: 0.55, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Janelas', obs: '2 esq + 2 dir' },
      { nome: 'Marco janela traseira 80×50', qtd: 1, comp: 0.85, larg: 0.55, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Janelas', obs: 'Parede +Z' },
      { nome: 'Marco janela frontal 70×32', qtd: 1, comp: 0.75, larg: 0.37, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Janelas', obs: 'Frente da caçamba' },
      { nome: 'Marco janela mezanino 50×40', qtd: 2, comp: 0.55, larg: 0.45, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Janelas', obs: '1 esq + 1 dir' },
      { nome: 'Marco janela mezanino frontal 80×45', qtd: 1, comp: 0.85, larg: 0.50, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Janelas', obs: 'Frente do mezanino' },
      { nome: 'Alçapão mezanino (tampo)', qtd: 1, comp: 0.78, larg: 0.70, esp: 0.015, material: 'Compensado Naval 15mm', grupo: 'Mezanino', obs: 'Vão de acesso ao mezanino' },
    ];

    for (let i = 0; i < 4; i++) {
      const h = (i + 1) * this.CUT_STAIR_RISE;
      pieces.push({
        nome: 'Armário-degrau ' + (i + 1) + ' (corpo)',
        qtd: 1, comp: this.CUT_STAIR_W, larg: Math.round(h * 1000) / 1000, esp: 0.015,
        material: 'Compensado Naval 15mm', grupo: 'Escada',
        obs: 'Degrau ' + (i + 1) + ' — ' + Math.round(h * 100) + 'cm de altura',
      });
      pieces.push({
        nome: 'Tampo degrau ' + (i + 1),
        qtd: 1, comp: 0.33, larg: 0.31, esp: 0.015,
        material: 'Compensado Naval 15mm', grupo: 'Escada',
        obs: 'Topo do degrau ' + (i + 1),
      });
    }
    return pieces;
  }

  cutGroupByThickness(pieces) {
    const groups = {};
    pieces.forEach((p) => {
      const key = String(Math.round(p.esp * 1000));
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    });
    return groups;
  }

  cutPieceArea(p) { return p.comp * p.larg * p.qtd; }

  cutTotalArea(pieces) {
    return pieces.reduce((s, p) => s + this.cutPieceArea(p), 0);
  }

  mm(v) { return Math.round(v * 1000); }

  getPieces() {
    return this._scenePieces && this._scenePieces.length ? this._scenePieces : this.CUT_PIECES;
  }

  setScenePieces(pieces) {
    this._scenePieces = pieces;
  }

  cutTableHTML(thickness) {
    const groups = this.cutGroupByThickness(this.getPieces());
    const items = groups[String(thickness)] || [];
    if (items.length === 0) return '<p style="color:var(--ink-3);text-align:center;padding:20px">Nenhuma peça nesta espessura.</p>';

    const sheet = this.CUT_SHEETS[thickness] || this.CUT_SHEETS[15];
    const sheetArea = sheet.comp * sheet.larg;
    const totalArea = this.cutTotalArea(items);
    const sheets = Math.ceil(totalArea / sheetArea);
    const efficiency = ((totalArea / (sheets * sheetArea)) * 100).toFixed(0);

    let html = '';
    html += '<div class="cut-info"><b>Chapa de referência:</b> ' + sheet.nome + ' (' + this.mm(sheet.comp) + '×' + this.mm(sheet.larg) + 'mm)<br>';
    html += '<b>Área total:</b> ' + (totalArea * 1e6).toFixed(0) + ' cm² · <b>Chapas:</b> ' + sheets + ' (' + efficiency + '% aproveitamento)</div>';
    html += '<table class="cut-table"><thead><tr>';
    html += '<th class="col-n">#</th><th>Peça</th><th>Grupo</th><th class="col-dim">Comp.</th><th class="col-dim">Larg.</th><th>Esp.</th><th class="col-qty">Qtd</th><th class="col-area">Área</th><th>Obs</th>';
    html += '</tr></thead><tbody>';
    let n = 1;
    items.forEach((p) => {
      const area = this.cutPieceArea(p);
      html += '<tr>';
      html += '<td class="col-n">' + (n++) + '</td>';
      html += '<td class="col-name">' + p.nome + '</td>';
      html += '<td>' + p.grupo + '</td>';
      html += '<td class="col-dim">' + this.mm(p.comp) + '</td>';
      html += '<td class="col-dim">' + this.mm(p.larg) + '</td>';
      html += '<td>' + this.mm(p.esp) + '</td>';
      html += '<td class="col-qty">' + p.qtd + '</td>';
      html += '<td class="col-area">' + (area * 1e4).toFixed(0) + '</td>';
      html += '<td style="font-size:10px;color:var(--ink-3)">' + (p.obs || '') + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  cutSummaryHTML() {
    const groups = this.cutGroupByThickness(this.getPieces());
    let totalPieces = 0, totalArea = 0;
    let html = '';
    Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b)).forEach((t) => {
      const items = groups[t];
      const area = this.cutTotalArea(items);
      const count = items.reduce((s, p) => s + p.qtd, 0);
      totalPieces += count;
      totalArea += area;
      const sheets = Math.ceil(area / ((this.CUT_SHEETS[t] || this.CUT_SHEETS[15]).comp * (this.CUT_SHEETS[t] || this.CUT_SHEETS[15]).larg));
      html += '<div class="cut-stat"><div class="val">' + t + 'mm</div><div class="lbl">' + count + ' peça(s) · ' + sheets + ' chapa(s)</div></div>';
    });
    html = '<div class="cut-stat"><div class="val">' + totalPieces + '</div><div class="lbl">Total de peças</div></div>' + html;
    html += '<div class="cut-stat"><div class="val">' + (totalArea * 1e6).toFixed(0) + ' cm²</div><div class="lbl">Área total madeira</div></div>';
    return html;
  }

  cutCSV(leroyFormat = false) {
    const sep = leroyFormat ? ';' : ',';
    const lines = [];
    if (leroyFormat) {
      lines.push('Peça;Quantidade;Comprimento (mm);Largura (mm);Espessura (mm);Material;Grupo;Observacao');
    } else {
      lines.push('Nome,Quantidade,Comprimento_mm,Largura_mm,Espessura_mm,Material,Grupo,Observacao');
    }
    this.getPieces().forEach((p) => {
      const row = [
        p.nome, p.qtd, this.mm(p.comp), this.mm(p.larg), this.mm(p.esp),
        p.material, p.grupo, (p.obs || '').replace(/[,;]/g, ' '),
      ];
      lines.push(row.join(sep));
    });
    return lines.join('\n');
  }

  cutDownloadCSV(leroy = false) {
    const csv = this.cutCSV(leroy);
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = leroy ? 'plano_corte_leroy_merlin.csv' : 'plano_corte_trailer.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { URL.revokeObjectURL(url); }, 1000);
  }

  cutCopyList() {
    const csv = this.cutCSV(false);
    navigator.clipboard.writeText(csv).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = csv;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
    });
  }

  cutPrint() {
    const w = window.open('', '_blank');
    const groups = this.cutGroupByThickness(this.getPieces());
    const sheets = Object.keys(groups).sort((a, b) => parseInt(a) - parseInt(b));
    let html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Plano de Corte</title>';
    html += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Helvetica,Arial,sans-serif;color:#1f2430;padding:20px;background:#f5f7fb}h1{font-size:20px;margin-bottom:4px;color:#1b4fc0}h2{font-size:14px;color:#4a5366;margin-bottom:16px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;margin-bottom:20px;font-size:11px}th{background:#20262e;color:#fff;padding:8px 10px;text-align:left;text-transform:uppercase;font-size:9px}td{padding:6px 10px;border-bottom:1px solid #ebeef5}tr:nth-child(even){background:#f5f7fb}h3{font-size:14px;margin:20px 0 8px;color:#1b4fc0;border-bottom:2px solid #eaf1ff;padding-bottom:4px}@media print{body{background:#fff;padding:10mm}}</style></head><body>';
    html += '<h1>Plano de Corte — Trailer Nelcyr-Nardelli RL</h1>';
    html += '<h2>Compensado Naval · Cortes para envio à empresa de corte</h2>';
    let totalP = 0, totalA = 0;
    sheets.forEach((t) => {
      const items = groups[t];
      const sheet = this.CUT_SHEETS[t] || this.CUT_SHEETS[15];
      const area = this.cutTotalArea(items);
      const count = items.reduce((s, p) => s + p.qtd, 0);
      const sheets2 = Math.ceil(area / (sheet.comp * sheet.larg));
      totalP += count; totalA += area;
      html += '<h3>Compensado ' + t + 'mm — ' + count + ' peça(s) · ' + sheets2 + ' chapa(s)</h3>';
      html += '<table><thead><tr><th>#</th><th>Peça</th><th>Grupo</th><th>Comp</th><th>Larg</th><th>Esp</th><th>Qtd</th><th>Área</th><th>Obs</th></tr></thead><tbody>';
      let n = 1;
      items.forEach((p) => {
        html += '<tr><td>' + (n++) + '</td><td>' + p.nome + '</td><td>' + p.grupo + '</td>';
        html += '<td>' + this.mm(p.comp) + '</td><td>' + this.mm(p.larg) + '</td><td>' + this.mm(p.esp) + '</td>';
        html += '<td style="text-align:center;font-weight:700">' + p.qtd + '</td>';
        html += '<td style="text-align:right">' + (this.cutPieceArea(p) * 1e4).toFixed(0) + '</td>';
        html += '<td style="font-size:10px;color:#888">' + (p.obs || '') + '</td></tr>';
      });
      html += '</tbody></table>';
    });
    html += '<p style="font-size:10px;color:#8b93a7;margin-top:16px">Gerado por Trailer 3D Studio · ' + new Date().toLocaleString('pt-BR') + '</p>';
    html += '</body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 250);
  }
}
