/**
 * AuthService — autenticação de usuário
 *
 * Suporta:
 * - Login local (email + nome, sem senha, armazenado em localStorage)
 * - Google OAuth via Google Identity Services (GIS)
 *
 * Para Google OAuth, é necessário um Client ID válido.
 * Configure via window.GOOGLE_CLIENT_ID antes de carregar este módulo.
 *
 * O usuário é persistido em localStorage. O estado atual fica em this.user.
 *
 * Eventos:
 *   auth:login  — emitido quando user faz login
 *   auth:logout — emitido quando user faz logout
 */

const STORAGE_KEY = 'trailer3d-user-v1';
const GOOGLE_CLIENT_ID = window.GOOGLE_CLIENT_ID || '';

export default class AuthService {
  constructor() {
    this.user = null;
    this._listeners = { login: [], logout: [] };
    this._googleReady = false;
    this._loadFromStorage();
    if (GOOGLE_CLIENT_ID) this._initGoogle();
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.user = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  }

  _save() {
    try {
      if (this.user) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  _emit(event) {
    (this._listeners[event] || []).forEach((cb) => { try { cb(this.user); } catch (e) { /* ignore */ } });
  }

  on(event, cb) {
    if (this._listeners[event]) this._listeners[event].push(cb);
  }

  isAuthenticated() {
    return !!this.user;
  }

  getUser() {
    return this.user;
  }

  /**
   * Login local — sem senha, apenas email + nome.
   * Em produção, isso seria substituído por auth real.
   */
  loginLocal({ email, name }) {
    if (!email) throw new Error('Email required');
    this.user = {
      id: 'local:' + email,
      email,
      name: name || email.split('@')[0],
      provider: 'local',
      avatar: null,
      loggedAt: new Date().toISOString(),
    };
    this._save();
    this._emit('login');
    return this.user;
  }

  /**
   * Login com Google via GIS.
   * Requer window.GOOGLE_CLIENT_ID configurado.
   */
  loginWithGoogle() {
    if (!this._googleReady) {
      return Promise.reject(new Error('Google Identity Services não inicializado. Configure GOOGLE_CLIENT_ID.'));
    }
    return new Promise((resolve, reject) => {
      try {
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            reject(new Error('Popup do Google bloqueado. Use o botão de login.'));
          }
        });
        // O callback real vem via _handleGoogleCredential
        this._googleResolve = resolve;
        this._googleReject = reject;
      } catch (e) { reject(e); }
    });
  }

  _initGoogle() {
    if (window.google && window.google.accounts) {
      this._setupGoogle();
      return;
    }
    // Carrega GIS dinamicamente
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => this._setupGoogle();
    document.head.appendChild(s);
  }

  _setupGoogle() {
    if (!window.google || !window.google.accounts) return;
    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (resp) => this._handleGoogleCredential(resp),
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      this._googleReady = true;
    } catch (e) {
      console.warn('Google init falhou:', e);
    }
  }

  _handleGoogleCredential(response) {
    try {
      // Decodifica JWT (sem verificar assinatura — para client-side)
      const payload = JSON.parse(atob(response.credential.split('.')[1]));
      this.user = {
        id: 'google:' + payload.sub,
        email: payload.email,
        name: payload.name || payload.email,
        provider: 'google',
        avatar: payload.picture || null,
        loggedAt: new Date().toISOString(),
      };
      this._save();
      this._emit('login');
      if (this._googleResolve) { this._googleResolve(this.user); this._googleResolve = null; }
    } catch (e) {
      console.error('Google credential error:', e);
      if (this._googleReject) { this._googleReject(e); this._googleReject = null; }
    }
  }

  logout() {
    const wasAuthed = !!this.user;
    this.user = null;
    this._save();
    if (wasAuthed) this._emit('logout');
  }

  /**
   * Renderiza o botão oficial do Google num container.
   */
  renderGoogleButton(container) {
    if (!this._googleReady) {
      container.innerHTML = '<div style="font-size:11px;color:var(--ink-3)">Google OAuth não configurado</div>';
      return;
    }
    window.google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'medium',
      text: 'signin_with',
      locale: 'pt-BR',
    });
  }
}
