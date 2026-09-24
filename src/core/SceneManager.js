/**
 * SceneManager — initialises the THREE.js scene, camera, renderer,
 * OrbitControls, lighting, ground plane, and grid.
 *
 * Usage:
 *   import { SceneManager } from './core/SceneManager.js';
 *   const sm = new SceneManager(THREE, containerEl);
 *   sm.getScene();   // THREE.Scene
 *   sm.getCamera();  // THREE.PerspectiveCamera
 *   sm.getRenderer();// THREE.WebGLRenderer
 *   sm.getControls();// THREE.OrbitControls
 */
export class SceneManager {
  /**
   * @param {Object} THREE   the THREE library instance
   * @param {HTMLElement} container  DOM element to append the canvas to
   */
  constructor(THREE, container) {
    this._THREE = THREE;

    // ── Scene ──
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xd0ccd0);
    scene.fog = null;
    this._scene = scene;

    // ── Camera ──
    const camera = new THREE.PerspectiveCamera(
      40,
      window.innerWidth / window.innerHeight,
      0.1,
      50,
    );
    camera.position.set(5, 4, 5);
    camera.lookAt(0, 0.8, 0);
    this._camera = camera;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ('outputEncoding' in renderer && THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    if ('toneMapping' in renderer && THREE.ACESFilmicToneMapping != null) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      // ACES+sRGB+env estouravam brancos — exposição reduzida
      renderer.toneMappingExposure = 0.48;
    }
    container.appendChild(renderer.domElement);
    this._renderer = renderer;

    // ── Controls ──
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 2.0;
    controls.maxDistance = 22;
    // PI = órbita completa (inclui vista por baixo do chassi)
    controls.minPolarAngle = 0;
    controls.maxPolarAngle = Math.PI;
    controls.target.set(0, 0.6, 0);
    this._controls = controls;

    // ── Lighting (technical, uniform — no dramatic shadows) ──
    this._setupLighting();

    // ── Env map (reflexos em tinta metálica / vidro / cromo) ──
    this._setupEnvironment();

    // ── Ground + Grid ──
    this._setupGround();

    // ── Resize handler ──
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  // ────────────── Lighting ──────────────
  _setupLighting() {
    const { _scene: scene, _THREE: THREE } = this;

    this._night = false;
    this._fixtureLights = []; // PointLights criadas nos spots/plafons
    this._editableMeshesRef = null;

    const amb = new THREE.AmbientLight(0xffffff, 0.25);
    scene.add(amb);
    this._amb = amb;

    const dir = new THREE.DirectionalLight(0xffffff, 0.28);
    dir.position.set(6, 10, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.left = -6;
    dir.shadow.camera.right = 6;
    dir.shadow.camera.top = 6;
    dir.shadow.camera.bottom = -6;
    dir.shadow.camera.near = 0.1;
    dir.shadow.camera.far = 30;
    scene.add(dir);
    this._dir = dir;

    const fill = new THREE.DirectionalLight(0xb8c8d8, 0.08);
    fill.position.set(-4, 5, -3);
    scene.add(fill);
    this._fill = fill;

    // Lua fraca (só no noturno)
    const moon = new THREE.DirectionalLight(0x6a7aaa, 0);
    moon.position.set(-3, 8, -5);
    scene.add(moon);
    this._moon = moon;
  }

  /**
   * Ambiente PMREM simples (céu + solo + “softbox”) para reflexos
   * no carro/pintura. Genérico — não depende de projeto.
   */
  _setupEnvironment() {
    const THREE = this._THREE;
    const renderer = this._renderer;
    const scene = this._scene;
    if (!renderer || typeof THREE.PMREMGenerator !== 'function') return;
    try {
      const envScene = new THREE.Scene();
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(12, 24, 12),
        new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x8f98a8 }),
      );
      envScene.add(sky);
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshBasicMaterial({ color: 0x6a6558 }),
      );
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = -1.2;
      envScene.add(floor);
      const softbox = (x, y, z, w, h, color) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, h),
          new THREE.MeshBasicMaterial({ color }),
        );
        m.position.set(x, y, z);
        m.lookAt(0, 0.6, 0);
        envScene.add(m);
      };
      // softboxes mais discretos: reflexo branco estourava pintura/cromo
      softbox(4, 6, 3, 5, 3, 0x5a606c);
      softbox(-5, 4, -2, 4, 2, 0x4a505a);
      softbox(0, 5, -6, 6, 2, 0x686458);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envMap = pmrem.fromScene(envScene, 0.04).texture;
      scene.environment = envMap;
      pmrem.dispose();
      envScene.traverse((o) => {
        if (o.isMesh) {
          o.geometry && o.geometry.dispose && o.geometry.dispose();
          o.material && o.material.dispose && o.material.dispose();
        }
      });
    } catch (e) {
      /* env opcional — falha não derruba o app */
    }
  }

  // ────────────── Ground + Grid ──────────────
  _setupGround() {
    const { _scene: scene, _THREE: THREE } = this;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xc8c2ae, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.001;
    ground.receiveShadow = true;
    scene.add(ground);
    this._ground = ground;

    const grid = new THREE.GridHelper(8, 16, 0x8a8276, 0xc0b8a0);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    grid.position.y = 0.001;
    scene.add(grid);
    this._grid = grid;
  }

  /** Lista de meshes editáveis (spots/plafons) para acender no noturno. */
  setEditableMeshes(ref) {
    this._editableMeshesRef = ref || null;
  }

  isNight() { return !!this._night; }

  /**
   * Alterna modo noturno: céu escuro + spots/plafons acesos (emissive + PointLight).
   * @param {boolean} [on] force state; omit = toggle
   * @returns {boolean} estado final
   */
  setNightMode(on) {
    const THREE = this._THREE;
    const next = on == null ? !this._night : !!on;
    this._night = next;
    const scene = this._scene;

    if (next) {
      scene.background = new THREE.Color(0x0a0e18);
      if (!scene.fog) scene.fog = new THREE.FogExp2(0x0a0e18, 0.028);
      else {
        scene.fog.color.setHex(0x0a0e18);
        scene.fog.density = 0.028;
      }
      if (this._amb) this._amb.intensity = 0.12;
      if (this._amb) this._amb.color.setHex(0x1a2233);
      if (this._dir) { this._dir.intensity = 0.08; this._dir.color.setHex(0x334466); }
      if (this._fill) { this._fill.intensity = 0.05; this._fill.color.setHex(0x223355); }
      if (this._moon) { this._moon.intensity = 0.22; this._moon.color.setHex(0x8899bb); }
      if (this._renderer && 'toneMappingExposure' in this._renderer) {
        this._renderer.toneMappingExposure = 0.32;
      }
      if (this._ground && this._ground.material) {
        this._ground.material.color.setHex(0x1a1c22);
        this._ground.material.needsUpdate = true;
      }
      if (this._grid && this._grid.material) {
        this._grid.material.opacity = 0.22;
        if (this._grid.material.color) this._grid.material.color.setHex(0x3a4050);
      }
      this._enableFixtureLights(true);
    } else {
      scene.background = new THREE.Color(0xd0ccd0);
      scene.fog = null;
      if (this._amb) { this._amb.intensity = 0.30; this._amb.color.setHex(0xffffff); }
      if (this._dir) { this._dir.intensity = 0.35; this._dir.color.setHex(0xffffff); }
      if (this._fill) { this._fill.intensity = 0.12; this._fill.color.setHex(0xb8c8d8); }
      if (this._moon) this._moon.intensity = 0;
      if (this._renderer && 'toneMappingExposure' in this._renderer) {
        this._renderer.toneMappingExposure = 0.48;
      }
      if (this._ground && this._ground.material) {
        this._ground.material.color.setHex(0xc8c2ae);
        this._ground.material.needsUpdate = true;
      }
      if (this._grid && this._grid.material) {
        this._grid.material.opacity = 0.5;
        if (this._grid.material.color) this._grid.material.color.setHex(0x8a8276);
      }
      this._enableFixtureLights(false);
    }
    document.body.classList.toggle('night-mode', next);
    document.getElementById('btn-night')?.classList.toggle('active', next);
    document.getElementById('btn-night-float')?.classList.toggle('active', next);
    return next;
  }

  _isLightFixture(obj) {
    if (!obj || !obj.userData) return false;
    const k = String(obj.userData.kind || obj.userData.funcKind || '').toLowerCase();
    return k === 'spot-led' || k === 'plafon' || k === 'led-strip' || k === 'luz-externa'
      || k.indexOf('spot') === 0 || k.indexOf('plafon') === 0 || k.indexOf('led') === 0
      || k.indexOf('luz-ext') === 0;
  }

  _isAwning(obj) {
    if (!obj || !obj.userData) return false;
    const k = String(obj.userData.kind || '').toLowerCase();
    return k === 'toldo-lateral' || k.indexOf('toldo') === 0;
  }

  _clearFixtureLights() {
    this._fixtureLights.forEach((L) => {
      if (L.parent) L.parent.remove(L);
      if (L.dispose) L.dispose();
    });
    this._fixtureLights = [];
  }

  _enableFixtureLights(on) {
    const THREE = this._THREE;
    this._clearFixtureLights();

    const meshes = this._editableMeshesRef || [];
    // 1) fixtures (spots internos + luzes externas)
    for (let i = 0; i < meshes.length; i++) {
      const host = meshes[i];
      if (!host || !host.parent) continue;
      const kind = String((host.userData && host.userData.kind) || '').toLowerCase();
      const isFix = this._isLightFixture(host);
      const isAwn = this._isAwning(host);
      if (!isFix && !isAwn) continue;

      // emissive materials
      host.traverse((ch) => {
        if (!ch.isMesh || !ch.material) return;
        const mats = Array.isArray(ch.material) ? ch.material : [ch.material];
        mats.forEach((mat) => {
          if (!mat || !mat.isMeshStandardMaterial) return;
          if (!mat.userData) mat.userData = {};
          if (on) {
            if (mat.userData._dayEmissive == null) {
              mat.userData._dayEmissive = mat.emissive ? mat.emissive.clone() : new THREE.Color(0x000000);
              mat.userData._dayEmissiveInt = mat.emissiveIntensity != null ? mat.emissiveIntensity : 0;
            }
            const hex = mat.color ? mat.color.getHex() : 0;
            const c = mat.color;
            const warm = hex > 0xc0c0a0 || hex === 0xfff8c8
              || (c && c.r > 0.85 && c.g > 0.75 && c.b > 0.55)
              || (c && c.r > 0.7 && c.g > 0.6 && c.b < 0.55); // lona bege
            if (isAwn) {
              // lona só reflete — sem “lâmpada” na tela
              mat.emissive.setHex(0x000000);
              mat.emissiveIntensity = 0;
            } else {
              mat.emissive.setHex(warm ? 0xffe6a0 : 0xffd080);
              mat.emissiveIntensity = warm ? 3.0 : 0.8;
            }
            mat.needsUpdate = true;
          } else if (mat.userData._dayEmissive) {
            mat.emissive.copy(mat.userData._dayEmissive);
            mat.emissiveIntensity = mat.userData._dayEmissiveInt || 0;
            mat.needsUpdate = true;
          }
        });
      });

      if (!on) continue;

      if (isFix) {
        // Uma luz por fixture (sem duplicar Point+Spot)
        let pInt = 1.2; let pDist = 2.6; let pDec = 2;
        if (kind === 'plafon') { pInt = 1.5; pDist = 3.2; }
        if (kind === 'led-strip') { pInt = 0.8; pDist = 2.2; }
        if (kind === 'spot-led') { pInt = 1.35; pDist = 2.8; }
        if (kind === 'luz-externa') { pInt = 2.8; pDist = 5.5; pDec = 1.5; }

        if (kind === 'luz-externa') {
          // Facho para BAIXO (local -Y): ilumina chão sob toldo / entrada
          const spot = new THREE.SpotLight(0xffe8b0, 4.0, 7.5, Math.PI / 2.6, 0.5, 1.25);
          spot.castShadow = false;
          spot.userData.fixtureLight = true;
          spot.position.set(0.05, -0.06, 0);
          const tgt = new THREE.Object3D();
          tgt.position.set(0.15, -2.8, 0); // quase vertical para baixo
          host.add(tgt);
          spot.target = tgt;
          host.add(spot);
          this._fixtureLights.push(spot);
          this._fixtureLights.push(tgt);
        } else {
          const pl = new THREE.PointLight(0xffe2a8, pInt, pDist, pDec);
          pl.castShadow = false;
          pl.userData.fixtureLight = true;
          pl.position.set(0, -0.08, 0);
          host.add(pl);
          this._fixtureLights.push(pl);
        }
      }

      // toldo: só leve emissive na lona (sem lampadas extras)
    }
  }

  /** Reaplica lights se o layout mudou e o noturno está ativo. */
  refreshNightFixtures() {
    if (this._night) this._enableFixtureLights(true);
  }

  // ────────────── Resize ──────────────
  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this._camera.aspect = w / h;
    this._camera.updateProjectionMatrix();
    this._renderer.setSize(w, h);
  }

  // ────────────── Public API ──────────────
  getScene()   { return this._scene; }
  getCamera()  { return this._camera; }
  getRenderer(){ return this._renderer; }
  getControls(){ return this._controls; }

  /**
   * Reposition camera + target in one shot.
   * Disables damping so OrbitControls snaps to the new spherical state.
   */
  repositionCamera(posX, posY, posZ, targetX, targetY, targetZ) {
    const c = this._controls;
    const cam = this._camera;
    c.enableDamping = false;
    cam.up.set(0, 1, 0);
    c.target.set(targetX, targetY, targetZ);
    cam.position.set(posX, posY, posZ);
    c.update();
    c.enableDamping = true;
  }

  /**
   * Render a single frame (call inside your animation loop).
   */
  render() {
    this._controls.update();
    this._renderer.render(this._scene, this._camera);
  }

  /**
   * Clean up event listeners and renderer.
   */
  dispose() {
    window.removeEventListener('resize', this._onResize);
    this._renderer.dispose();
  }
}
