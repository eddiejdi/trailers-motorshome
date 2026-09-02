const THREE = window.THREE;

export default class WalkthroughService {
  constructor({ camera, renderer, controls, transformCtrl, FLOOR_Y, WALL_H, Li, Lt, BODY_W, mzIntH, stairTreads, HATCH_X, HATCH_Z, bathZ0, bathZ1, bathX0, bathX1, intDoorZ, INT_DOOR_W, doorZ0, doorZ1, mzFloorH, mzInnerZ }) {
    this.camera = camera;
    this.renderer = renderer;
    this.orbitControls = controls;
    this.transformCtrl = transformCtrl;
    this.FLOOR_Y = FLOOR_Y;
    this.WALL_H = WALL_H;
    this.Li = Li;
    this.Lt = Lt;
    this.BODY_W = BODY_W;
    this.mzIntH = mzIntH;
    this.stairTreads = stairTreads;
    this.HATCH_X = HATCH_X;
    this.HATCH_Z = HATCH_Z;
    this.bathZ0 = bathZ0;
    this.bathZ1 = bathZ1;
    this.bathX0 = bathX0;
    this.bathX1 = bathX1;
    this.intDoorZ = intDoorZ;
    this.INT_DOOR_W = INT_DOOR_W;
    this.doorZ0 = doorZ0;
    this.doorZ1 = doorZ1;
    this.mzFloorH = mzFloorH;
    this.mzInnerZ = mzInnerZ;

    this.walkMode = false;
    this.walkKeys = { w: false, a: false, s: false, d: false, q: false, e: false, shift: false, space: false };
    this.walkYaw = -Math.PI / 2;
    this.walkPitch = 0;
    this.savedOrbit = null;
    this.walkLevel = 'cabin';
    this.climbAnim = null;
    this.doorAnim = null;
    this.spaceLatch = false;
    this.walkSolids = [];
    this.entryDoor = null;
    this.walkTimer = null;
    this.lastWalkTick = 0;
    this.DOOR_CLOSED = 0;
    this.DOOR_OPEN = -1.95;
    this.EYE = 1.50;
    this.MZ_EYE = 0.38;
    this.WALK_R = 0.11;
    this.MZ_FLOOR_Y = 0; // set after scene setup
    this.pointerLocked = false;
    this.dragLook = false;

    this._initKeyListeners();
    this._initLookListeners();
  }

  setMZFloorY(val) { this.MZ_FLOOR_Y = val; }
  setEntryDoor(door) { this.entryDoor = door; }
  addWalkSolid(obj, level) {
    if (!obj) return;
    obj.userData.walkLevel = level || 'cabin';
    this.walkSolids.push(obj);
  }

  entryHinge() {
    return this.entryDoor && this.entryDoor.userData && this.entryDoor.userData.hinge;
  }

  startDoorAnim(toOpen) {
    const h = this.entryHinge();
    if (!h) return;
    this.doorAnim = {
      from: h.rotation.y,
      to: toOpen ? this.DOOR_OPEN : this.DOOR_CLOSED,
      t: 0,
      dur: toOpen ? 0.9 : 0.65,
    };
  }

  toggleEntryDoor() {
    const h = this.entryHinge();
    if (!h) return;
    const towardOpen = Math.abs(h.rotation.y - this.DOOR_OPEN) > Math.abs(h.rotation.y - this.DOOR_CLOSED);
    this.startDoorAnim(towardOpen);
  }

  tickDoor(dt) {
    if (!this.doorAnim) return;
    const h = this.entryHinge();
    if (!h) { this.doorAnim = null; return; }
    this.doorAnim.t += dt;
    const u = Math.min(1, this.doorAnim.t / this.doorAnim.dur);
    const s = u * u * (3 - 2 * u);
    h.rotation.y = this.doorAnim.from + (this.doorAnim.to - this.doorAnim.from) * s;
    if (u >= 1) this.doorAnim = null;
  }

  inHatchZone(x, z, level) {
    if (level === 'mezz') return z > -this.Lt / 2 - 0.65 && z < -this.Lt / 2 + 0.2 && x > 0.05;
    if (x < 0.05) return false;
    if (z < -this.Lt / 2 + 1.15 && z > -this.Lt / 2 - 0.15) return true;
    for (let i = 0; i < this.stairTreads.length; i++) {
      const t = this.stairTreads[i];
      if (x > t.minx - 0.22 && x < t.maxx + 0.18 && z > t.minz - 0.18 && z < t.maxz + 0.22) return true;
    }
    return false;
  }

  stairStandWorld(x, z) {
    let best = this.FLOOR_Y;
    for (let i = 0; i < this.stairTreads.length; i++) {
      const t = this.stairTreads[i];
      if (x >= t.minx && x <= t.maxx && z >= t.minz && z <= t.maxz) {
        if (t.topWorld > best) best = t.topWorld;
      }
    }
    return best;
  }

  hitsStairBody(x, z, y, r) {
    if (this.stairStandWorld(x, z) > this.FLOOR_Y + 0.05) return false;
    const pad = 0.04;
    for (let i = 0; i < this.stairTreads.length; i++) {
      const t = this.stairTreads[i];
      if (x + pad > t.minx && x - pad < t.maxx && z + pad > t.minz && z - pad < t.maxz) return true;
    }
    return false;
  }

  clampWalk(x, z, level) {
    const xmin = -this.Li / 2 + this.WALK_R;
    let xmax = this.Li / 2 - this.WALK_R;
    const zmax = this.Lt / 2 - this.WALK_R;
    let zmin;
    if (level === 'mezz') zmin = -this.Lt / 2 - 1.88 + this.WALK_R;
    else if (this.stairStandWorld(x, z) > this.FLOOR_Y + 0.4) zmin = -this.Lt / 2 - 0.55;
    else zmin = -this.Lt / 2 + 0.04;
    if (level === 'cabin' && z > this.doorZ0 + 0.04 && z < this.doorZ1 - 0.04) {
      xmax = this.BODY_W / 2 + 1.1;
    }
    return {
      x: Math.max(xmin, Math.min(xmax, x)),
      z: Math.max(zmin, Math.min(zmax, z)),
    };
  }

  hitsBathWalls(x, z, r) {
    const t = 0.05;
    const inZ = z + r > this.bathZ0 - t && z - r < this.bathZ1 + t;
    const inX = x + r > this.bathX0 - t && x - r < this.bathX1 + t;
    if (!inZ || !inX) return false;
    const doorMin = this.intDoorZ - this.INT_DOOR_W / 2 + 0.01;
    const doorMax = this.intDoorZ + this.INT_DOOR_W / 2 - 0.01;
    if (x + r > this.bathX0 - t && x - r < this.bathX0 + t && z + r > this.bathZ0 && z - r < this.bathZ1) return true;
    if (z + r > this.bathZ0 - t && z - r < this.bathZ0 + t && x + r > this.bathX0 && x - r < this.bathX1) return true;
    if (z + r > this.bathZ1 - t && z - r < this.bathZ1 + t && x + r > this.bathX0 && x - r < this.bathX1) return true;
    if (x + r > this.bathX1 - t && x - r < this.bathX1 + t && z + r > this.bathZ0 && z - r < this.bathZ1) {
      if (!(z > doorMin && z < doorMax)) return true;
    }
    return false;
  }

  collidesXZ(x, z, b, r) {
    return x + r > b.min.x && x - r < b.max.x && z + r > b.min.z && z - r < b.max.z;
  }

  walkBlocked(x, z, y, level) {
    const r = this.WALK_R;
    if (level === 'cabin' && this.hitsBathWalls(x, z, r)) return true;
    if (level === 'cabin' && this.hitsStairBody(x, z, y, r)) return true;
    // Move freely through loose furniture; bounds and fixed walls still constrain walking.
    return false;
  }

  resolveWalk(nx, nz, ox, oz, y, level) {
    let c = this.clampWalk(nx, nz, level);
    if (!this.walkBlocked(c.x, c.z, y, level)) return c;
    const cx = this.clampWalk(nx, oz, level);
    if (!this.walkBlocked(cx.x, cx.z, y, level)) return cx;
    const cz = this.clampWalk(ox, nz, level);
    if (!this.walkBlocked(cz.x, cz.z, y, level)) return cz;
    return { x: ox, z: oz };
  }

  eyeY(level) {
    return level === 'mezz' ? this.MZ_FLOOR_Y + this.MZ_EYE : this.FLOOR_Y + this.EYE;
  }

  startClimb(toMezz) {
    if (this.climbAnim) return;
    const toLevel = toMezz ? 'mezz' : 'cabin';
    const toX = Math.max(0.25, Math.min(this.HATCH_X, this.Li / 2 - 0.25));
    const toZ = toMezz ? -this.Lt / 2 - 0.55 : Math.max(this.HATCH_Z, -this.Lt / 2 + 0.55);
    this.climbAnim = {
      fromX: this.camera.position.x, toX,
      fromY: this.camera.position.y, toY: this.eyeY(toLevel),
      fromZ: this.camera.position.z, toZ,
      t: 0, dur: 0.9, toLevel,
    };
  }

  enterWalk(btnEnter, walkHud, crosshair, viewInfo, deselectObjectFn) {
    if (this.walkMode) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    this.savedOrbit = {
      pos: this.camera.position.clone(),
      target: this.orbitControls.target.clone(),
      fov: this.camera.fov,
    };
    this.walkMode = true;
    this.startWalkTimer();
    this.orbitControls.enabled = false;
    this.orbitControls.autoRotate = false;
    this.transformCtrl.detach();
    if (typeof deselectObjectFn === 'function') deselectObjectFn();
    this.camera.fov = 72;
    this.camera.near = 0.04;
    this.camera.updateProjectionMatrix();
    this.walkLevel = 'cabin';
    this.climbAnim = null;
    this.camera.position.set(0.18, this.FLOOR_Y + this.EYE, 0.35);
    this.walkYaw = Math.PI;
    this.walkPitch = 0;
    this.applyWalkLook();
    this.startDoorAnim(true);
    if (btnEnter) btnEnter.classList.add('active');
    if (walkHud) walkHud.classList.add('show');
    if (crosshair) crosshair.classList.add('show');
    const hands = document.getElementById('virtual-hands');
    if (hands) hands.classList.add('show');
    if (viewInfo) viewInfo.textContent = 'vista: INTERIOR · WASD · frente = mezanino · Esc sai';
    try {
      this.renderer.domElement.tabIndex = 0;
      this.renderer.domElement.focus();
      if (this.renderer.domElement.requestPointerLock) {
        this.renderer.domElement.requestPointerLock();
      }
    } catch (e) { /* pointer lock not available */ }
  }

  exitWalk(btnEnter, walkHud, crosshair, viewInfo) {
    if (!this.walkMode) return;
    this.walkMode = false;
    this.stopWalkTimer();
    if (document.exitPointerLock) document.exitPointerLock();
    this.orbitControls.enabled = true;
    this.camera.fov = this.savedOrbit ? this.savedOrbit.fov : 40;
    this.camera.near = 0.1;
    this.camera.updateProjectionMatrix();
    if (this.savedOrbit) {
      this.camera.position.copy(this.savedOrbit.pos);
      this.orbitControls.target.copy(this.savedOrbit.target);
    } else {
      this.camera.position.set(5, 4, 5);
      this.orbitControls.target.set(0, 0.6, 0);
    }
    this.orbitControls.update();
    if (btnEnter) btnEnter.classList.remove('active');
    if (walkHud) walkHud.classList.remove('show');
    if (crosshair) crosshair.classList.remove('show');
    const hands = document.getElementById('virtual-hands');
    if (hands) hands.classList.remove('show');
    if (viewInfo) viewInfo.textContent = 'vista: isométrica · ESC 1:50';
    this.startDoorAnim(false);
  }

  applyWalkLook() {
    const cy = Math.cos(this.walkYaw), sy = Math.sin(this.walkYaw);
    const cp = Math.cos(this.walkPitch), sp = Math.sin(this.walkPitch);
    this.camera.lookAt(
      this.camera.position.x + sy * cp,
      this.camera.position.y + sp,
      this.camera.position.z + cy * cp
    );
  }

  tickWalk(dt) {
    if (!this.walkMode) return;
    if (this.climbAnim) {
      this.climbAnim.t += dt;
      const u = Math.min(1, this.climbAnim.t / this.climbAnim.dur);
      const s = u * u * (3 - 2 * u);
      this.camera.position.x = this.climbAnim.fromX + (this.climbAnim.toX - this.climbAnim.fromX) * s;
      this.camera.position.y = this.climbAnim.fromY + (this.climbAnim.toY - this.climbAnim.fromY) * s;
      this.camera.position.z = this.climbAnim.fromZ + (this.climbAnim.toZ - this.climbAnim.fromZ) * s;
      this.applyWalkLook();
      if (u >= 1) {
        this.walkLevel = this.climbAnim.toLevel;
        this.climbAnim = null;
      }
      return;
    }
    if (!this.walkKeys.space) this.spaceLatch = false;

    const speed = (this.walkKeys.shift ? 2.4 : 1.25) * dt * (this.walkLevel === 'mezz' ? 0.55 : 1);
    const fwdX = Math.sin(this.walkYaw);
    const fwdZ = Math.cos(this.walkYaw);
    let dx = 0, dz = 0, dy = 0;
    if (this.walkKeys.w) { dx += fwdX; dz += fwdZ; }
    if (this.walkKeys.s) { dx -= fwdX; dz -= fwdZ; }
    if (this.walkKeys.a) { dx += fwdZ; dz -= fwdX; }
    if (this.walkKeys.d) { dx -= fwdZ; dz += fwdX; }
    if (this.walkKeys.q) dy -= 1;
    if (this.walkKeys.e) dy += 1;
    const len = Math.hypot(dx, dz) || 1;
    const ox = this.camera.position.x, oz = this.camera.position.z;
    const nx = ox + (dx / len) * speed;
    const nz = oz + (dz / len) * speed;
    const c = this.resolveWalk(nx, nz, ox, oz, this.camera.position.y, this.walkLevel);
    this.camera.position.x = c.x;
    this.camera.position.z = c.z;
    const ceilCab = this.FLOOR_Y + this.WALL_H - 0.12;
    const ceilMz = this.MZ_FLOOR_Y + this.mzIntH - 0.10;
    const stand = this.walkLevel === 'cabin' ? this.stairStandWorld(c.x, c.z) : this.MZ_FLOOR_Y;
    let base = stand + (this.walkLevel === 'mezz' ? this.MZ_EYE : this.EYE);
    if (this.walkLevel === 'cabin') base = Math.min(base, ceilCab);
    if (this.walkLevel === 'mezz') base = Math.min(base, ceilMz);
    if (dy && this.walkLevel === 'cabin') {
      this.camera.position.y = Math.max(stand + 0.35, Math.min(ceilCab, this.camera.position.y + dy * speed));
    } else if (dy && this.walkLevel === 'mezz') {
      this.camera.position.y = Math.max(this.MZ_FLOOR_Y + 0.18, Math.min(ceilMz, this.camera.position.y + dy * speed));
    } else {
      this.camera.position.y = base;
    }
    this.applyWalkLook();
  }

  startWalkTimer() {
    this.stopWalkTimer();
    this.lastWalkTick = performance.now();
    this.walkTimer = setInterval(() => {
      if (!this.walkMode) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - this.lastWalkTick) / 1000);
      this.lastWalkTick = now;
      this.tickWalk(dt);
    }, 16);
  }

  stopWalkTimer() {
    if (this.walkTimer) clearInterval(this.walkTimer);
    this.walkTimer = null;
  }

  _initKeyListeners() {
    window.addEventListener('keydown', (e) => {
      if (!this.walkMode) return;
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') {
        this.walkKeys[k] = true;
        this.tickWalk(0.10);
        e.preventDefault();
        return;
      }
      if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
        if (k === 'arrowup') this.walkKeys.w = true;
        if (k === 'arrowdown') this.walkKeys.s = true;
        if (k === 'arrowleft') this.walkKeys.a = true;
        if (k === 'arrowright') this.walkKeys.d = true;
        this.tickWalk(0.10);
        e.preventDefault();
      }
    }, true);
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') this.walkKeys[k] = false;
      if (k === 'arrowup') this.walkKeys.w = false;
      if (k === 'arrowdown') this.walkKeys.s = false;
      if (k === 'arrowleft') this.walkKeys.a = false;
      if (k === 'arrowright') this.walkKeys.d = false;
      if (k === ' ' || k === 'spacebar') this.walkKeys.space = false;
      if (k === 'shift') this.walkKeys.shift = false;
    });
  }

  _initLookListeners() {
    const applyDelta = (dx, dy) => {
      if (!this.walkMode) return;
      this.walkYaw -= dx * 0.0022;
      this.walkPitch -= dy * 0.0018;
      const lim = Math.PI / 2 - 0.08;
      this.walkPitch = Math.max(-lim, Math.min(lim, this.walkPitch));
      this.applyWalkLook();
    };
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    });
    document.addEventListener('mousemove', (e) => {
      if (this.pointerLocked) applyDelta(e.movementX || 0, e.movementY || 0);
      else if (this.dragLook) applyDelta(e.movementX || 0, e.movementY || 0);
    });
    this.renderer.domElement.addEventListener('mousedown', () => {
      if (this.walkMode) this.dragLook = true;
    });
    window.addEventListener('mouseup', () => { this.dragLook = false; });
  }

  handleKeyDown(e, enterWalkFn, exitWalkFn) {
    const inChat = e.target && e.target.id === 'chat-input';
    const k = e.key.toLowerCase();
    if (this.walkMode) {
      if (k === 'w' || k === 'a' || k === 's' || k === 'd' || k === 'q' || k === 'e') {
        this.walkKeys[k] = true;
        this.tickWalk(0.10);
        e.preventDefault();
        return true;
      }
      if (k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright') {
        if (k === 'arrowup') this.walkKeys.w = true;
        if (k === 'arrowdown') this.walkKeys.s = true;
        if (k === 'arrowleft') this.walkKeys.a = true;
        if (k === 'arrowright') this.walkKeys.d = true;
        this.tickWalk(0.10);
        e.preventDefault();
        return true;
      }
      if (k === ' ' || k === 'spacebar' || k === 'c') {
        this.walkKeys.space = true;
        e.preventDefault();
        if (k === 'c' && !this.climbAnim) this.startClimb(this.walkLevel !== 'mezz');
        return true;
      }
      if (k === 'shift') { this.walkKeys.shift = true; return true; }
      if (k === 'escape') { e.preventDefault(); if (typeof exitWalkFn === 'function') exitWalkFn(); return true; }
    }
    if (!inChat && !this.walkMode && k === 'e' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
      if (typeof enterWalkFn === 'function') enterWalkFn();
      return true;
    }
    return false;
  }
}
