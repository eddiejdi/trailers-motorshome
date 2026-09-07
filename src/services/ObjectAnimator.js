const THREE = window.THREE;

// Easing de seleção (suave na entrada e na volta)
const E = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

function mapMeshes(obj, fn) {
  if (!obj) return;
  if (obj.isMesh) fn(obj);
  else obj.traverse((c) => { if (c.isMesh) fn(c); });
}

function meshOf(obj) {
  if (obj && obj.isMesh) return obj;
  let found = null;
  if (obj) obj.traverse((c) => { if (!found && c.isMesh) found = c; });
  return found;
}

function baseMatrix4(w, h, d) { return { w, h, d }; }

// ─────────────────────────────────────────────────────────────
// Animações — cada entry anima a FUNÇÃO real do objeto quando
// selecionado (funcTarget = 1) e retorna ao repouso ao desselecionar.
// Assinatura: fn(obj, e, p, dt, T)  — e=E(p) suavizado, p=0..1, dt em s.
// ─────────────────────────────────────────────────────────────
const ANIMS = {
  // Portas: giram na dobradiça até abrir
  porta(obj, e) {
    const hinge = obj.userData && obj.userData.hinge;
    if (hinge && hinge.userData) {
      const from = hinge.userData.restY != null ? hinge.userData.restY : 0;
      const to = hinge.userData.openY != null ? hinge.userData.openY : 1.2;
      hinge.rotation.y = from + (to - from) * e;
    } else {
      obj.rotation.y = (obj.userData._ry0 != null ? obj.userData._ry0 : 0) + 1.2 * e;
    }
  },

  // Janelas: a folha (sash) desliza para fora
  janela(obj, e) {
    obj.traverse((c) => {
      if (c.userData && c.userData.role === 'sash') {
        const w = (obj.userData && obj.userData.glassW) || 0.5;
        c.position.x = -w / 2 + w * 0.55 * e;
      }
    });
  },

  // Mesa Lagun simples: desce até a altura de cama (monta cama)
  mesa(obj, e, p, dt, T) {
    if (obj.userData && obj.userData.role === 'table') {
      if (obj.userData._y0 == null) obj.userData._y0 = obj.position.y;
      const drop = (obj.userData.restY != null && obj.userData.bedY != null)
        ? (obj.userData.restY - obj.userData.bedY) : 0.25;
      obj.position.y = obj.userData._y0 - drop * e;
    } else {
      obj.rotation.z = (obj.userData._rz0 != null ? obj.userData._rz0 : 0) + 0.05 * Math.sin(T * 6) * e;
    }
  },

  // Dinette / banco+mesa que vira cama: tampo desce, pé recolhe,
  // espuma de preenchimento aparece e os encostos reclinam.
  dinette(obj, e) {
    obj.traverse((c) => {
      const u = c.userData || {};
      if (u.role === 'table' && u.restY != null && u.bedY != null) {
        c.position.y = u.restY + (u.bedY - u.restY) * e;
      } else if (u.role === 'ped') {
        const h0 = u.restH != null ? u.restH : 0.4;
        c.scale.set(1, Math.max(0.01, 1 - e), 1);
        c.position.y = (h0 / 2) * (1 - e);
      } else if (u.role === 'fill' && c.material) {
        c.visible = e > 0.02;
        if (!c.material.transparent) c.material = c.material.clone();
        c.material.transparent = true;
        c.material.opacity = e;
      } else if (u.role === 'back') {
        c.rotation.z = -(u.foldSign || 1) * 0.55 * e;
      }
    });
  },

  // Encosto de banco único (recpro/camper): reclina formando cama
  bedflip(obj, e) {
    if (obj.userData._rx0 == null) obj.userData._rx0 = obj.rotation.x;
    if (obj.userData._y0 == null) obj.userData._y0 = obj.position.y;
    obj.rotation.x = obj.userData._rx0 - 0.6 * e;
    obj.position.y = obj.userData._y0 - 0.12 * e;
  },

  // Exaustores / ventiladores / claraboias: giro contínuo
  fan(obj, e, p, dt) {
    if (p <= 0) { obj.rotation.y = 0; return; }
    obj.rotation.y = (obj.rotation.y || 0) + p * 9 * dt;
  },

  // Iluminação (plafon, led-strip, spot, boiler, climatizador): acende
  light(obj, e, p, dt, T) {
    const flick = p >= 1 ? Math.max(0, 0.14 * Math.sin(T * 9)) : 0;
    mapMeshes(obj, (m) => {
      if (!m.material || !m.material.emissive) return;
      const u = m.userData;
      if (u._em0 == null) u._em0 = m.material.emissiveIntensity != null ? m.material.emissiveIntensity : 0;
      m.material.emissiveIntensity = u._em0 + (1.1 - u._em0) * e + flick;
    });
  },

  // Tanques de água: enchem (mais opaco + brilho azulado)
  tank(obj, e, p, dt, T) {
    const m = meshOf(obj);
    if (!m || !m.material) return;
    const u = m.userData;
    if (u._op0 == null) u._op0 = m.material.opacity != null ? m.material.opacity : 0.7;
    m.material.transparent = true;
    m.material.opacity = Math.max(0.15, u._op0 - 0.45 * e);
    if (!m.material.emissive) m.material.emissive = new THREE.Color(0x4ad0ff);
    if (u._em0 == null) u._em0 = m.material.emissiveIntensity || 0;
    const wave = 0.15 * Math.sin(T * 5) * (p >= 1 ? 1 : e);
    m.material.emissiveIntensity = u._em0 + (0.35 + wave) * e;
  },

  // Quadro / painel de disjuntores: leds piscam
  electrical(obj, e, p, dt, T) {
    mapMeshes(obj, (m) => {
      if (!m.material) return;
      const u = m.userData;
      if (u._blink0 == null) {
        u._blink0 = m.material.emissiveIntensity || 0;
        m.material.emissive = new THREE.Color(0x2fdf6f);
      }
      const blink = 0.5 + 0.5 * Math.sin(T * 12);
      m.material.emissiveIntensity = (u._blink0 || 0) + (0.35 + 0.55 * blink) * (p >= 1 ? 1 : e);
    });
  },

  // Cômoda: gaveta desliza para fora
  comoda(obj, e) {
    if (obj.userData._z0 == null) obj.userData._z0 = obj.position.z;
    if (obj.userData._y0 == null) obj.userData._y0 = obj.position.y;
    obj.position.z = obj.userData._z0 + 0.05 * e;
    obj.position.y = obj.userData._y0 - 0.02 * e;
  },

  // Armário / geladeira: porta abre (rotação no Y)
  tiltY(obj, e) {
    if (obj.userData._ry0 == null) obj.userData._ry0 = obj.rotation.y;
    obj.rotation.y = obj.userData._ry0 + 1.15 * e;
  },

  // Banco-baú / Potti / caixa de gás: tampa abre (rotação no X)
  tiltX(obj, e) {
    if (obj.userData._rx0 == null) obj.userData._rx0 = obj.rotation.x;
    obj.rotation.x = obj.userData._rx0 + 0.85 * e;
  },

  // Box de banheiro: painel desliza lateralmente
  slideX(obj, e) {
    if (obj.userData._x0 == null) obj.userData._x0 = obj.position.x;
    obj.position.x = obj.userData._x0 - 0.12 * e;
  },

  // Pé de dinete 12V / base SNAP: coluna telescópica sobe
  extend(obj, e) {
    if (obj.userData._sy0 == null) obj.userData._sy0 = obj.scale.y;
    obj.scale.y = obj.userData._sy0 * (1 + 0.55 * e);
  },

  // Mesa dobrável: dobra
  fold(obj, e) {
    if (obj.userData._rz0 == null) obj.userData._rz0 = obj.rotation.z;
    if (obj.userData._sy0 == null) obj.userData._sy0 = obj.scale.y;
    obj.rotation.z = obj.userData._rz0 - 0.65 * e;
    obj.scale.y = obj.userData._sy0 * (1 - 0.15 * e);
  },

  // Escada retrátil: desliza para fora
  deploy(obj, e) {
    if (obj.userData._z0 == null) obj.userData._z0 = obj.position.z;
    obj.position.z = obj.userData._z0 - 0.30 * e;
  },

  // Claraboia: abre para cima (ventilação)
  lift(obj, e) {
    if (obj.userData._y0 == null) obj.userData._y0 = obj.position.y;
    obj.position.y = obj.userData._y0 + 0.08 * e;
  },

  // Ar-condicionado / grade de ventilação: venta (balança suave)
  air(obj, e, p, dt, T) {
    if (obj.userData._rz0 == null) obj.userData._rz0 = obj.rotation.z;
    obj.rotation.z = obj.userData._rz0 + 0.07 * Math.sin(T * 5) * e;
  },

  // Banho/pia: água sai (spray aparece) ou pulsa vagarosamente
  water(obj, e, p, dt, T) {
    let sprayed = false;
    obj.traverse((c) => {
      if (c.userData && c.userData.role === 'spray' && c.material) {
        c.material.transparent = true;
        c.material.opacity = 0.9 * e;
        c.scale.setScalar(0.4 + 0.6 * e);
        sprayed = true;
      }
    });
    if (!sprayed) {
      if (obj.userData._s0 == null) obj.userData._s0 = obj.scale.x;
      const b = obj.userData._s0;
      obj.scale.set(b * (1 + 0.05 * e * Math.sin(T * 6)),
                    b * (1 + 0.05 * e * Math.sin(T * 6)),
                    b * (1 + 0.05 * e * Math.sin(T * 6)));
    }
  },

  // Acessórios simples: pulsação sutil indicando uso
  pulse(obj, e, p, dt, T) {
    if (obj.userData._s0 == null) obj.userData._s0 = obj.scale.x;
    const b = obj.userData._s0 || 1;
    const s = b * (1 + 0.04 * e * Math.sin(T * 6));
    obj.scale.set(s, s, s);
  },
};

export default class ObjectAnimator {
  constructor({ editableMeshes }) {
    this.editableMeshes = editableMeshes || [];
    this.prog = new Map();
    this.T = 0;
  }

  update(dt) {
    this.T += dt;
    for (let i = 0; i < this.editableMeshes.length; i++) {
      const obj = this.editableMeshes[i];
      if (!obj || !obj.userData) continue;
      const active = obj.userData.funcTarget === 1 && !obj.userData.skipFunc;
      const st = this._state(obj);
      const target = active ? 1 : 0;
      if (st.p === target) {
        if (active) this._apply(obj, 1, dt);
        continue;
      }
      st.p += (target - st.p) * Math.min(1, dt * (target ? 6 : 3.5));
      if (Math.abs(st.p - target) < 0.002) st.p = target;
      this._apply(obj, st.p, dt);
    }
  }

  _state(obj) {
    let s = this.prog.get(obj);
    if (!s) {
      s = { p: 0 };
      this.prog.set(obj, s);
    }
    return s;
  }

  // Objeto da paleta traz kind no próprio userData; itens estruturais
  // (ex.: "Dinete" do interior) têm kind no grupo ancestral → anima o host.
  _resolveHost(obj) {
    let host = obj;
    while (host) {
      if (host.userData && (host.userData.kind || host.userData.funcKind)) return host;
      host = host.parent;
    }
    return null;
  }

  _apply(obj, p, dt) {
    const host = this._resolveHost(obj);
    if (!host) return;
    const fn = this._animationFor(host);
    if (!fn) return;
    const e = E(Math.max(0, Math.min(1, p)));
    fn(host, e, p, dt, this.T);
  }

  _animationFor(obj) {
    const u = obj.userData || {};
    const kind = u.kind || u.funcKind;
    if (!kind) return null;
    if (kind === 'porta' || kind === 'porta-int') return ANIMS.porta;
    if (kind === 'janela' || kind.indexOf('janela-') === 0) return ANIMS.janela;
    if (kind === 'mesa') return ANIMS.mesa;
    if (kind === 'dinette') return ANIMS.dinette;
    if (kind === 'recpro-38' || kind === 'recpro-44' || kind === 'camper-40') return ANIMS.bedflip;
    if (kind === 'exaustor' || kind.indexOf('exaustor') === 0 || kind === 'vent-exaust') return ANIMS.fan;
    if (kind === 'claraboia-280' || kind === 'claraboia-400') return ANIMS.lift;
    if (kind === 'plafon' || kind === 'led-strip' || kind === 'spot-led' ||
        kind === 'boiler' || kind === 'clima-evap') return ANIMS.light;
    if (kind === 'tanque' || kind === 'tanque-40' || kind === 'caixa-agua-80' || kind === 'caixa-agua-100' || kind === 'caixa-agua-130' || kind === 'caixa-agua-152' || kind === 'tanque-agua-30' || kind === 'reservatorio-40') return ANIMS.tank;
    if (kind === 'quadro' || kind === 'painel-dj') return ANIMS.electrical;
    if (kind === 'comoda') return ANIMS.comoda;
    if (kind === 'armario' || kind === 'geladeira') return ANIMS.tiltY;
    if (kind === 'banco' || kind === 'potti' || kind === 'caixa-gas') return ANIMS.tiltX;
    if (kind === 'box-banheiro') return ANIMS.slideX;
    if (kind === 'pe-dinete-12v' || kind === 'snap-base') return ANIMS.extend;
    if (kind === 'mesa-dob') return ANIMS.fold;
    if (kind === 'escada-ret') return ANIMS.deploy;
    if (kind === 'ac-portatil' || kind === 'ac-teto' || kind === 'grade-vent') return ANIMS.air;
    if (kind === 'ducha' || kind === 'ducha-ext' || kind === 'pia') return ANIMS.water;
    return ANIMS.pulse;
  }
}