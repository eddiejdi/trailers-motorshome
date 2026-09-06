/**
 * ProjectService — carrega e gerencia o arquivo de projeto.
 *
 * O projeto (.json) contém:
 *   - meta: nome, versão, descrição
 *   - dimensions: medidas de todos os componentes
 *   - weights_kg: estimativa de peso de cada componente
 *   - specs: lista de linhas para o painel "Dimensões"
 *
 * O frontend (ferramenta) lê o projeto; o projeto descreve o desenho.
 * O usuário pode salvar/carregar projetos diferentes.
 */

import defaultProject from './project.json';

export default class ProjectService {
  constructor() {
    this.project = structuredClone(defaultProject);
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

  getProject() {
    return this.project;
  }

  getMeta()         { return this.project.meta; }
  getDimensions()   { return this.project.dimensions; }
  getWeights()      { return this.project.weights_kg; }
  getSpecs()        { return this.project.specs; }

  /**
   * Carrega um projeto a partir de um objeto JSON.
   * @param {Object} data - projeto serializado
   */
  loadProject(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Projeto inválido');
    }
    if (!data.dimensions || !data.weights_kg) {
      throw new Error('Projeto faltando dimensions ou weights_kg');
    }
    this.project = data;
    this._emit('change', this.project);
    return this.project;
  }

  /**
   * Restaura o projeto padrão (embutido).
   */
  resetToDefault() {
    this.project = structuredClone(defaultProject);
    this._emit('change', this.project);
    return this.project;
  }

  /**
   * Faz download do projeto atual como arquivo .json.
   */
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

  /**
   * Abre um seletor de arquivo e carrega o projeto escolhido.
   * @returns {Promise<Object|null>} projeto carregado ou null se cancelado
   */
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
        } catch (err) {
          reject(err);
        }
      };
      input.click();
    });
  }

  /**
   * Renderiza uma spec usando o formato e os dados do projeto.
   * Substitui {path} por valores de project.dimensions / project.weights_kg.
   */
  formatSpec(spec) {
    const lookup = (path) => {
      const parts = path.split('.');
      let v = this.project;
      for (const p of parts) {
        if (v == null) return '';
        v = v[p];
      }
      if (typeof v === 'number') {
        return v.toFixed(2).replace('.', ',');
      }
      return v ?? '';
    };
    return spec.format.replace(/\{([^}]+)\}/g, (_, path) => lookup(path));
  }

  /**
   * Renderiza o painel de specs no DOM.
   */
  renderSpecPanel(rootEl) {
    if (!rootEl) return;
    const rows = this.project.specs.map((s) => {
      return '<div class="s"><span>' + s.label + '</span><strong>' + this.formatSpec(s) + '</strong></div>';
    }).join('');
    rootEl.innerHTML = rows;
  }
}
