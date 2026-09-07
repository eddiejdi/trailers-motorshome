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
    scene.background = new THREE.Color(0xe8e6e0);
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
    container.appendChild(renderer.domElement);
    this._renderer = renderer;

    // ── Controls ──
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.minDistance = 2.0;
    controls.maxDistance = 15;
    controls.maxPolarAngle = Math.PI - 0.02;
    controls.target.set(0, 0.6, 0);
    this._controls = controls;

    // ── Lighting (technical, uniform — no dramatic shadows) ──
    this._setupLighting();

    // ── Ground + Grid ──
    this._setupGround();

    // ── Resize handler ──
    this._onResize = this._handleResize.bind(this);
    window.addEventListener('resize', this._onResize);
  }

  // ────────────── Lighting ──────────────
  _setupLighting() {
    const { _scene: scene, _THREE: THREE } = this;

    // Ambient — soft fill everywhere
    const amb = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(amb);

    // Key directional light (with shadows)
    const dir = new THREE.DirectionalLight(0xffffff, 0.55);
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

    // Fill light — cooler tone from the opposite side
    const fill = new THREE.DirectionalLight(0xb8c8d8, 0.3);
    fill.position.set(-4, 5, -3);
    scene.add(fill);
  }

  // ────────────── Ground + Grid ──────────────
  _setupGround() {
    const { _scene: scene, _THREE: THREE } = this;

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 20),
      new THREE.MeshStandardMaterial({ color: 0xe0dcc8, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.001;
    ground.receiveShadow = true;
    scene.add(ground);

    const grid = new THREE.GridHelper(8, 16, 0x8a8276, 0xc0b8a0);
    grid.material.opacity = 0.5;
    grid.material.transparent = true;
    grid.position.y = 0.001;
    scene.add(grid);
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
