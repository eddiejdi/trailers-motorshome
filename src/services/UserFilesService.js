/**
 * UserFilesService — gerenciamento de arquivos do projeto por usuário.
 *
 * Cada usuário autenticado tem seus próprios projetos salvos em localStorage.
 * Chave: trailer3d-files:<userId>
 *
 * Cada arquivo contém:
 *   { id, name, createdAt, updatedAt, layout: { ...serialized state... } }
 *
 * O layout é produzido por SaveService.serializeLayout().
 */

const STORAGE_PREFIX = 'trailer3d-files:';

export default class UserFilesService {
  constructor({ auth, saveService, loadDeps = {} }) {
    this.auth = auth;
    this.saveService = saveService;
    this.loadDeps = loadDeps;
    this._listeners = { change: [] };
  }

  on(event, cb) { if (this._listeners[event]) this._listeners[event].push(cb); }
  _emit(event) { (this._listeners[event] || []).forEach((cb) => { try { cb(); } catch (e) { /* ignore */ } }); }

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

  list() {
    return this._readAll().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  get(id) {
    return this._readAll().find((f) => f.id === id) || null;
  }

  saveCurrent(name) {
    if (!this.auth.isAuthenticated()) throw new Error('Faça login para salvar projetos');
    const layout = this.saveService.serializeLayout();
    const files = this._readAll();
    const now = new Date().toISOString();
    let saved = files.find((f) => f.name === name);
    if (saved) {
      saved.layout = layout;
      saved.updatedAt = now;
    } else {
      saved = {
        id: 'f_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name,
        createdAt: now,
        updatedAt: now,
        layout,
      };
      files.push(saved);
    }
    this._writeAll(files);
    this._emit('change');
    return saved;
  }

  load(id) {
    const file = this.get(id);
    if (!file) throw new Error('Arquivo não encontrado');
    this.saveService.applyCapturedFromLayout(file.layout, this.loadDeps);
    return file;
  }

  remove(id) {
    const files = this._readAll().filter((f) => f.id !== id);
    this._writeAll(files);
    this._emit('change');
  }

  rename(id, newName) {
    const files = this._readAll();
    const file = files.find((f) => f.id === id);
    if (!file) throw new Error('Arquivo não encontrado');
    file.name = newName;
    file.updatedAt = new Date().toISOString();
    this._writeAll(files);
    this._emit('change');
  }
}
