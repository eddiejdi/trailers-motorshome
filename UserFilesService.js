/**
 * UserFilesService — gerenciamento de projetos do usuário.
 *
 * Cada usuário autenticado pode ter N projetos salvos em localStorage.
 * Chave: trailer3d-files:<userId>
 *
 * Cada projeto contém:
 *   { id, name, createdAt, updatedAt, project: {...}, layout: {...} }
 *
 * O project é o definition do projeto (dimensions, weights, specs, meta).
 * O layout é a posição dos objetos na cena 3D (SaveService.serializeLayout()).
 */

const STORAGE_PREFIX = 'trailer3d-files:';

export default class UserFilesService {
  constructor({ auth, saveService, projectService, loadDeps = {} }) {
    this.auth = auth;
    this.saveService = saveService;
    this.projectService = projectService;
    this.loadDeps = loadDeps;
    this._listeners = { change: [] };
    this._currentFileId = null;   // ID do arquivo aberto
    this._currentProjectName = null;
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

  _key() {
    const user = this.auth.getUser();
    if (!user) return null;
    return STORAGE_PREFIX + user.id;
  }

  _readAll() {
    const key = this._key();
    if (!key) return [];
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  _writeAll(files) {
    const key = this._key();
    if (!key) throw new Error('Não autenticado');
    localStorage.setItem(key, JSON.stringify(files));
  }

  /** Lista de projetos do usuário (ordenados por updatedAt desc). */
  list() {
    return this._readAll().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  /** Retorna um projeto pelo ID. */
  get(id) {
    return this._readAll().find((f) => f.id === id) || null;
  }

  /** ID do arquivo atualmente aberto. */
  getCurrentFileId() { return this._currentFileId; }
  getCurrentProjectName() { return this._currentProjectName; }

  /**
   * Salva o estado atual (projeto + layout) como arquivo do usuário.
   * Se já existir um arquivo aberto, sobrescreve. Senão cria novo.
   * @param {string} name - nome do projeto
   * @returns {Object} arquivo salvo
   */
  saveCurrent(name) {
    if (!this.auth.isAuthenticated()) throw new Error('Faça login para salvar projetos');

    const project = this.projectService.getProject();
    const layout = this.saveService.serializeLayout();
    const files = this._readAll();
    const now = new Date().toISOString();

    let saved = null;

    // Tenta reutilizar o arquivo aberto
    if (this._currentFileId) {
      saved = files.find((f) => f.id === this._currentFileId);
    }

    // Se não encontrou, procura por nome
    if (!saved) {
      saved = files.find((f) => f.name === name);
    }

    if (saved) {
      saved.project = project;
      saved.layout = layout;
      saved.name = name;
      saved.updatedAt = now;
    } else {
      saved = {
        id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name,
        createdAt: now,
        updatedAt: now,
        project,
        layout,
      };
      files.push(saved);
    }

    this._currentFileId = saved.id;
    this._currentProjectName = name;
    this._writeAll(files);
    this._emit('change', { file: saved, action: 'save' });
    return saved;
  }

  /**
   * Abre um projeto pelo ID: carrega project + layout.
   */
  load(id) {
    const file = this.get(id);
    if (!file) throw new Error('Projeto não encontrado');

    // Carrega o projeto (dimensions, weights, specs, meta)
    if (file.project) {
      this.projectService.loadProject(file.project);
    }

    // Aplica o layout na cena 3D
    this.saveService.applyCapturedFromLayout(file.layout, this.loadDeps);

    this._currentFileId = id;
    this._currentProjectName = file.name;
    this._emit('change', { file, action: 'load' });
    return file;
  }

  /**
   * Remove um projeto pelo ID.
   */
  remove(id) {
    const files = this._readAll().filter((f) => f.id !== id);
    this._writeAll(files);
    if (this._currentFileId === id) {
      this._currentFileId = null;
      this._currentProjectName = null;
    }
    this._emit('change', { file: null, action: 'remove' });
  }

  /**
   * Renomeia um projeto.
   */
  rename(id, newName) {
    const files = this._readAll();
    const file = files.find((f) => f.id === id);
    if (!file) throw new Error('Projeto não encontrado');
    file.name = newName;
    file.updatedAt = new Date().toISOString();
    this._writeAll(files);
    if (this._currentFileId === id) this._currentProjectName = newName;
    this._emit('change', { file, action: 'rename' });
  }

  /**
   * Cria um novo projeto em branco (reseta projeto + layout).
   * Não salva automaticamente — o usuário deve dar "Salvar".
   */
  newProject() {
    this.projectService.resetToDefault();
    this._currentFileId = null;
    this._currentProjectName = null;
    this._emit('change', { file: null, action: 'new' });
  }

  /**
   * Abre um projeto a partir de um arquivo .json importado.
   */
  importProject(data) {
    if (!data || !data.dimensions) throw new Error('Projeto inválido');
    this.projectService.loadProject(data);
    this._currentFileId = null;
    this._currentProjectName = data.meta?.name || 'Importado';
    this._emit('change', { file: null, action: 'import' });
    return data;
  }
}
