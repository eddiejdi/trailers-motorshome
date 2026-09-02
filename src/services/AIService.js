const THREE = window.THREE;

export default class AIService {
  constructor({ editableMeshes, trailer, ollamaUrl = 'http://127.0.0.1:11440', ollamaModel = 'llama3.1:8b', setWorldPosFn, resolvePlacementFn, pushUndoFn, selectObjectFn, deselectObjectFn, updateEditorPanelFn, fillObjectFn, externalHistoryUrl = './command-journal.json', learningUrls = null }) {
    this.editableMeshes = editableMeshes;
    this.trailer = trailer;
    this.ollamaUrl = ollamaUrl;
    this.ollamaModel = ollamaModel;
    this.setWorldPos = setWorldPosFn;
    this.resolvePlacement = resolvePlacementFn;
    this.pushUndo = pushUndoFn;
    this.selectObject = selectObjectFn;
    this.deselectObject = deselectObjectFn;
    this.updateEditorPanel = updateEditorPanelFn;
    this.fillObject = fillObjectFn;

    this.chatLog = null;
    this.chatInput = null;
    this.chatSend = null;
    this.aiDot = null;

    this.commandHistoryKey = 'trailer3d-ai-command-history-v1';
    this.commandHistory = this._loadCommandHistory();
    this.externalHistoryUrl = externalHistoryUrl;
    this.learningUrls = learningUrls || {
      rules: './docs/ai/PROJECT_RULES.md',
      lessons: './docs/ai/LESSONS_LEARNED.md',
      log: './docs/ai/learning-log.jsonl',
      evals: './docs/ai/evals/trailer-cases.jsonl',
    };
    this.projectMemoryKey = 'trailer3d-ai-project-memory-v1';
    this.projectMemory = this._loadProjectMemory();
    this.feedbackKey = 'trailer3d-ai-feedback-v1';
    this.feedback = this._loadFeedback();
    this.lastInteraction = null;
  }

  setUIElements({ chatLog, chatInput, chatSend, aiDot }) {
    this.chatLog = chatLog;
    this.chatInput = chatInput;
    this.chatSend = chatSend;
    this.aiDot = aiDot;
  }

  aiLog(text, cls) {
    if (!this.chatLog) return;
    const div = document.createElement('div');
    div.className = 'msg-' + cls;
    div.textContent = text;
    this.chatLog.appendChild(div);
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }

  aiBusy(busy) {
    if (this.chatSend) this.chatSend.disabled = busy;
    if (this.aiDot) this.aiDot.className = 'dot ' + (busy ? 'busy' : '');
  }

  foldName(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  }

  _loadCommandHistory() {
    try {
      const raw = localStorage.getItem(this.commandHistoryKey);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  _saveCommandHistory() {
    try {
      localStorage.setItem(this.commandHistoryKey, JSON.stringify(this.commandHistory));
    } catch (e) {
      // Ignore localStorage quota or browser privacy limitations.
    }
  }

  _loadProjectMemory() {
    try {
      const raw = localStorage.getItem(this.projectMemoryKey);
      const parsed = JSON.parse(raw || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  _saveProjectMemory() {
    try {
      localStorage.setItem(this.projectMemoryKey, JSON.stringify(this.projectMemory));
    } catch (e) {
      // Ignore localStorage quota or browser privacy limitations.
    }
  }

  _loadFeedback() {
    try {
      const raw = localStorage.getItem(this.feedbackKey);
      const parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  _saveFeedback() {
    try {
      localStorage.setItem(this.feedbackKey, JSON.stringify(this.feedback.slice(-300)));
    } catch (e) {
      // Ignore localStorage quota or browser privacy limitations.
    }
  }

  recordFeedback(value, note = '') {
    const entry = {
      ts: new Date().toISOString(),
      value: value === 'good' ? 'good' : 'bad',
      note: String(note || '').slice(0, 240),
      lastInteraction: this.lastInteraction,
    };
    this.feedback.push(entry);
    if (this.feedback.length > 300) this.feedback = this.feedback.slice(-300);
    this._saveFeedback();
    this._appendHistory({
      text: 'feedback ' + entry.value + (entry.note ? ': ' + entry.note : ''),
      source: 'feedback-ui',
      status: 'captured',
    });
    return entry;
  }

  _appendHistory(entry) {
    this.commandHistory.push(Object.assign({ ts: new Date().toISOString() }, entry));
    if (this.commandHistory.length > 200) {
      this.commandHistory = this.commandHistory.slice(-200);
    }
    this._saveCommandHistory();
  }

  _historySignature(h) {
    return [
      String(h.ts || ''),
      String(h.source || ''),
      String(h.status || ''),
      String(h.text || ''),
    ].join('|');
  }

  _normalizeHistoryEntry(raw) {
    if (typeof raw === 'string') {
      return { text: raw, source: 'external-hook', status: 'imported' };
    }
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.text) return null;
    return {
      ts: raw.ts,
      text: String(raw.text),
      source: raw.source ? String(raw.source) : 'external-hook',
      status: raw.status ? String(raw.status) : 'imported',
    };
  }

  async importExternalHistory(url = this.externalHistoryUrl) {
    if (!url) return 0;
    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) return 0;
      const data = await resp.json();
      if (!Array.isArray(data)) return 0;
      const seen = new Set(this.commandHistory.map((h) => this._historySignature(h)));
      let added = 0;
      for (const item of data) {
        const entry = this._normalizeHistoryEntry(item);
        if (!entry) continue;
        const sig = this._historySignature(entry);
        if (seen.has(sig)) continue;
        this.commandHistory.push(Object.assign({ ts: new Date().toISOString() }, entry));
        seen.add(sig);
        added++;
      }
      if (added > 0) {
        if (this.commandHistory.length > 200) this.commandHistory = this.commandHistory.slice(-200);
        this._saveCommandHistory();
      }
      return added;
    } catch (e) {
      return 0;
    }
  }

  async importProjectMemory(urls = this.learningUrls) {
    const loadText = async (url) => {
      if (!url) return '';
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) return '';
        return await resp.text();
      } catch (e) {
        return '';
      }
    };
    const [rules, lessons, logRaw, evalsRaw] = await Promise.all([
      loadText(urls.rules),
      loadText(urls.lessons),
      loadText(urls.log),
      loadText(urls.evals),
    ]);
    const jsonlToBullets = (raw, limit) => {
      return raw.split('\n').map((line) => line.trim()).filter(Boolean).slice(-limit).map((line) => {
        try {
          const obj = JSON.parse(line);
          return '- ' + [obj.type, obj.summary || obj.user_request || obj.prompt, obj.correct_rule || obj.expected_behavior].filter(Boolean).join(': ');
        } catch (e) {
          return '- ' + line.slice(0, 220);
        }
      }).join('\n');
    };
    this.projectMemory = {
      rules: rules.slice(0, 6000),
      lessons: lessons.slice(0, 5000),
      log: jsonlToBullets(logRaw, 12),
      evals: jsonlToBullets(evalsRaw, 8),
      importedAt: new Date().toISOString(),
    };
    this._saveProjectMemory();
    return [rules, lessons, logRaw, evalsRaw].filter(Boolean).length;
  }

  _historyPrompt() {
    const recent = this.commandHistory.slice(-20);
    if (!recent.length) return 'Historico recente do usuario: (vazio)';
    const lines = recent.map((h, i) => {
      const text = String(h.text || '').replace(/\s+/g, ' ').slice(0, 180);
      const source = h.source ? ' {' + h.source + '}' : '';
      const status = h.status ? ' [' + h.status + ']' : '';
      return (i + 1) + '. ' + text + source + status;
    });
    return 'Historico recente de comandos do usuario (use para manter continuidade):\n' + lines.join('\n');
  }

  _projectMemoryPrompt() {
    const m = this.projectMemory || {};
    if (!m.rules && !m.lessons && !m.log && !m.evals) return 'Memoria do projeto: (nao carregada)';
    return [
      'Memoria prioritaria do projeto (siga antes de sugerir qualquer alteracao):',
      m.rules ? 'REGRAS:\n' + m.rules : '',
      m.lessons ? 'LICOES APRENDIDAS:\n' + m.lessons : '',
      m.log ? 'EVENTOS RECENTES DE APRENDIZADO:\n' + m.log : '',
      m.evals ? 'CASOS DE VALIDACAO:\n' + m.evals : '',
    ].filter(Boolean).join('\n\n');
  }

  _feedbackPrompt() {
    const recent = this.feedback.slice(-12);
    if (!recent.length) return 'Feedback recente do usuario: (vazio)';
    return 'Feedback recente do usuario (use para reforcar acertos e evitar erros):\n' + recent.map((f, i) => {
      const ctx = f.lastInteraction && f.lastInteraction.userText ? ' pedido="' + String(f.lastInteraction.userText).slice(0, 120) + '"' : '';
      const note = f.note ? ' nota="' + f.note + '"' : '';
      return (i + 1) + '. ' + f.value + ctx + note;
    }).join('\n');
  }

  resolveTarget(name) {
    const n = this.foldName(name);
    if (!n) return null;
    if (n === 'cama' || n === 'a cama') {
      return this.editableMeshes.find((m) => this.foldName(m.userData.name) === 'cama casal')
        || this.editableMeshes.find((m) => this.foldName(m.userData.name) === 'banco + mesa')
        || this.editableMeshes.find((m) => this.foldName(m.userData.name) === 'cama filha');
    }
    const aliases = {
      'cama filha': ['cama da filha', 'cama solteiro', 'cama menina', 'berco'],
      'banco + mesa': ['dinette', 'dinete', 'banco', 'poltrona + mesa', 'mesa que vira cama', 'cama filha', 'cama solteiro'],
      'cama casal': ['cama do casal', 'cama mezanino', 'cama de casal', 'cama grande'],
      'geladeira 12v': ['geladeira', 'freezer', 'geladeira 37l'],
      'porta potti 365': ['potti', 'vaso', 'sanitario', 'banheiro vaso'],
      'pia': ['cuba', 'pia inox'],
      'bateria': ['baterias', 'battery', 'acumulador', 'banco de bateria', 'bateria 12v', 'bateria12v'],
    };
    const exact = this.editableMeshes.find((m) => this.foldName(m.userData.name) === n);
    if (exact) return exact;
    for (const m of this.editableMeshes) {
      const fn = this.foldName(m.userData.name);
      if (fn.includes(n) || n.includes(fn)) return m;
      const al = aliases[fn] || [];
      if (al.some((a) => n.includes(a) || a.includes(n))) return m;
    }
    if (n === 'bateria' || n.includes('bateria')) {
      const byEditable = this.editableMeshes.find((m) => /bateria|battery|acumulador/.test(this.foldName(m.userData.name)));
      if (byEditable) return byEditable;
      let found = null;
      if (this.trailer && this.trailer.traverse) {
        this.trailer.traverse((obj) => {
          if (found || !obj) return;
          const name = this.foldName((obj.userData && obj.userData.name) || obj.name || '');
          if (/bateria|battery|acumulador/.test(name)) found = obj;
        });
      }
      return found;
    }
    return null;
  }

  normalizeAICommand(cmd) {
    if (!cmd || typeof cmd !== 'object') return cmd;
    const c = Object.assign({}, cmd);
    if (!c.target && c.object) c.target = c.object;
    if (c.action === 'rotate' && c.y == null && c.angle != null) c.y = c.angle;
    if (c.action === 'size' && c.length == null && (c.value != null || c.property === 'length')) c.length = Number(c.value);
    if (['stretch', 'fit', 'expand', 'encaixar', 'preencher'].indexOf(c.action) >= 0) c.action = 'fill';
    if (c.action === 'mat') c.action = 'material';
    if (c.action === 'material' && c.mat && !c.material) c.material = c.mat;
    if (c.action === 'nudge' && c.dx == null && c.direction && c.distance != null) {
      const d = Number(c.distance) || 0;
      const dir = String(c.direction).toLowerCase();
      c.dx = (dir === 'x' || dir === 'esquerda') ? (dir === 'x' ? d : -Math.abs(d)) : 0;
      if (dir === 'esquerda') c.dx = -Math.abs(d);
      if (dir === 'direita') c.dx = Math.abs(d);
      if (dir === 'z' || dir === 'frente') c.dz = (dir === 'frente' ? -Math.abs(d) : (dir === 'z' ? d : 0));
      if (dir === 'tras' || dir === 'atras') c.dz = Math.abs(d);
      if (c.dy == null) c.dy = 0;
      if (c.dz == null) c.dz = 0;
    }
    return c;
  }

  tryLocalCommand(text) {
    const t = this.foldName(text);
    if (/\b(exclua|exclui|excluir|apagar|remover|remove|retirar|delete|deletar)\b/.test(t) && /\bbateria(s)?\b/.test(t)) {
      return { action: 'delete', target: 'Bateria 12V' };
    }
    if (/\b(preench|encaix|fill|ocupar o espaco|ate a parede|ate as paredes)\b/.test(t)) {
      const names = [];
      if (/\bcamas\b/.test(t) || /\bas cama\b/.test(t)) {
        names.push('Cama casal', 'Banco + mesa');
      } else if (/cama\s+(filha|solteiro|menina)|dinete|dinette|poltrona|banco/.test(t)) {
        names.push('Banco + mesa');
      } else if (/armario/.test(t)) {
        names.push('Armários-escada');
      } else if (/cama/.test(t)) {
        names.push('Cama casal');
      } else if (/geladeira/.test(t)) {
        names.push('Geladeira 12V');
      } else if (/\bpia\b/.test(t)) {
        names.push('Pia');
      } else if (/potti|vaso|sanitario/.test(t)) {
        names.push('Porta Potti 365');
      } else {
        names.push('Cama casal');
      }
      return { commands: names.map((n) => ({ action: 'fill', target: n })) };
    }
    const m = t.match(/^(mover|move|desloca|anda)\s+(.+?)\s+(\d+(?:[.,]\d+)?)\s*(mm|cm|m)?\s*(?:para\s+(?:o|a)\s+|para\s+)?(esquerda|direita|frente|tras|atras|cima|baixo)\b/);
    if (!m) return null;
    let dist = parseFloat(m[3].replace(',', '.'));
    const unit = m[4] || 'cm';
    if (unit === 'cm') dist /= 100;
    if (unit === 'mm') dist /= 1000;
    const dir = m[5];
    const dx = dir === 'esquerda' ? -dist : dir === 'direita' ? dist : 0;
    const dy = dir === 'cima' ? dist : dir === 'baixo' ? -dist : 0;
    const dz = (dir === 'frente') ? -dist : (dir === 'tras' || dir === 'atras') ? dist : 0;
    return { action: 'nudge', target: m[2], dx, dy, dz };
  }

  buildSystemPrompt() {
    const objs = this.editableMeshes.map(m => {
      const wp = new THREE.Vector3();
      m.getWorldPosition(wp);
      return '- ' + (m.userData.name || 'obj') +
        ' (world x:' + wp.x.toFixed(2) + ' y:' + wp.y.toFixed(2) + ' z:' + wp.z.toFixed(2) + ')';
    }).join('\n');

    return [
      'Voce edita o trailer 3D. Responda SOMENTE JSON (um objeto ou {"commands":[...]}).',
      '{"action":"nudge","target":"NOME","dx":m,"dy":m,"dz":m}',
      '{"action":"move","target":"NOME","x":wx,"y":wy,"z":wz}',
      '{"action":"rotate","target":"NOME","x":graus,"y":graus,"z":graus}',
      '{"action":"fill","target":"NOME"}',
      '{"action":"delete","target":"NOME"}',
      '{"action":"material","target":"NOME","material":"madeira"}',
      'Nunca contradiga o historico de comandos do usuario sem explicar usando {"action":"noop","reason":"..."}.',
      this._projectMemoryPrompt(),
      this._feedbackPrompt(),
      'Objetos agora:',
      objs,
      this._historyPrompt(),
    ].join('\n');
  }

  async sendToAI(userText) {
    this.lastInteraction = { userText, startedAt: new Date().toISOString(), mode: 'pending' };
    this._appendHistory({ text: userText, source: 'trailer-ui', status: 'requested' });
    this.aiLog('> ' + userText, 'user');
    const local = this.tryLocalCommand(userText);
    if (local) {
      const batch = Array.isArray(local.commands) ? local.commands : [local];
      batch.forEach((c) => this.applyAICommand(c));
      this.lastInteraction = { userText, mode: 'local-command', commands: batch, finishedAt: new Date().toISOString() };
      this._appendHistory({ text: userText, source: 'trailer-ui', status: 'applied-local' });
      return;
    }
    this.aiBusy(true);
    try {
      const sysPrompt = this.buildSystemPrompt();
      const resp = await fetch(this.ollamaUrl + '/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.ollamaModel,
          system: sysPrompt,
          prompt: 'Comando: ' + userText + '\nJSON:',
          stream: false,
          format: 'json',
          options: { temperature: 0.0, num_predict: 280 },
        }),
      });
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const data = await resp.json();
      const raw = data.response || '';
      this.lastInteraction = { userText, mode: 'llm', response: raw.slice(0, 2000), finishedAt: new Date().toISOString() };
      this.aiLog('< ' + raw.trim(), 'ai');
      let parsed;
      try {
        const jsonStr = raw.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonStr ? jsonStr[0] : raw);
      } catch (e) {
        this.aiLog('Erro ao interpretar JSON do LLM: ' + e.message, 'err');
        return;
      }
      const batch = Array.isArray(parsed.commands) ? parsed.commands : [parsed];
      batch.forEach((c) => this.applyAICommand(c));
      this._appendHistory({ text: userText, source: 'trailer-ui', status: 'applied-llm' });
    } catch (err) {
      const fallback = this.tryLocalCommand(userText);
      if (fallback) {
        const batch = Array.isArray(fallback.commands) ? fallback.commands : [fallback];
        batch.forEach((c) => this.applyAICommand(c));
        this.lastInteraction = { userText, mode: 'local-fallback', commands: batch, error: err.message, finishedAt: new Date().toISOString() };
        this._appendHistory({ text: userText, source: 'trailer-ui', status: 'applied-local-fallback:' + err.message });
        this.aiLog('LLM indisponivel, comando aplicado localmente.', 'sys');
      } else {
        this.aiLog('Erro de conexão: ' + err.message, 'err');
        this._appendHistory({ text: userText, source: 'trailer-ui', status: 'failed:' + err.message });
      }
    } finally {
      this.aiBusy(false);
    }
  }

  applyAICommand(cmd) {
    cmd = this.normalizeAICommand(cmd);
    if (!cmd || !cmd.action) { this.aiLog('Comando sem action.', 'err'); return; }
    if (cmd.action === 'noop') { this.aiLog('IA: ' + (cmd.reason || 'Sem ação'), 'sys'); return; }
    if (!cmd.target && cmd.action !== 'add') { this.aiLog('Comando sem target.', 'err'); return; }
    const mesh = cmd.action === 'add' ? null : this.resolveTarget(cmd.target);
    if (cmd.action !== 'add' && !mesh) {
      this.aiLog('Objeto "' + cmd.target + '" não encontrado.', 'err');
      return;
    }
    this.pushUndo();
    switch (cmd.action) {
      case 'nudge': {
        const dx = Number(cmd.dx) || 0, dy = Number(cmd.dy) || 0, dz = Number(cmd.dz) || 0;
        mesh.position.x += dx; mesh.position.y += dy; mesh.position.z += dz;
        if (this.resolvePlacement) this.resolvePlacement(mesh);
        this.aiLog('✓ ' + mesh.userData.name + ' deslocado', 'sys');
        if (this.updateEditorPanel) this.updateEditorPanel();
        break;
      }
      case 'move': {
        const wp = new THREE.Vector3();
        mesh.getWorldPosition(wp);
        const nx = typeof cmd.x === 'number' ? cmd.x : wp.x;
        const ny = typeof cmd.y === 'number' ? cmd.y : wp.y;
        const nz = typeof cmd.z === 'number' ? cmd.z : wp.z;
        if (this.setWorldPos) this.setWorldPos(mesh, nx, ny, nz);
        if (this.resolvePlacement) this.resolvePlacement(mesh);
        this.aiLog('✓ ' + mesh.userData.name + ' movido', 'sys');
        if (this.updateEditorPanel) this.updateEditorPanel();
        break;
      }
      case 'fill': {
        if (typeof this.fillObject === 'function') this.fillObject(mesh);
        this.aiLog('✓ ' + mesh.userData.name + ' preenchido', 'sys');
        if (this.updateEditorPanel) this.updateEditorPanel();
        break;
      }
      case 'rotate': {
        if (typeof cmd.x === 'number') mesh.rotation.x = cmd.x * Math.PI / 180;
        if (typeof cmd.y === 'number') mesh.rotation.y = cmd.y * Math.PI / 180;
        if (typeof cmd.z === 'number') mesh.rotation.z = cmd.z * Math.PI / 180;
        this.aiLog('✓ ' + cmd.target + ' rotacionado', 'sys');
        if (this.updateEditorPanel) this.updateEditorPanel();
        break;
      }
      case 'delete':
        if (mesh.parent) mesh.parent.remove(mesh);
        const idx = this.editableMeshes.indexOf(mesh);
        if (idx >= 0) this.editableMeshes.splice(idx, 1);
        if (this.deselectObject) this.deselectObject();
        this.aiLog('✓ ' + cmd.target + ' excluído', 'sys');
        break;
      case 'material': {
        const matDefs = this._getMatDefs();
        const matName = String(cmd.material || '').toLowerCase().trim();
        const def = matDefs[matName];
        if (!def) {
          this.aiLog('Material "' + matName + '" não encontrado.', 'err');
          break;
        }
        const makeMat = (baseMat) => {
          const isWall = baseMat && baseMat.side === THREE.DoubleSide;
          const opts = Object.assign({}, def);
          if (isWall) opts.side = THREE.DoubleSide;
          if (def.transparent) { opts.transparent = true; opts.opacity = def.opacity; }
          return new THREE.MeshStandardMaterial(Object.assign({ flatShading: true }, opts));
        };
        const applyMat = (obj) => {
          if (obj.isMesh) obj.material = makeMat(obj.material);
          else if (obj.isGroup) obj.traverse((c) => { if (c.isMesh) c.material = makeMat(c.material); });
        };
        applyMat(mesh);
        this.aiLog('✓ ' + cmd.target + ' → ' + matName, 'sys');
        break;
      }
      default:
        this.aiLog('Ação desconhecida: ' + cmd.action, 'err');
    }
  }

  _getMatDefs() {
    return {
      'madeira': { color: 0xd4b483, roughness: 0.70, metalness: 0.10 },
      'aluminio': { color: 0xc8c8c8, roughness: 0.40, metalness: 0.70 },
      'aco': { color: 0x2a2e36, roughness: 0.50, metalness: 0.60 },
      'inox': { color: 0xd0d0d0, roughness: 0.30, metalness: 0.80 },
      'preto': { color: 0x1a1a1a, roughness: 0.60, metalness: 0.30 },
      'branco': { color: 0xf0f0f0, roughness: 0.50, metalness: 0.05 },
      'vidro': { color: 0xb8d4e8, roughness: 0.10, metalness: 0.40, transparent: true, opacity: 0.45 },
    };
  }
}
