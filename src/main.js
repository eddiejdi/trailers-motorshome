
function escHtml(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function safeUrl(u) {
  try {
    const x = new URL(String(u || ''), location.origin);
    return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
  } catch { return ''; }
}

/**
 * main.js — Orquestrador do Trailer 3D Studio
 * Inicializa todos os módulos, computa valores derivados, e conecta a aplicação.
 */
import { SceneManager } from './core/SceneManager.js';
import { createMaterials, mat } from './constants/Colors.js';
import * as D from './constants/Dimensions.js';
import Chassis from './model/Chassis.js';
import Body from './model/Body.js';
import Roof from './model/Roof.js';
import Windows from './model/Windows.js';
import Interior from './model/Interior.js';
import Labels from './model/Labels.js';
import EditorService from './services/EditorService.js';
import SaveService from './services/SaveService.js';
import MaterialService from './services/MaterialService.js';
import WalkthroughService from './services/WalkthroughService.js';
import AIService from './services/AIService.js?v=20260909-2230';
import ExportService from './services/ExportService.js';
import PaletteService from './services/PaletteService.js';
import PhotoBookService from './services/PhotoBookService.js';
import MarcenariaService from './services/MarcenariaService.js';
import AuthService from './services/AuthService.js';
import UserFilesService from './services/UserFilesService.js';
import WeightService from './services/WeightService.js';
import ProjectService from './services/ProjectService.js';
import TrailerCatalogService from './services/TrailerCatalogService.js';
import PlanView2D from './views/PlanView2D.js';
import ConnectionService from './services/ConnectionService.js';

// DISCLAIMER/HOOK: Este bloco foi removido. A fonte de verdade é data/palette-catalog.json.
// Se você precisa de PALLET_DATA, carregue-o do catálogo (this._catalogMap).
// NÃO re-hardcode objetos aqui — edite o JSON e recarregue o app.

function showFatalOnScreen(err, where = 'runtime') {
  const msg = err && err.message ? err.message : String(err);
  const text = '[FATAL][' + where + '] ' + msg;
  console.error(text, err);
  let box = document.getElementById('fatal-runtime-overlay');
  if (!box) {
    box = document.createElement('div');
    box.id = 'fatal-runtime-overlay';
    box.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:99999;background:#2b0000;color:#ffd9d9;border:1px solid #ff6b6b;border-radius:8px;padding:10px 12px;font:12px/1.35 monospace;white-space:pre-wrap;max-height:42vh;overflow:auto;';
    document.body.appendChild(box);
  }
  box.textContent = text + '\n\nVeja o console para stack trace completa.';
}

class TrailerApp {
  constructor() {
    this.sceneManager = null;
    this.M = null;
    this.trailer = null;
    this.models = {};
    this.services = {};
    this.editableMeshes = [];
    this.computed = {};
  }

  _computeDerived() {
    const { W, BODY_W, L, Lt, Hc, Hint, wth, Li, CHASSIS_Y, mzL, mzW, mzFloorH,
      FLOOR_T, N_STEPS, DOOR_W, DOOR_H, DOOR_SILL, INT_DOOR_W, INT_DOOR_H, INT_SILL,
      BATH_W, LOFT_HATCH_W, ROOF_CURVE_R, ROOF_RISE, SKIRT_T, WALL_H, CHASSIS_BEAM_H, CHASSIS_BEAM_W } = D;

    const chassisBeamH = CHASSIS_BEAM_H;
    const chassisBeamW = CHASSIS_BEAM_W;
    const chassisDeckT = FLOOR_T; // usa a configuração do dimensions.js (pode ser ajustado para caixas sob o piso)
    const FLOOR_Y = CHASSIS_Y + 0.04 + chassisBeamH + chassisDeckT;

    const zRoofFront = -Lt / 2 - mzL;
    const zRoofRear = Lt / 2;
    const roofTotalL = zRoofRear - zRoofFront;
    const roofCurveR = ROOF_CURVE_R;
    const roofRise = ROOF_RISE;
    const roofFlatStart = zRoofFront + roofCurveR;
    const roofFlatEnd = zRoofRear - roofCurveR;

    const frontZCenter = roofFlatStart;
    const backZCenter = roofFlatEnd;

    function roofY(z) {
      if (z < roofFlatStart) {
        const dz = z - frontZCenter;
        return Math.sqrt(Math.max(0, roofCurveR * roofCurveR - dz * dz));
      }
      if (z > roofFlatEnd) {
        const dz = z - backZCenter;
        return Math.sqrt(Math.max(0, roofCurveR * roofCurveR - dz * dz));
      }
      return roofRise;
    }
    function roofTop(z) { return WALL_H + roofY(z); }

    const mzWallY0 = (mzFloorH + 0.04) - FLOOR_Y;
    const mzInnerW = Li;
    const mzInnerZ = -Lt / 2 - mzL / 2;
    const mzIntH = 0.77;
    const colTopY = mzFloorH + 0.02;

    const DOOR_Z = Lt / 2 - 0.52;
    const doorZ0 = DOOR_Z - DOOR_W / 2;
    const doorZ1 = DOOR_Z + DOOR_W / 2;

    const bw = BATH_W;
    const bathX0 = -BODY_W / 2 + wth;
    const bathZ0 = -Lt / 2 + wth;
    const bathX1 = bathX0 + bw;
    const bathZ1 = bathZ0 + bw;
    const intDoorZ = bathZ0 + bw / 2;

    const stairW = 0.30;
    const treadD = 0.34;
    const innerWallXp = BODY_W / 2 - wth;
    const stairX = innerWallXp - stairW / 2;
    const stairRise = (mzFloorH + 0.06 - FLOOR_Y) / N_STEPS;
    const stairTreads = [];
    for (let i = 0; i < N_STEPS; i++) {
      const h = (i + 1) * stairRise;
      const z = -Lt / 2 + 0.08 + (N_STEPS - 1 - i) * treadD + treadD / 2;
      stairTreads.push({
        minx: stairX - stairW / 2, maxx: stairX + stairW / 2,
        minz: z - treadD / 2, maxz: z + treadD / 2,
        h: h, topWorld: FLOOR_Y + h, top: i === N_STEPS - 1
      });
    }
    const HATCH_X = stairX;
    const HATCH_Z = stairTreads[N_STEPS - 1].minz + treadD / 2;

    this.computed = {
      chassisBeamH, chassisBeamW, FLOOR_Y,
      zRoofFront, zRoofRear, roofTotalL, roofCurveR, roofRise,
      roofFlatStart, roofFlatEnd, roofY, roofTop,
      mzWallY0, mzInnerW, mzInnerZ, mzIntH, colTopY,
      DOOR_Z, doorZ0, doorZ1,
      bw, bathX0, bathZ0, bathX1, bathZ1, intDoorZ,
      stairW, treadD, stairX, stairRise, stairTreads, HATCH_X, HATCH_Z
    };
  }

  async init() {
    if (!window.THREE) {
      document.getElementById('canvas-wrap').innerHTML =
        '<div style="color:#a00;padding:20px;font-family:monospace">ERRO: three.min.js não carregou.</div>';
      return;
    }
    const THREE = window.THREE;

    // Carregar catálogo de objetos (data/palette-catalog.json)
    try {
      await this.reloadCatalog();
    } catch (err) {
      console.error('[catalog] Falha ao carregar data/palette-catalog.json:', err);
      this.catalog = { items: [] };
      this._catalogMap = {};
    }

    this.services = this.services || {};
    this.services.trailerCatalog = new TrailerCatalogService();
    try {
      await this.services.trailerCatalog.load('data/trailer-catalog.json');
    } catch (err) {
      console.error('[trailer-catalog] Falha ao carregar:', err);
    }

    this._renderPaletteButtons();

    if (THREE.Quaternion && !THREE.Quaternion.prototype.invert && THREE.Quaternion.prototype.inverse) {
      THREE.Quaternion.prototype.invert = THREE.Quaternion.prototype.inverse;
    }
    if (THREE.Matrix4 && !THREE.Matrix4.prototype.invert && THREE.Matrix4.prototype.getInverse) {
      THREE.Matrix4.prototype.invert = function () { return this.getInverse(this); };
    }

    try {
      this._computeDerived();
      const C2 = this.computed;

      this.sceneManager = new SceneManager(THREE, document.getElementById('canvas-wrap'));
      const scene = this.sceneManager.getScene();
      const camera = this.sceneManager.getCamera();
      const renderer = this.sceneManager.getRenderer();
      const controls = this.sceneManager.getControls();

      this.M = createMaterials(THREE);
      const M = this.M;

      this.trailer = new THREE.Group();
      scene.add(this.trailer);

      // ── Modelos ──
      const chassis = new Chassis(THREE, M, D);
      this.models.chassis = chassis;
      const chassisG = chassis.build();
      this.trailer.add(chassisG);

      const body = new Body(THREE, M, {
        BODY_W: D.BODY_W, Lt: D.Lt, L: D.L, W: D.W, Hc: D.Hc, Hint: D.Hint, wth: D.wth,
        CHASSIS_Y: D.CHASSIS_Y, FLOOR_Y: C2.FLOOR_Y,
        roofY: C2.roofY, roofTop: C2.roofTop,
        roofFlatStart: C2.roofFlatStart, roofFlatEnd: C2.roofFlatEnd,
        zRoofFront: C2.zRoofFront,
        mzWallY0: C2.mzWallY0, mzFloorH: D.mzFloorH
      });
      // Cortes de abertura: vazios no factory; o layout do projeto (JSON) define janelas/portas.
      this.models.body = body;
      const bodyResult = body.build(null, [], [], chassisG);
      this.entryDoor = bodyResult.entryDoor;
      this.trailer.add(bodyResult.group);

      const roof = new Roof(THREE, M, {
        BODY_W: D.BODY_W, Lt: D.Lt, WALL_H: D.WALL_H,
        zRoofFront: C2.zRoofFront, zRoofRear: C2.zRoofRear,
        roofTotalL: C2.roofTotalL, roofCurveR: C2.roofCurveR, roofRise: C2.roofRise,
        roofFlatStart: C2.roofFlatStart, roofFlatEnd: C2.roofFlatEnd,
        roofY: C2.roofY, roofTop: C2.roofTop
      });
      this.models.roof = roof;
      const roofResult = roof.build();
      roofResult.position.y += C2.FLOOR_Y;
      this.trailer.add(roofResult);

      const windows = new Windows(THREE, M, {
        BODY_W: D.BODY_W, wth: D.wth, Lt: D.Lt, WALL_H: D.WALL_H,
        roofTop: C2.roofTop, roofY: C2.roofY,
        zRoofFront: C2.zRoofFront, zRoofRear: C2.zRoofRear,
        mzFloorH: D.mzFloorH, mzWallY0: C2.mzWallY0,
        mzInnerZ: C2.mzInnerZ, mzInnerW: C2.mzInnerW,
        colTopY: C2.colTopY, mzW: D.mzW
      });
      const interior = new Interior(THREE, M, {
        BODY_W: D.BODY_W, Li: D.Li, Lt: D.Lt, wth: D.wth,
        FLOOR_Y: C2.FLOOR_Y, WALL_H: D.WALL_H,
        mzFloorH: D.mzFloorH, mzW: D.mzW, mzL: D.mzL,
        mzInnerZ: C2.mzInnerZ, mzInnerW: C2.mzInnerW,
        CHASSIS_Y: D.CHASSIS_Y, zRoofFront: C2.zRoofFront,
        roofTop: C2.roofTop, MATTRESS_CASAL_L: D.MATTRESS_CASAL_L
      });
      this.models.interior = interior;
      const interiorResult = interior.build(chassisG);
      this.trailer.add(interiorResult.group);

      this.models.windows = windows;
      windows.build(bodyResult.wallsExt, bodyResult.wallGroup, interior.mezz);

      const labels = new Labels(THREE, {
        BODY_W: D.BODY_W, Li: D.Li, Lt: D.Lt, W: D.W,
        WALL_H: D.WALL_H, FLOOR_Y: C2.FLOOR_Y,
        mzFloorH: D.mzFloorH, mzW: D.mzW, mzL: D.mzL
      });
      this.models.labels = labels;
      labels.build(scene, {});

      // ── Coletar meshes editáveis ──
      this._collectEditableMeshes();

      // ── Serviços ──
      this.services.editor = new EditorService({
        scene, camera, renderer, trailer: this.trailer, controls,
        editableMeshes: this.editableMeshes,
        FLOOR_Y: C2.FLOOR_Y, WALL_H: D.WALL_H, Li: D.Li, Lt: D.Lt,
        wth: D.wth, BODY_W: D.BODY_W, interior, body
      });

      this.services.save = new SaveService({
        editableMeshes: this.editableMeshes,
        scene,
        body
      });

      this.services.material = new MaterialService(this.services.editor);

      this.services.walkthrough = new WalkthroughService({
        camera, renderer, controls,
        transformCtrl: this.services.editor.transformCtrl,
        FLOOR_Y: C2.FLOOR_Y, WALL_H: D.WALL_H, Li: D.Li, Lt: D.Lt,
        BODY_W: D.BODY_W, mzIntH: C2.mzIntH,
        stairTreads: C2.stairTreads,
        HATCH_X: C2.HATCH_X, HATCH_Z: C2.HATCH_Z,
        bathZ0: C2.bathZ0, bathZ1: C2.bathZ1,
        bathX0: C2.bathX0, bathX1: C2.bathX1,
        intDoorZ: C2.intDoorZ, INT_DOOR_W: D.INT_DOOR_W,
        doorZ0: C2.doorZ0, doorZ1: C2.doorZ1,
        mzFloorH: D.mzFloorH, mzInnerZ: C2.mzInnerZ
      });
      this.services.walkthrough.setEntryDoor(bodyResult.entryDoor);
      this.services.walkthrough.setMZFloorY((interiorResult.colTopY || D.mzFloorH || 1.5) + 0.04);
      [interiorResult.stairCabs, interiorResult.guard].forEach((obj) => {
        if (obj) this.services.walkthrough.addWalkSolid(obj, 'cabin');
      });
      if (interiorResult.kidBed) this.services.walkthrough.addWalkSolid(interiorResult.kidBed, 'cabin');
      if (interiorResult.casalBed) this.services.walkthrough.addWalkSolid(interiorResult.casalBed, 'mezz');
      const ed = this.services.editor;
      this.services.ai = new AIService({
        editableMeshes: this.editableMeshes,
        trailer: this.trailer,
        // Homelab GPU0 (RTX 3060 :11434) — NUNCA NAS :11436 (exclusivo trading)
        ollamaUrl: 'http://192.168.15.2:11434',
        ollamaModel: 'trailer3d-assistant:latest',
        setWorldPosFn: (obj, x, y, z) => { obj.position.set(x, y, z); },
        resolvePlacementFn: (obj) => ed.resolvePlacement(obj),
        pushUndoFn: () => ed.pushUndo(),
        selectObjectFn: (obj) => ed.selectObject(obj),
        deselectObjectFn: () => ed.deselectObject(),
        updateEditorPanelFn: () => {}
      });

      this.services.export = new ExportService();

      const matFn = (color, opts) => mat(color, opts, THREE);

      this.services.auth = new AuthService();
      this.services.project = new ProjectService();
      if (this.services.export && this.services.export.setProjectService) {
        this.services.export.setProjectService(this.services.project);
      }
      const paletteWeights = {};
      for (const item of (this.catalog.items || [])) paletteWeights[item.kind] = item.weightKg || 1.0;
      this.services.weight = new WeightService(this.services.project.getWeights(), paletteWeights);

      this.services.palette = new PaletteService({
        catalog: this.catalog, interior, body, FLOOR_Y: C2.FLOOR_Y,
        editableMeshes: this.editableMeshes,
        pushUndoFn: () => ed.pushUndo(),
        resolvePlacementFn: (obj) => ed.resolvePlacement(obj),
        selectObjectFn: (obj) => ed.selectObject(obj),
        addEditableFn: (mesh, name, cat, kind) => {
          ed.addEditable(mesh, name || (mesh.userData && mesh.userData.name) || 'Objeto', cat, kind);
          if (!this.editableMeshes.includes(mesh)) this.editableMeshes.push(mesh);
          if (this.services.connections) this.services.connections.invalidate();
        },
        uniqueNameFn: (base) => {
          let n = base, i = 2;
          while (this.editableMeshes.some(m => m.userData && m.userData.name === n)) n = base + ' ' + i++;
          return n;
        },
        roofTopFn: (z) => C2.roofTop(z),
        makeHingedDoorFn: (opts) => interior.makeHingedDoor(opts),
        makeRvWindowFn: (w, h, r) => windows.makeRvWindow(w, h, r),
        makeDinetteGroupFn: (opts) => interior.makeDinetteGroup ? interior.makeDinetteGroup(opts || {}) : null,
        rootGroupFn: () => this.trailer,
        onFatalErrorFn: (err, where) => showFatalOnScreen(err, where),
        weightService: this.services.weight
      });

      // Auto-connect água / esgoto / 12V / 220V (hubs = scene_layout + catálogo)
      const sceneRoot = this.sceneManager.getScene();
      this.services.connections = new ConnectionService({
        scene: sceneRoot,
        trailer: this.trailer,
        editableMeshes: this.editableMeshes,
        FLOOR_Y: C2.FLOOR_Y,
        Li: D.Li || D.Lt || 2.9,
        Lt: D.Lt || 2.9,
        BODY_W: D.BODY_W || 1.9,
        wth: D.wth || 0.05,
        catalog: this.catalog,
      });
      // carrega data/utilities-network.json (água/elétrica data-driven)
      this.services.connections.loadNetworkSpec('data/utilities-network.json');

      this.services.marcenaria = new MarcenariaService({
        M, matFn,
        editableMeshes: this.editableMeshes,
        selectedRef: { get current() { return ed.selected; }, set current(v) { ed.selected = v; } },
        pushUndoFn: () => ed.pushUndo(),
        selectObjectFn: (obj) => ed.selectObject(obj),
        resolvePlacementFn: (obj) => ed.resolvePlacement(obj),
        saveLayoutFn: () => this.services.save.save(),
        roofTopFn: (z) => C2.roofTop(z),
        FLOOR_Y: C2.FLOOR_Y
      });

      this.services.userFiles = new UserFilesService({
        auth: this.services.auth,
        saveService: this.services.save,
        projectService: this.services.project,
        loadDeps: {},
      });

      // ── Visão Planta 2D ──
      this.services.planView2D = new PlanView2D({
        scene, camera, renderer,
        editableMeshes: this.editableMeshes,
        trailer: this.trailer,
        computed: this.computed,
        D, editor: this.services.editor,
        persistFn: (reason) => this.persistProjectNow?.(reason)
      });

this.initUI();
       this.startLoop();
       window.trailerApp = this;
       console.log('Trailer 3D Studio inicializado com sucesso!');
    } catch (err) {
      console.error('TRAILER 3D ERROR:', err);
      const wrap = document.getElementById('canvas-wrap');
      if (wrap) wrap.innerHTML +=
        '<div style="color:#a00;padding:20px;font-family:monospace;white-space:pre-wrap">ERRO:\n' +
        (err && err.message ? err.message : String(err)) + '</div>';
    }
  }

  /** Recarrega o catálogo de objetos da paleta a partir de data/palette-catalog.json.
   *  Retorna true em sucesso. Permite que kinds novos (ex.: janela-are-180x50)
   *  cheguem a um app já em execução sem precisar recarregar a página. */
  async reloadCatalog() {
    const resp = await fetch('data/palette-catalog.json', { cache: 'no-store' });
    if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
    const catalog = await resp.json();
    this.catalog = catalog;
    this._catalogMap = {};
    for (const item of catalog.items) this._catalogMap[item.kind] = item;
    // PaletteService guarda referência própria — sincroniza
    if (this.services && this.services.palette) {
      this.services.palette.catalog = catalog;
    }
    if (this.services && this.services.connections) {
      this.services.connections.setCatalog(catalog);
      try { await this.services.connections.loadNetworkSpec('data/utilities-network.json'); } catch (e) { /* ignore */ }
      this.services.connections.invalidate();
    }
    return true;
  }

  _renderPaletteButtons() {
    const grid = document.querySelector('#palette .grid');
    const catalog = this.catalog;
    if (!grid || !catalog || !catalog.items) return;
    grid.innerHTML = '';

    // ── Reboques conhecidos (data/trailer-catalog.json) ──
    const trailers = (this.services && this.services.trailerCatalog)
      ? this.services.trailerCatalog.list()
      : [];
    if (trailers.length) {
      const h0 = document.createElement('div');
      h0.className = 'pal-cat';
      h0.textContent = 'Reboques';
      grid.appendChild(h0);
      for (const tr of trailers) {
        if (!tr || !tr.id) continue;
        const btn = document.createElement('button');
        btn.className = 'pi';
        btn.setAttribute('data-trailer', tr.id);
        btn.title = (tr.brand || '') + ' · ' + (tr.length_m || '?') + ' m · ' + (tr.notes || tr.source || '');
        const thumb = document.createElement('span');
        thumb.className = 'thumb';
        thumb.innerHTML = tr.svg || '';
        btn.appendChild(thumb);
        btn.appendChild(document.createTextNode(tr.name || tr.id));
        btn.addEventListener('click', () => this._applyTrailerCatalogModel(tr.id));
        grid.appendChild(btn);
      }
    }

    const catOrder = [];
    for (const item of catalog.items) {
      if (!catOrder.includes(item.cat)) catOrder.push(item.cat);
    }
    for (const cat of catOrder) {
      const h = document.createElement('div');
      h.className = 'pal-cat';
      h.textContent = cat;
      grid.appendChild(h);
      for (const item of catalog.items) {
        if (item.cat !== cat || !item.svg) continue;
        const btn = document.createElement('button');
        btn.className = 'pi';
        btn.setAttribute('data-item', item.kind);
        const thumb = document.createElement('span');
        thumb.className = 'thumb';
        thumb.innerHTML = item.svg;
        btn.appendChild(thumb);
        btn.appendChild(document.createTextNode(item.name || item.kind));
        grid.appendChild(btn);
      }
    }
    const countEl = document.getElementById('pal-count');
    const nObj = catalog.items.length;
    const nTr = trailers.length;
    if (countEl) countEl.textContent = nObj + ' objs · ' + nTr + ' reboques';
    window.dispatchEvent(new CustomEvent('palette:rendered'));
  }

  _applyTrailerCatalogModel(id) {
    const tc = this.services && this.services.trailerCatalog;
    const project = this.services && this.services.project;
    const save = this.services && this.services.save;
    const ai = this.services && this.services.ai;
    if (!tc || !project) return;
    const base = project.getProject ? project.getProject() : null;
    const built = tc.buildProjectFromTemplate(id, base);
    if (!built) {
      ai && ai.aiLog('Modelo de reboque não encontrado: ' + id, 'err');
      return;
    }
    // prune tanks again
    if (built.scene_layout && built.scene_layout.objects) {
      built.scene_layout.objects = TrailerCatalogService.pruneTankDuplicates(built.scene_layout.objects);
    }
    project.loadProject(built);
    const saveDeps = {
      spawnPaletteItem: (kind, opts) => this.services.palette && this.services.palette.spawnPaletteItem(kind, opts),
      attachProductMeta: (mesh, kind) => this.services.palette && this.services.palette.attachProductMeta(mesh, kind),
      attachCarpentryPart: () => null,
      applyMaderiteState: (mesh, st) => this.services.palette && this.services.palette.applyMaderiteState(mesh, st),
      pruneEditor: () => this.services.editor && this.services.editor.pruneOrphanEditables(),
      aiLog: (text, cls) => ai && ai.aiLog(text, cls),
    };
    if (save && typeof save.applyCapturedFromLayout === 'function' && built.scene_layout) {
      try {
        save.resetLayout && save.resetLayout(null, { forceFactory: true });
        save.applyCapturedFromLayout(built.scene_layout, saveDeps);
      } catch (e) {
        console.warn('apply trailer catalog layout', e);
      }
    }
    this.renderSpecPanel && this.renderSpecPanel(document.getElementById('specs-list'));
    ai && ai.aiLog('Reboque aplicado: ' + (built.meta && built.meta.name || id) + ' (tanques do JSON do modelo).', 'sys');
  }

  _collectEditableMeshes() {
    const meshes = [];
    const interior = this.models.interior;

    // Interior layout vem do JSON (scene_layout) — factory só expõe grupos vazios.
    // Meshes editáveis de interior são adicionados via Palette/Save applyCapturedFromLayout.

    // Janelas e porta de entrada são movíveis pelo layout (projeto manda):
    const addGroup = (g) => {
      if (g && g.userData && g.userData.name && meshes.indexOf(g) < 0) {
        g.userData.editable = true;
        meshes.push(g);
      }
    };
    // Janelas: só via paleta/JSON (não há windowGroups de factory).
    addGroup(this.entryDoor);

    // Mutate in place — never reassign: Editor/Save/Palette hold the same array ref.
    this.editableMeshes.length = 0;
    for (let i = 0; i < meshes.length; i++) this.editableMeshes.push(meshes[i]);
    if (this.services) {
      if (this.services.editor) this.services.editor.editableMeshes = this.editableMeshes;
      if (this.services.save) this.services.save.editableMeshes = this.editableMeshes;
      if (this.services.palette) this.services.palette.editableMeshes = this.editableMeshes;
      if (this.services.ai) this.services.ai.editableMeshes = this.editableMeshes;
    }
    console.log('Editable meshes:', this.editableMeshes.length);
  }

  _collectAllEditable() {
    const seen = new Set(this.editableMeshes);
    const self = this;
    const add = (obj) => {
      if (obj.isMesh && !seen.has(obj)) {
        seen.add(obj);
        obj.userData.editable = true;
        obj.userData.collider = true;
        if (!obj.userData.name) obj.userData.name = obj.name || 'Objeto';
        self.editableMeshes.push(obj);
      }
    };
    if (this.trailer) this.trailer.traverse(add);
    const labels = this.models.labels;
    if (labels) {
      if (labels.labelsGroup) labels.labelsGroup.traverse(add);
      if (labels.cotasGroup) labels.cotasGroup.traverse(add);
    }
    console.log('Total editable meshes after _collectAllEditable:', this.editableMeshes.length);
  }

  initUI() {
    const { editor, walkthrough, palette, save, ai, material, marcenaria } = this.services;
    const THREE = window.THREE;
    const sceneManager = this.sceneManager;
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    const controls = sceneManager.getControls();
    const body = this.models.body;
    const roof = this.models.roof;
    const labels = this.models.labels;
    const windowsM = this.models.windows;

    this.renderSpecPanel(document.getElementById('specs-list'));

    let showWalls = true, showRoof = true, showCotas = false, showLabels = false;

    this.ensureEnvelopeVisibility = (visible = true, roofVisible = null) => {
      showWalls = !!visible;
      showRoof = roofVisible == null ? !!visible : !!roofVisible;
      if (body.wallsExt) body.wallsExt.visible = showWalls;
      if (body.backWallGroup) body.backWallGroup.visible = showWalls;
      if (body.frontWallGroup) body.frontWallGroup.visible = showWalls;
      if (body.frontMzGroup) body.frontMzGroup.visible = showWalls;
      if (roof.group) roof.group.visible = showRoof;
      if (windowsM.sky) windowsM.sky.visible = showRoof;
      if (windowsM.mzSky) windowsM.mzSky.visible = showRoof;
      document.getElementById('btn-walls')?.classList.toggle('active', showWalls);
      document.getElementById('btn-roof')?.classList.toggle('active', showRoof);
      const paredesBtn = document.querySelector('.cat-btn[data-cat="paredes"]');
      if (paredesBtn) paredesBtn.classList.toggle('active', showWalls);
      const telhadoBtn = document.querySelector('.cat-btn[data-cat="telhado"]');
      if (telhadoBtn) telhadoBtn.classList.toggle('active', showRoof);
    };

    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.onclick = fn;
    };

    bind('btn-walls', () => {
      showWalls = !showWalls;
      if (body.wallsExt) body.wallsExt.visible = showWalls;
      if (body.backWallGroup) body.backWallGroup.visible = showWalls;
      if (body.frontWallGroup) body.frontWallGroup.visible = showWalls;
      if (body.frontMzGroup) body.frontMzGroup.visible = showWalls;
      document.getElementById('btn-walls').classList.toggle('active', showWalls);
    });
    bind('btn-roof', () => {
      showRoof = !showRoof;
      if (roof.group) roof.group.visible = showRoof;
      if (windowsM.sky) windowsM.sky.visible = showRoof;
      if (windowsM.mzSky) windowsM.mzSky.visible = showRoof;
      document.getElementById('btn-roof').classList.toggle('active', showRoof);
    });
    bind('btn-cotas', () => {
      showCotas = !showCotas;
      if (labels.cotasGroup) labels.cotasGroup.visible = showCotas;
      document.getElementById('btn-cotas').classList.toggle('active', showCotas);
    });
    bind('btn-labels', () => {
      showLabels = !showLabels;
      if (labels.labelsGroup) labels.labelsGroup.visible = showLabels;
      document.getElementById('btn-labels').classList.toggle('active', showLabels);
    });
    // modo noturno: céu escuro + spots/plafons acesos
    if (sceneManager && typeof sceneManager.setEditableMeshes === 'function') {
      sceneManager.setEditableMeshes(this.editableMeshes);
    }
    const toggleNight = () => {
      if (!sceneManager || typeof sceneManager.setNightMode !== 'function') return;
      sceneManager.setEditableMeshes(this.editableMeshes);
      const on = sceneManager.setNightMode();
      const vi = document.getElementById('view-info');
      if (vi) {
        const base = (vi.textContent || '').replace(/\s*·\s*noite.+$/i, '').replace(/\s*·\s*dia.+$/i, '');
        vi.textContent = base + (on ? ' · noite (luzes on)' : ' · dia');
      }
      if (ai && typeof ai.aiLog === 'function') {
        ai.aiLog(on ? 'Modo noturno: spots 12V acesos.' : 'Modo diurno.', 'sys');
      }
    };
    bind('btn-night', toggleNight);
    bind('btn-night-float', toggleNight);
    this.toggleNightMode = toggleNight;

    // Photo book (multi-vista dia/noite)
    this.services.photoBook = new PhotoBookService({
      sceneManager,
      getApp: () => this,
      getProjectMeta: () => {
        const p = this.services.project && this.services.project.project;
        const m = (p && p.meta) || {};
        return {
          name: m.name || 'Trailer',
          rev: m.rev,
          version: m.version,
          source: m.source || 'scene_layout',
          description: m.description || '',
        };
      },
    });
    const runPhotoBook = async () => {
      const btn = document.getElementById('btn-book') || document.getElementById('btn-book-float');
      const vi = document.getElementById('view-info');
      if (!this.services.photoBook) return;
      if (this.services.photoBook.busy) return;
      try {
        if (btn) { btn.disabled = true; btn.classList.add('active'); }
        const result = await this.services.photoBook.generate({
          onProgress: (i, n, title) => {
            if (vi) vi.textContent = `book ${i}/${n}: ${title}`;
            if (btn) btn.textContent = `book ${i}/${n}`;
          },
        });
        this.services.photoBook.openBook(result.html);
        this.services.photoBook.downloadBook(result.html, `photo-book-rev${result.meta.rev || 'x'}.html`);
        if (ai && ai.aiLog) ai.aiLog(`Photo book gerado (${result.pages.length} fotos).`, 'sys');
        if (vi) vi.textContent = `book pronto · ${result.pages.length} fotos`;
      } catch (e) {
        console.error(e);
        alert('Falha ao gerar book: ' + (e && e.message ? e.message : e));
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('active');
          btn.textContent = btn.id === 'btn-book-float' ? 'book' : 'gerar book';
        }
      }
    };
    bind('btn-book', runPhotoBook);
    bind('btn-book-float', runPhotoBook);
    this.runPhotoBook = runPhotoBook;
    bind('btn-rotate', () => {
      controls.autoRotate = !controls.autoRotate;
      controls.autoRotateSpeed = 0.6;
      document.getElementById('btn-rotate').classList.toggle('active', controls.autoRotate);
    });

    bind('btn-top', () => {
      if (walkthrough.walkMode) {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        walkthrough.exitWalk(btn, walkHud, crosshair, null);
      }
      sceneManager.repositionCamera(0, 8, 0.01, 0, 0, 0);
      const vi = document.getElementById('view-info');
      if (vi) vi.textContent = 'vista: PLANTA (top-down) · ESC 1:50';
    });
    bind('btn-bottom', () => {
      if (walkthrough.walkMode) {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        walkthrough.exitWalk(btn, walkHud, crosshair, null);
      }
      sceneManager.repositionCamera(0, -8, 0.01, 0, 0.3, 0);
      const vi = document.getElementById('view-info');
      if (vi) vi.textContent = 'vista: BAIXO (bottom-up) · ESC 1:50';
    });
    bind('btn-iso', () => {
      if (walkthrough.walkMode) {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        walkthrough.exitWalk(btn, walkHud, crosshair, null);
      }
      sceneManager.repositionCamera(5, 4, 5, 0, 0.6, 0);
      const vi = document.getElementById('view-info');
      if (vi) vi.textContent = 'vista: isométrica · ESC 1:50';
    });
    bind('btn-mezz', () => {
      if (walkthrough.walkMode) {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        walkthrough.exitWalk(btn, walkHud, crosshair, null);
      }
      sceneManager.repositionCamera(0, D.mzFloorH + 1.25, -D.Lt / 2 - D.mzL / 2 + 0.05, 0, D.mzFloorH + 0.15, -D.Lt / 2 - D.mzL / 2 + 0.05);
      const vi = document.getElementById('view-info');
      if (vi) vi.textContent = 'vista: MEZANINO · ESC 1:50';
    });
    bind('btn-enter', () => {
      try {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        const viewInfo = document.getElementById('view-info');
        if (walkthrough.walkMode) {
          walkthrough.exitWalk(btn, walkHud, crosshair, viewInfo);
        } else {
          walkthrough.enterWalk(btn, walkHud, crosshair, viewInfo, () => editor.deselectObject());
        }
      } catch (e) {
        console.error('btn-enter error:', e);
      }
    });
    document.addEventListener('keydown', (e) => {
      const btn = document.getElementById('btn-enter');
      const walkHud = document.getElementById('walk-hud');
      const crosshair = document.getElementById('crosshair');
      const viewInfo = document.getElementById('view-info');
      walkthrough.handleKeyDown(
        e,
        () => walkthrough.enterWalk(btn, walkHud, crosshair, viewInfo, () => editor.deselectObject()),
        () => walkthrough.exitWalk(btn, walkHud, crosshair, viewInfo)
      );
    });
    bind('btn-reset', () => {
      if (walkthrough.walkMode) {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        const viewInfo = document.getElementById('view-info');
        walkthrough.exitWalk(btn, walkHud, crosshair, viewInfo);
      }
      sceneManager.repositionCamera(5, 4, 5, 0, 0.6, 0);
      controls.autoRotate = false;
      const r = document.getElementById('btn-rotate');
      if (r) r.classList.remove('active');
      save.resetLayout((text, cls) => ai && ai.aiLog(text, cls));
      // Recalcular peso após reset
      setTimeout(() => {
        const kinds = this.editableMeshes.filter((m) => m.userData && m.userData.kind).map((m) => m.userData.kind);
        weight.syncFromKinds(kinds);
      }, 100);
    });
    const persistProjectNow = async (reason) => {
      let synced = null;
      try { synced = this.syncProjectFromScene && this.syncProjectFromScene(); } catch (e) { console.warn(e); }
      try { save.saveLayout(); } catch (e) { console.warn(e); }
      try {
        const proj = this.services.project && this.services.project.getProject ? this.services.project.getProject() : null;
        if (proj && typeof proj === 'object') {
          proj.scene_layout = save.serializeLayout();
        }
      } catch (e) { console.warn('scene_layout serialize', e); }

      // 1) Sobrescreve o .json que foi aberto (File System Access API)
      let fileWrite = null;
      try {
        if (this.services.project && typeof this.services.project.saveToOpenFile === 'function') {
          fileWrite = await this.services.project.saveToOpenFile();
        }
      } catch (e) {
        console.warn('saveToOpenFile', e);
        fileWrite = { ok: false, mode: 'none', error: e.message };
      }

      // 2) Lista de projetos (se logado)
      let savedFile = null;
      try {
        const uf = this.services.userFiles;
        if (uf && uf.auth && uf.auth.isAuthenticated()) {
          const n = uf.getCurrentProjectName()
            || this.services.project.getOpenFileName?.()
            || this.services.project.getMeta()?.name
            || 'Projeto';
          savedFile = uf.saveCurrent(n);
        } else {
          try {
            const proj = this.services.project.getProject();
            localStorage.setItem('trailer3d-project-json-v1', JSON.stringify(proj));
          } catch (e2) { console.warn(e2); }
        }
      } catch (e) {
        console.warn('saveCurrent', e);
      }

      const dim = synced || null;
      let msg;
      if (fileWrite && fileWrite.ok && fileWrite.mode === 'overwrite') {
        msg = 'Sobrescrito: ' + (fileWrite.name || 'arquivo')
          + (dim ? (' · ' + dim.L + '×' + dim.P + '×' + dim.H + ' mm rev' + dim.rev) : '');
      } else if (fileWrite && fileWrite.ok && fileWrite.mode === 'download') {
        msg = 'JSON baixado (abra com o seletor moderno para poder sobrescrever no disco)'
          + (dim ? (': ' + dim.L + '×' + dim.P + '×' + dim.H + ' mm') : '');
      } else if (fileWrite && !fileWrite.ok) {
        msg = 'Falha ao gravar arquivo: ' + (fileWrite.error || 'erro')
          + (dim ? (' · em memória: ' + dim.L + '×' + dim.P + '×' + dim.H + ' mm') : '');
      } else {
        msg = dim
          ? ('Salvo em memória: ' + dim.L + '×' + dim.P + '×' + dim.H + ' mm · rev' + dim.rev)
          : 'Salvo';
      }
      if (reason) msg += ' (' + reason + ')';
      if (savedFile) msg += ' · lista: ' + savedFile.name;
      ai && ai.aiLog(msg, fileWrite && !fileWrite.ok ? 'err' : 'sys');
      const vi = document.getElementById('view-info');
      if (vi) vi.textContent = msg;
      return { synced, savedFile, fileWrite };
    };
    this.persistProjectNow = persistProjectNow;

    bind('btn-save', () => { persistProjectNow('Salvar'); });

    // ── Gerenciamento de projeto ──
    const { project, weight, userFiles } = this.services;

    const updateCurrentProjectName = () => {
      const nameEl = document.getElementById('files-current-name');
      if (nameEl) {
        nameEl.textContent = userFiles.getCurrentProjectName() || project.getMeta()?.name || 'Sem nome';
      }
    };

    document.querySelectorAll('.cat-btn').forEach((btn) => {
      btn.onclick = () => {
        btn.classList.toggle('active');
        const active = btn.classList.contains('active');
        const cat = btn.dataset.cat;
        this.editableMeshes.forEach((m) => {
          if (m.userData.category === cat) m.visible = active;
        });
        if (cat === 'paredes') {
          [body.wallsExt, body.backWallGroup, body.frontWallGroup, body.frontMzGroup].forEach((g) => { if (g) g.visible = active; });
        }
        if (cat === 'paredes-int' && this.models.interior.wallsInt) this.models.interior.wallsInt.visible = active;
        if (cat === 'telhado') {
          if (roof.group) roof.group.visible = active;
          if (windowsM.sky) windowsM.sky.visible = active;
          if (windowsM.mzSky) windowsM.mzSky.visible = active;
        }
      };
    });

    const updateEditorPanel = () => {
      const obj = editor.selected;
      if (!obj) return;
      const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
      setVal('pos-x', obj.position.x.toFixed(2));
      setVal('pos-y', obj.position.y.toFixed(2));
      setVal('pos-z', obj.position.z.toFixed(2));
      setVal('scl-x', obj.scale.x.toFixed(2));
      setVal('scl-y', obj.scale.y.toFixed(2));
      setVal('scl-z', obj.scale.z.toFixed(2));
      setVal('rot-x', (obj.rotation.x * 180 / Math.PI).toFixed(0));
      setVal('rot-y', (obj.rotation.y * 180 / Math.PI).toFixed(0));
      setVal('rot-z', (obj.rotation.z * 180 / Math.PI).toFixed(0));

      // Painel mm da caixa (project-box)
      const boxSec = document.getElementById('box-dims-section');
      const dimsEl = document.getElementById('sel-dims');
      const isBox = obj.userData && obj.userData.kind === 'project-box';
      if (boxSec) boxSec.style.display = isBox ? 'block' : 'none';
      if (isBox) {
        const base = obj.userData.baseSizeMm || { L: 1000, P: 500, H: 500 };
        const L = Math.round(base.L * obj.scale.x);
        const H = Math.round(base.H * obj.scale.y);
        const P = Math.round(base.P * obj.scale.z);
        setVal('box-l', L);
        setVal('box-p', P);
        setVal('box-h', H);
        setVal('box-t', obj.userData.thicknessMm || 15);
        if (dimsEl) dimsEl.innerHTML = '<b>Larg ' + L + '</b> × <b>Prof ' + P + '</b> × <b>Alt ' + H + '</b> mm';
      } else if (dimsEl && obj.userData && obj.userData.box_mm) {
        const bm = obj.userData.box_mm;
        dimsEl.innerHTML = 'peça <b>' + (obj.userData.name || '') + '</b> · ' + bm[0] + '×' + bm[1] + '×' + bm[2] + ' mm';
      } else if (dimsEl) {
        dimsEl.textContent = '';
      }

      if (material) material.updateMatUI(obj);
      if (marcenaria) marcenaria.updateMarcenariaButton(obj, (o) => material.materialFamilyOf(o));
    };
    editor.onSelectionChange = updateEditorPanel;
    if (ai) ai.updateEditorPanel = updateEditorPanel;

    const updateUndoMenu = (canUndo, canRedo) => {
      document.querySelectorAll('.gnome-menu-item[data-action="undo"]').forEach((el) => el.classList.toggle('disabled', !canUndo));
      document.querySelectorAll('.gnome-menu-item[data-action="redo"]').forEach((el) => el.classList.toggle('disabled', !canRedo));
    };
    editor.onUndoChange = updateUndoMenu;
    editor.updateUndoState();

    // Gera geometry.parts de caixa aberta: fundo base full + 4 paredes
    const buildOpenBoxProjectParts = (Lmm, Pmm, Hmm, tmm) => {
      const L = Lmm / 1000, P = Pmm / 1000, H = Hmm / 1000, t = tmm / 1000;
      const wallH = Math.max(t, H - t); // paredes sobre o fundo
      const innerL = Math.max(t, L - 2 * t);
      return [
        {
          name: 'Fundo', role: 'base',
          box_mm: [Lmm, tmm, Pmm], box: [L, t, P],
          position: [0, t / 2, 0], rotation: [0, 0, 0],
          cut_mm: { comp: Math.max(Lmm, Pmm), larg: Math.min(Lmm, Pmm), esp: tmm },
        },
        {
          name: 'Lateral 1', role: 'lateral_esquerda',
          box_mm: [tmm, Math.round(wallH * 1000), Pmm], box: [t, wallH, P],
          position: [-(L / 2 - t / 2), t + wallH / 2, 0], rotation: [0, 0, 0],
          cut_mm: { comp: Math.round(wallH * 1000), larg: Pmm, esp: tmm },
        },
        {
          name: 'Lateral 2', role: 'lateral_direita',
          box_mm: [tmm, Math.round(wallH * 1000), Pmm], box: [t, wallH, P],
          position: [+(L / 2 - t / 2), t + wallH / 2, 0], rotation: [0, 0, 0],
          cut_mm: { comp: Math.round(wallH * 1000), larg: Pmm, esp: tmm },
        },
        {
          name: 'Frente', role: 'frente',
          box_mm: [Math.round(innerL * 1000), Math.round(wallH * 1000), tmm], box: [innerL, wallH, t],
          position: [0, t + wallH / 2, -(P / 2 - t / 2)], rotation: [0, 0, 0],
          cut_mm: { comp: Math.round(innerL * 1000), larg: Math.round(wallH * 1000), esp: tmm },
        },
        {
          name: 'Trás', role: 'fundo_parede',
          box_mm: [Math.round(innerL * 1000), Math.round(wallH * 1000), tmm], box: [innerL, wallH, t],
          position: [0, t + wallH / 2, +(P / 2 - t / 2)], rotation: [0, 0, 0],
          cut_mm: { comp: Math.round(innerL * 1000), larg: Math.round(wallH * 1000), esp: tmm },
        },
      ];
    };

    // Redimensionar caixa inteira por mm (Larg/Prof/Alt) → reconstrói peças + export
    const applyBoxDimsBtn = document.getElementById('btn-apply-box-dims');
    if (applyBoxDimsBtn) {
      applyBoxDimsBtn.onclick = () => {
        const obj = editor.selected;
        if (!obj || !obj.userData || obj.userData.kind !== 'project-box') return;
        const base = obj.userData.baseSizeMm || { L: 1200, P: 500, H: 950 };
        const L = Math.max(50, parseFloat(document.getElementById('box-l')?.value) || base.L);
        const P = Math.max(50, parseFloat(document.getElementById('box-p')?.value) || base.P);
        const H = Math.max(50, parseFloat(document.getElementById('box-h')?.value) || base.H);
        const t = Math.max(3, parseFloat(document.getElementById('box-t')?.value) || obj.userData.thicknessMm || 15);
        editor.pushUndo();
        try {
          const proj = this.services.project && this.services.project.getProject();
          if (!proj) return;
          if (!proj.geometry) proj.geometry = { format: 'parts', parts: [] };
          proj.geometry.format = 'parts';
          proj.geometry.parts = (this.services.project.constructor.buildOpenBoxParts
            ? this.services.project.constructor.buildOpenBoxParts(L, P, H, t)
            : buildOpenBoxProjectParts(L, P, H, t));
          if (!proj.geometry.material) {
            proj.geometry.material = { type: 'standard', color: '#c9a86c', roughness: 0.85, thickness_mm: t };
          } else {
            proj.geometry.material.thickness_mm = t;
            proj.geometry.material.label = 'COMPENSADO CRU NU ' + t + ' mm MULTIMARCAS BR';
          }
          if (!proj.dimensions_mm) proj.dimensions_mm = {};
          proj.dimensions_mm.externo = { largura_X: L, profundidade_Z: P, altura_Y: H };
          proj.dimensions_mm.espessura = t;
          proj.dimensions_mm.interno = {
            largura_X: Math.max(0, L - 2 * t),
            profundidade_Z: Math.max(0, P - 2 * t),
            altura_Y: Math.max(0, H - t),
          };
          if (proj.meta) proj.meta.rev = (Number(proj.meta.rev) || 0) + 1;
          this.services.project.loadProject(proj);
          if (this.services.export) {
            const parts = this.services.export.extractPartsFromProject(proj);
            this.services.export.setScenePieces(parts.length ? parts : null);
          }
          buildGeometryFromProject(proj);
          ai && ai.aiLog('Caixa redimensionada: ' + L + '×' + P + '×' + H + ' mm · t=' + t + ' — clique Salvar (baixa JSON atualizado)', 'sys');
          const vi2 = document.getElementById('view-info');
          if (vi2) vi2.textContent = 'ALTERADO ' + L + '×' + P + '×' + H + ' mm — Salvar para gravar JSON';
        } catch (e) {
          console.error('apply box dims', e);
          alert('Erro ao redimensionar: ' + e.message);
        }
      };
    }

    [['mode-move', 'translate'], ['mode-rotate', 'rotate'], ['mode-scale', 'scale']].forEach(([id, mode]) => {
      bind(id, () => {
        editor.transformCtrl.setMode(mode);
        ['mode-move', 'mode-rotate', 'mode-scale'].forEach((bid) => document.getElementById(bid)?.classList.remove('active'));
        document.getElementById(id)?.classList.add('active');
      });
    });
    const bindNum = (id, fn, opts = {}) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (!editor.selected) return;
        editor.pushUndo();
        fn(editor.selected, parseFloat(el.value) || 0);
        if (opts.resolve !== false) editor.resolvePlacement(editor.selected);
        updateEditorPanel();
      });
    };
    bindNum('pos-x', (o, v) => { o.position.x = v; }, { resolve: false });
    bindNum('pos-y', (o, v) => { o.position.y = v; }, { resolve: false });
    bindNum('pos-z', (o, v) => { o.position.z = v; }, { resolve: false });
    bindNum('scl-x', (o, v) => { o.scale.x = Math.max(0.01, v); });
    bindNum('scl-y', (o, v) => { o.scale.y = Math.max(0.01, v); });
    bindNum('scl-z', (o, v) => { o.scale.z = Math.max(0.01, v); });
    bindNum('rot-x', (o, v) => { o.rotation.x = v * Math.PI / 180; }, { resolve: false });
    bindNum('rot-y', (o, v) => { o.rotation.y = v * Math.PI / 180; }, { resolve: false });
    bindNum('rot-z', (o, v) => { o.rotation.z = v * Math.PI / 180; }, { resolve: false });
    document.querySelectorAll('.rot-snap').forEach((btn) => {
      btn.onclick = () => {
        if (!editor.selected) return;
        editor.pushUndo();
        editor.selected.rotation[btn.dataset.axis] = Number(btn.dataset.deg) * Math.PI / 180;
        updateEditorPanel();
      };
    });
    bind('btn-deselect', () => editor.deselectObject());
    bind('btn-delete', () => {
      if (!editor.selected) return;
      editor.pushUndo();
      const obj = editor.selected;
      if (obj.userData && obj.userData.kind) weight.removeItem(obj.userData.kind);
      if (obj.parent) obj.parent.remove(obj);
      const idx = this.editableMeshes.indexOf(obj);
      if (idx >= 0) this.editableMeshes.splice(idx, 1);
      editor.deselectObject();
      try { save.saveLayout(); } catch (e) { console.warn(e); }
    });
    bind('btn-fill', () => {
      if (!editor.selected) return;
      editor.pushUndo();
      const box = new THREE.Box3().setFromObject(editor.selected);
      const width = box.max.x - box.min.x;
      const targetW = Math.max(0.1, D.Li - D.wth * 2);
      if (width > 0.01) editor.selected.scale.x *= targetW / width;
      editor.resolvePlacement(editor.selected);
      updateEditorPanel();
    });
    if (material) {
      material.buildMatPresetsUI('mat-presets');
      const applyMat = () => {
        if (!editor.selected) return;
        const color = document.getElementById('mat-color')?.value || '#d4b483';
        const rough = parseFloat(document.getElementById('mat-roughness')?.value || '0.7');
        const metal = parseFloat(document.getElementById('mat-metalness')?.value || '0.1');
        material.applyMaterialToSelected(editor.selected, color, rough, metal, false, 1, () => editor.pushUndo());
        updateEditorPanel();
      };
      ['mat-color', 'mat-color-hex', 'mat-roughness', 'mat-metalness'].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => {
          if (id === 'mat-color') document.getElementById('mat-color-hex').value = el.value;
          if (id === 'mat-color-hex') document.getElementById('mat-color').value = el.value;
          applyMat();
        });
      });
      document.querySelectorAll('.mat-preset').forEach((p) => {
        p.onclick = () => {
          document.getElementById('mat-color').value = p.dataset.color;
          document.getElementById('mat-color-hex').value = p.dataset.color;
          document.getElementById('mat-roughness').value = p.dataset.rough;
          document.getElementById('mat-metalness').value = p.dataset.metal;
          applyMat();
        };
      });
    }

    this.ensureEnvelopeVisibility(true);

    // ── Indicador de Peso ──
    const updateWeightUI = () => {
      const data = weight.getWeightBreakdown();
      const cat = weight.getWeightCategory(data.total);
      const totalEl = document.getElementById('weight-total');
      const valEl = document.getElementById('weight-value');
      const unitEl = document.getElementById('weight-unit');
      const barEl = document.getElementById('weight-bar');
      const bdEl = document.getElementById('weight-breakdown');
      if (!totalEl || !valEl) return;

      totalEl.className = 'weight-total' + (cat !== 'ok' ? ' ' + cat : '');
      if (cat === 'ok') {
        valEl.textContent = data.total >= 1000 ? (data.total / 1000).toFixed(2) : data.total.toFixed(1);
        unitEl.textContent = data.total >= 1000 ? 't' : 'kg';
      } else if (cat === 'warn') {
        valEl.textContent = data.total.toFixed(1);
        unitEl.textContent = 'kg ⚠';
      } else {
        valEl.textContent = data.total.toFixed(1);
        unitEl.textContent = 'kg ✕';
      }

      const pct = Math.min(100, (data.total / data.pbtLimit) * 100);
      barEl.style.width = pct + '%';
      barEl.className = 'weight-bar' + (cat !== 'ok' ? ' ' + cat : '');

      let html = '';
      html += '<div class="wb-row"><span class="wb-label">Chassi + rodas</span><span class="wb-val">' + (data.breakdown.chassis + data.breakdown.wheels) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Carroceria</span><span class="wb-val">' + (data.breakdown.wallsExt + data.breakdown.roof + data.breakdown.floor + data.breakdown.skirt) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Parede banheiro</span><span class="wb-val">' + (data.breakdown.bathWalls || 0) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Interior</span><span class="wb-val">' + (data.breakdown.mezzanine + data.breakdown.bathFixtures + data.breakdown.kitchen + data.breakdown.stairCabs + data.breakdown.mattress) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Isolamento + fix.</span><span class="wb-val">' + (data.breakdown.insulation + data.breakdown.fasteners) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Instalações</span><span class="wb-val">' + (data.breakdown.plumbing + data.breakdown.electrical) + ' kg</span></div>';
      if (data.paletteKg > 0) {
        html += '<div class="wb-sep"></div>';
        html += '<div class="wb-row"><span class="wb-label">Itens paleta</span><span class="wb-val">+' + data.paletteKg.toFixed(1) + ' kg</span></div>';
      }
      if (data.waterKg > 0) {
        html += '<div class="wb-row"><span class="wb-label">Água (' + data.waterLiters + ' L)</span><span class="wb-val">+' + data.waterKg.toFixed(1) + ' kg</span></div>';
      }
      if (data.gasKg > 0) {
        html += '<div class="wb-row"><span class="wb-label">Gás</span><span class="wb-val">+' + data.gasKg.toFixed(1) + ' kg</span></div>';
      }
      html += '<div class="wb-sep"></div>';
      html += '<div class="wb-row"><span class="wb-label" style="font-weight:600;color:var(--ink)">TOTAL</span><span class="wb-val" style="font-size:12px">' + WeightService.formatWeight(data.total) + '</span></div>';
      bdEl.innerHTML = html;
    };
    weight.onWeightChange(updateWeightUI);
    updateWeightUI();

    if (marcenaria) {
      bind('btn-marcenaria', () => marcenaria.openMarcenaria());
      bind('mc-close', () => document.getElementById('marcenaria-overlay')?.classList.remove('open'));
      const ov = document.getElementById('marcenaria-overlay');
      if (ov) ov.addEventListener('click', (e) => { if (e.target === ov) ov.classList.remove('open'); });
    }

    const chatLog = document.getElementById('chat-log');
    const chatInput = document.getElementById('chat-input');
    const chatSend = document.getElementById('chat-send');
    const aiDot = document.getElementById('ai-dot');
    const feedbackGood = document.getElementById('ai-feedback-good');
    const feedbackBad = document.getElementById('ai-feedback-bad');
    const feedbackStatus = document.getElementById('ai-feedback-status');
    if (ai && chatLog && chatInput && chatSend && aiDot) {
      ai.setUIElements({ chatLog, chatInput, chatSend, aiDot });
      ai.importProjectMemory().then((n) => {
        if (n > 0) ai.aiLog('Memoria do projeto carregada: regras, licoes e casos de validacao.', 'sys');
      });
      ai.importExternalHistory().then((n) => {
        if (n > 0) ai.aiLog('Importados ' + n + ' comando(s) externos para contexto do LLM.', 'sys');
      });
      setInterval(() => { ai.importProjectMemory(); ai.importExternalHistory(); }, 45000);
      const sendChat = () => {
        const text = (chatInput.value || '').trim();
        if (!text) return;
        chatInput.value = '';
        ai.sendToAI(text);
      };
      chatSend.onclick = sendChat;
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChat();
        }
      });
      const sendFeedback = (value) => {
        const note = value === 'good' ? 'resultado aprovado pelo usuario' : 'resultado rejeitado pelo usuario';
        ai.recordFeedback(value, note);
        if (feedbackGood) feedbackGood.classList.toggle('active', value === 'good');
        if (feedbackBad) feedbackBad.classList.toggle('active', value === 'bad');
        if (feedbackStatus) feedbackStatus.textContent = value === 'good' ? 'feedback positivo salvo' : 'feedback negativo salvo';
        ai.aiLog('Feedback registrado: ' + (value === 'good' ? 'positivo' : 'negativo'), 'sys');
      };
      if (feedbackGood) feedbackGood.onclick = () => sendFeedback('good');
      if (feedbackBad) feedbackBad.onclick = () => sendFeedback('bad');
      ai.aiLog('Historico de comandos ativado: tudo que voce pedir para o trailer sera guardado e reutilizado no contexto do LLM.', 'sys');
    }

    window.addEventListener('resize', () => {
      const cam = this.sceneManager.getCamera();
      const ren = this.sceneManager.getRenderer();
      cam.aspect = window.innerWidth / window.innerHeight;
      cam.updateProjectionMatrix();
      ren.setSize(window.innerWidth, window.innerHeight);
    });

    try { palette.setupDragAndDrop(this.sceneManager.getRenderer(), this.sceneManager.getCamera()); } catch (e) { console.warn('setupDragAndDrop not available:', e); }

    const saveDeps = {
      spawnPaletteItem: (kind, opts) => palette.spawnPaletteItem(kind, opts),
      attachProductMeta: (mesh, kind) => palette.attachProductMeta(mesh, kind),
      attachCarpentryPart: (parent, spec, worldPoint, localPoint) => marcenaria.attachCarpentryPart(parent, spec, worldPoint, localPoint),
      applyMaderiteState: (mesh, st) => palette.applyMaderiteState(mesh, st),
      pruneEditor: () => editor.pruneOrphanEditables(),
      aiLog: (text, cls) => ai && ai.aiLog(text, cls),
    };
        save.captureFactoryLayout(() => editor.captureLayout());
    save.loadLayout(saveDeps);
    // Renderiza o que o JSON descreve — SEM conhecer "trailer" nem "caixa":
    //   geometry.parts presente → interpretador genérico de parts.
    //   geometry.parts ausente  → base/fábrica padrão (projeto não-parts).
    const hasProjectParts = (proj) => !!(
      proj && proj.geometry && Array.isArray(proj.geometry.parts) && proj.geometry.parts.length
    );

    // Restaura estado salvo (sem login)
    try {
      const rawProj = localStorage.getItem('trailer3d-project-json-v1');
      if (rawProj) {
        const savedProj = JSON.parse(rawProj);
        if (hasProjectParts(savedProj)) {
          this.services.project.loadProject(savedProj);
          // rebuild/setup happens when initUI continues — queue microtask after the scene helpers exist
          queueMicrotask(() => {
            const built = typeof this.rebuildProjectGeometry === 'function' && this.rebuildProjectGeometry(savedProj);
            if (!built) {
              clearProjectBoxFromScene();
              materializeFactory();
              restoreSceneFromEmpty();
              this.ensureEnvelopeVisibility(true, true);
              if (savedProj.scene_layout && Array.isArray(savedProj.scene_layout.objects)) {
                try {
                  save.resetLayout((text, cls) => ai && ai.aiLog(text, cls), { forceFactory: true });
                  save.applyCapturedFromLayout(savedProj.scene_layout, saveDeps);
                } catch (e) {
                  console.warn('apply scene_layout from local restore', e);
                }
              }
            } else if (this.services.export) {
              const parts = this.services.export.extractPartsFromProject(savedProj);
              this.services.export.setScenePieces(parts.length ? parts : null);
            }
            ai && ai.aiLog('Projeto restaurado do salvamento local (rev' + (savedProj.meta?.rev||'?') + ').', 'sys');
          });
        }
      }
    } catch (e) { console.warn('restore project-json', e); }

    const loadedKinds = this.editableMeshes
      .filter((m) => m.userData && m.userData.kind)
      .map((m) => m.userData.kind);
    weight.syncFromKinds(loadedKinds);

    if (typeof this.ensureEnvelopeVisibility === 'function') this.ensureEnvelopeVisibility(true, true);

    // ── Iniciar com cena vazia (projeto em branco) ──
    const bootTrailerChildren = this.trailer ? this.trailer.children.slice() : [];
    if (this.trailer) {
      while (this.trailer.children.length) this.trailer.remove(this.trailer.children[0]);
    }
    this.editableMeshes.length = 0;
    const sceneRoot = this.sceneManager ? this.sceneManager.getScene() : null;
    if (sceneRoot) {
      const keepMeshes = new Set();
      sceneRoot.traverse((o) => {
        if (o && o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry' && Math.abs(o.position.y) < 0.01) keepMeshes.add(o);
      });
      const toRemove = [];
      sceneRoot.traverse((o) => {
        if (o && o.isMesh && !keepMeshes.has(o)) toRemove.push(o);
      });
      toRemove.forEach((o) => { if (o.parent) o.parent.remove(o); });
    }
    this._collectAllEditable();
    this.editableMeshes.length = 0;
    if (labels && labels.labelsGroup) labels.labelsGroup.visible = false;
    if (labels && labels.cotasGroup) labels.cotasGroup.visible = false;
    showWalls = false;
    showRoof = false;
    showCotas = false;
    showLabels = false;
    if (typeof this.ensureEnvelopeVisibility === 'function') this.ensureEnvelopeVisibility(false, false);

    // ── GNOME Panel Menu Actions ──
    const gnomeMenus = document.querySelectorAll('.gnome-menu');
    gnomeMenus.forEach((menu) => {
      const btn = menu.querySelector('.gnome-menu-btn');
      if (btn) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const wasOpen = menu.classList.contains('open');
          gnomeMenus.forEach((m) => m.classList.remove('open'));
          if (!wasOpen) menu.classList.add('open');
        });
      }
    });
    document.addEventListener('click', () => {
      gnomeMenus.forEach((m) => m.classList.remove('open'));
    });

    const gnomePanel = document.getElementById('gnome-panel');
    let emptyProjectStash = null;

    const stashSceneBeforeEmpty = () => {
      if (emptyProjectStash) return;
      emptyProjectStash = {
        trailerChildren: this.trailer ? this.trailer.children.slice() : [],
        labelsGroup: labels && labels.labelsGroup ? labels.labelsGroup : null,
        cotasGroup: labels && labels.cotasGroup ? labels.cotasGroup : null,
      };
    };

    const restoreSceneFromEmpty = () => {
      if (!emptyProjectStash) return;
      if (this.trailer) {
        emptyProjectStash.trailerChildren.forEach((obj) => {
          if (obj && !obj.parent) this.trailer.add(obj);
        });
      }
      const sceneRoot = this.sceneManager ? this.sceneManager.getScene() : null;
      if (sceneRoot && emptyProjectStash.labelsGroup && !emptyProjectStash.labelsGroup.parent) {
        sceneRoot.add(emptyProjectStash.labelsGroup);
      }
      if (sceneRoot && emptyProjectStash.cotasGroup && !emptyProjectStash.cotasGroup.parent) {
        sceneRoot.add(emptyProjectStash.cotasGroup);
      }
      this._collectAllEditable();
      emptyProjectStash = null;
    };

    /** Re-materializa o trailer de fábrica inteiro (árvore, não só folhas) quando a cena foi esvaziada no boot.
 *  Meshes estruturais fora do factoryLayout são marcados layoutProtected para nunca serem removidos pelo SaveService. */
    /** Remove qualquer project-box/partes que tenham sobrado na cena de outro projeto.
     *  O JSON manda: projeto sem parts não deixa box de projeto na cena. */
    const clearProjectBoxFromScene = () => {
      if (this.trailer) {
        const strays = [];
        this.trailer.traverse((c) => {
          if (c && c.userData && c.userData.kind === 'project-box') strays.push(c);
        });
        strays.forEach((g) => { if (g.parent) g.parent.remove(g); });
        const axes = this.trailer.getObjectByName('project-axes');
        if (axes) this.trailer.remove(axes);
      }
      this._projectBoxGroup = null;
    };

    const materializeFactory = () => {
      if (this.trailer && bootTrailerChildren && bootTrailerChildren.length) {
        const allowed = new Set((this.services.save.factoryLayout || []).map((st) => st && st.mesh).filter(Boolean));
        bootTrailerChildren.forEach((obj) => {
          if (obj && !obj.parent) this.trailer.add(obj);
        });
        if (allowed.size) {
          this.trailer.traverse((c) => {
            if (c && c.isMesh && !allowed.has(c) && !c.userData.layoutProtected) {
              c.userData.layoutProtected = true;
            }
          });
        }
      }
      this._collectEditableMeshes();
    };
    this._materializeFactoryNow = materializeFactory;

    const hardResetUiForNewProject = () => {
      showWalls = false;
      showRoof = false;
      showCotas = false;
      showLabels = false;
      this.ensureEnvelopeVisibility(false, false);
      if (labels.cotasGroup) labels.cotasGroup.visible = false;
      if (labels.labelsGroup) labels.labelsGroup.visible = false;
      document.getElementById('btn-cotas')?.classList.remove('active');
      document.getElementById('btn-labels')?.classList.remove('active');
      document.querySelectorAll('.cat-btn').forEach((el) => el.classList.remove('active'));
      document.querySelectorAll('.gnome-menu-item[data-action^="cat-"]').forEach((el) => el.classList.remove('checked'));
      const miCotas = document.querySelector('.gnome-menu-item[data-action="toggle-cotas"]');
      if (miCotas) miCotas.classList.remove('checked');
      const miLabels = document.querySelector('.gnome-menu-item[data-action="toggle-labels"]');
      if (miLabels) miLabels.classList.remove('checked');

      const cutModal = document.getElementById('cut-export-modal');
      if (cutModal) cutModal.style.display = 'none';
      document.getElementById('marcenaria-overlay')?.classList.remove('open');
      document.getElementById('rpa-fs')?.classList.remove('open');
    };

    const hardClearSceneForNewProject = () => {
      stashSceneBeforeEmpty();
      editor.deselectObject();
      if (this.trailer) {
        while (this.trailer.children.length) this.trailer.remove(this.trailer.children[0]);
      }
      if (labels && labels.labelsGroup && labels.labelsGroup.parent) labels.labelsGroup.parent.remove(labels.labelsGroup);
      if (labels && labels.cotasGroup && labels.cotasGroup.parent) labels.cotasGroup.parent.remove(labels.cotasGroup);
      if (body && typeof body.clearUserOpenings === 'function') body.clearUserOpenings();
      this.editableMeshes.length = 0;
      if (app.services.export) app.services.export.setScenePieces(null);
    };

    const runNewProject = () => {
      if (confirm('Criar novo projeto? As alterações não salvas serão perdidas.')) {
        userFiles.newProject();
        try { project.clearFileHandle && project.clearFileHandle(); } catch (e) {}
        weight.setProjectWeights(project.getWeights());
        this.renderSpecPanel(document.getElementById('specs-list'));
        weight.resetPaletteItems();
        try { localStorage.removeItem(save.SAVE_KEY); } catch (e) {}
        hardClearSceneForNewProject();
        hardResetUiForNewProject();
        updateCurrentProjectName();
        ai && ai.aiLog('Novo projeto vazio criado.', 'sys');
      }
    };
    const buildGeometryFromProject = (proj) => {
      const THREE = window.THREE;
      const geo = proj.geometry;
      if (!geo || !Array.isArray(geo.parts) || geo.parts.length === 0) return false;

      editor.deselectObject();
      if (this.trailer) {
        while (this.trailer.children.length) this.trailer.remove(this.trailer.children[0]);
      }
      this.editableMeshes.length = 0;

      const matDef = geo.material || {};
      const mat = new THREE.MeshStandardMaterial({
        color: matDef.color || '#c9a86c',
        roughness: matDef.roughness ?? 0.85,
      });

      const partsGroup = new THREE.Group();
      partsGroup.name = 'project-parts';
      partsGroup.userData.editable = true;
      partsGroup.userData.kind = 'project-box';
      partsGroup.userData.name = (proj.meta && proj.meta.name) || 'Caixa';
      partsGroup.userData.category = 'projeto';
      partsGroup.userData.collider = true;

      geo.parts.forEach((p) => {
        // Preferir box_mm (mm) → metros; evita ambiguidade
        let b;
        if (Array.isArray(p.box_mm) && p.box_mm.length >= 3) {
          b = p.box_mm.map((v) => (Number(v) || 0) / 1000);
        } else {
          b = p.box || [1, 1, 1];
        }
        const geoMesh = new THREE.BoxGeometry(b[0], b[1], b[2]);
        const mesh = new THREE.Mesh(geoMesh, mat);
        mesh.name = p.name || 'part';
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData.editable = true;
        mesh.userData.kind = 'project-part';
        mesh.userData.pieceName = p.name;
        mesh.userData.name = p.name || 'part';
        mesh.userData.category = 'projeto';
        mesh.userData.collider = true;
        mesh.userData.box_mm = [Math.round(b[0]*1000), Math.round(b[1]*1000), Math.round(b[2]*1000)];

        if (p.position) mesh.position.set(p.position[0], p.position[1], p.position[2]);
        if (p.rotation) mesh.rotation.set(p.rotation[0], p.rotation[1], p.rotation[2]);

        // Arestas para ler proporção L/P/H
        try {
          const edges = new THREE.LineSegments(
            new THREE.EdgesGeometry(geoMesh),
            new THREE.LineBasicMaterial({ color: 0x333333 })
          );
          mesh.add(edges);
        } catch (e) { /* ignore */ }

        partsGroup.add(mesh);
        this.editableMeshes.push(mesh);
      });

      // Bbox base para redimensionar em mm
      const baseBox = new THREE.Box3().setFromObject(partsGroup);
      const baseSize = new THREE.Vector3();
      baseBox.getSize(baseSize);
      partsGroup.userData.baseSizeMm = {
        L: Math.round(baseSize.x * 1000) || 1,
        P: Math.round(baseSize.z * 1000) || 1,
        H: Math.round(baseSize.y * 1000) || 1,
      };
      if (proj.dimensions_mm && proj.dimensions_mm.externo) {
        const ex = proj.dimensions_mm.externo;
        partsGroup.userData.baseSizeMm = {
          L: ex.largura_X || ex.L || partsGroup.userData.baseSizeMm.L,
          P: ex.profundidade_Z || ex.P || partsGroup.userData.baseSizeMm.P,
          H: ex.altura_Y || ex.H || partsGroup.userData.baseSizeMm.H,
        };
      }
      partsGroup.userData.thicknessMm = (proj.dimensions_mm && proj.dimensions_mm.espessura)
        || (geo.material && geo.material.thickness_mm) || 15;

      this.editableMeshes.push(partsGroup);
      this.trailer.add(partsGroup);
      if (typeof this.ensureEnvelopeVisibility === 'function') this.ensureEnvelopeVisibility(true, true);
      this._collectAllEditable();
      // Seleciona a caixa inteira para o usuário redimensionar
      try { editor.selectObject(partsGroup); } catch (e) { /* ignore */ }
      this._projectBoxGroup = partsGroup;

      // Enquadra câmera em vista 3/4 FRONTAL canônica:
      // X = largura (esquerda-direita), Z = profundidade (para longe), Y = altura (cima)
      try {
        const box3 = new THREE.Box3().setFromObject(partsGroup);
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box3.getSize(size);
        box3.getCenter(center);
        const mm = (v) => Math.round(v * 1000);
        const Lmm = mm(size.x), Pmm = mm(size.z), Hmm = mm(size.y);

        // Eixos de referência no centro do chão
        const oldAx = this.trailer.getObjectByName('project-axes');
        if (oldAx) this.trailer.remove(oldAx);
        const axes = new THREE.AxesHelper(Math.max(size.x, size.y, size.z) * 0.6);
        axes.name = 'project-axes';
        axes.position.set(center.x, box3.min.y + 0.001, center.z);
        this.trailer.add(axes);

        // Câmera: olha de FRENte-direita-cima → profundidade no eixo Z visível como “para trás”
        const dist = Math.max(size.x, size.y, size.z, 0.4) * 2.4;
        if (this.sceneManager && this.sceneManager.repositionCamera) {
          this.sceneManager.repositionCamera(
            center.x + dist * 0.55,
            center.y + dist * 0.4,
            center.z + dist * 1.05,
            center.x,
            center.y + size.y * 0.35,
            center.z
          );
        }
        const vi = document.getElementById('view-info');
        if (vi) {
          vi.textContent = 'LARG ' + Lmm + ' × PROF ' + Pmm + ' × ALT ' + Hmm + ' mm · rev ' + (proj.meta?.rev || '?') + ' · eixos RGB=XYZ';
        }
        console.log('[buildGeometryFromProject] LARG(X)=', Lmm, 'PROF(Z)=', Pmm, 'ALT(Y)=', Hmm, 'rev', proj.meta?.rev);
        if (proj.dimensions_mm && proj.dimensions_mm.externo) {
          console.log('[buildGeometryFromProject] pedido externo', proj.dimensions_mm.externo);
        }
      } catch (e) {
        console.warn('[buildGeometryFromProject] frame camera', e);
      }
      return true;
    };
    // Expõe para save/load e redimensionamento
    this.rebuildProjectGeometry = buildGeometryFromProject;
    this.syncProjectFromScene = () => {
      const box = (this.editableMeshes || []).find((m) => m && m.userData && m.userData.kind === 'project-box')
        || this._projectBoxGroup;
      if (!box || !this.services.project) return null;
      return this.services.project.syncFromBoxGroup(box);
    };

    /** Aplica um objeto de projeto já parseado (menu Abrir ou auto-reload do disco). */
    const applyLoadedProject = async (proj, { source = 'import', quiet = false } = {}) => {
      if (!proj) return false;
      try { project.loadProject(proj); } catch (e) { return false; }
      try { await this.reloadCatalog(); } catch (e) { console.warn('reload catalog on apply', e); }
      if (typeof this._renderPaletteButtons === 'function') {
        try { this._renderPaletteButtons(); } catch (e) { /* ignore */ }
      }
      if (app.services.export) {
        const fromFile = app.services.export.extractPartsFromProject
          ? app.services.export.extractPartsFromProject(proj)
          : [];
        app.services.export.setScenePieces(fromFile.length ? fromFile : null);
      }
      const built = buildGeometryFromProject(proj);
      if (!built) {
        clearProjectBoxFromScene();
        materializeFactory();
        restoreSceneFromEmpty();
        this.ensureEnvelopeVisibility(true, true);
        if (proj.scene_layout && Array.isArray(proj.scene_layout.objects)) {
          try {
            // limpa layout salvo no browser (senão posições antigas ganham)
            try { localStorage.removeItem(save.SAVE_KEY); } catch (e) { /* ignore */ }
            save.resetLayout((text, cls) => ai && ai.aiLog(text, cls), { forceFactory: true });
            save.applyCapturedFromLayout(proj.scene_layout, saveDeps);
            // 2ª passada: garante p/r do JSON (esp. ecoflow/bluetti)
            (proj.scene_layout.objects || []).forEach((st) => {
              if (!st || !st.name || !st.p) return;
              const m = this.editableMeshes.find((x) => x && x.userData && (
                x.userData.name === st.name || (st.kind && x.userData.kind === st.kind && st.kind === 'ecoflow-delta2')
              ));
              if (!m) return;
              m.userData.fixedLayout = true;
              m.position.set(Number(st.p[0]) || 0, Number(st.p[1]) || 0, Number(st.p[2]) || 0);
              if (st.r) m.rotation.set(Number(st.r[0]) || 0, Number(st.r[1]) || 0, Number(st.r[2]) || 0);
              if (st.s) m.scale.set(Number(st.s[0]) || 1, Number(st.s[1]) || 1, Number(st.s[2]) || 1);
              if (st.name) m.userData.name = st.name;
            });
          } catch (e) {
            console.warn('apply scene_layout from project json', e);
          }
        }
      }
      if (this.models.body && this.models.body.wallGroup) {
        const fy = this.models.body.FLOOR_Y || 0.51;
        this.models.body.wallGroup.position.y = fy;
        this.models.body.FLOOR_Y = fy;
      }
      const openSrc = this.editableMeshes.filter((m) => {
        if (!m || !m.userData) return false;
        const k = m.userData.kind || '';
        return k === 'porta' || k.indexOf('janela') === 0 || m.userData.funcKind === 'janela';
      });
      if (openSrc.length && this.models.body && typeof this.models.body.setLayoutOpenings === 'function') {
        this.models.body.setLayoutOpenings(openSrc);
      }
      // re-acende spots se modo noturno estiver ativo
      if (this.sceneManager && typeof this.sceneManager.refreshNightFixtures === 'function') {
        this.sceneManager.setEditableMeshes(this.editableMeshes);
        this.sceneManager.refreshNightFixtures();
      }
      const doorCfg = proj.structure && proj.structure.door;
      const doorMesh = openSrc.find((m) => m.userData && m.userData.kind === 'porta');
      if (this.services.walkthrough) {
        const wall = doorMesh ? this.models.body.nearestWall(doorMesh) : null;
        this.services.walkthrough.setDoorGeo(wall, doorMesh ? doorMesh.position : null);
        this.services.walkthrough.setDoorOpen(doorCfg && doorCfg.open === 'out' ? 'out' : 'in');
      }
      weight.setProjectWeights(project.getWeights());
      this.renderSpecPanel(document.getElementById('specs-list'));
      if (typeof updateCurrentProjectName === 'function') updateCurrentProjectName();
      // sincroniza localStorage com o JSON aplicado (evita boot com layout antigo)
      try {
        localStorage.setItem('trailer3d-project-json-v1', JSON.stringify(proj));
        if (save && typeof save.serializeLayout === 'function') {
          localStorage.setItem(save.SAVE_KEY || 'trailer3d-layout-v10', JSON.stringify(save.serializeLayout()));
        }
      } catch (e) { /* ignore quota */ }
      if (this.services.connections) this.services.connections.invalidate();
      if (!quiet) {
        const dim = proj.dimensions_mm && proj.dimensions_mm.externo;
        const dimTxt = dim
          ? ` ${dim.largura_X||dim.L||'?'}×${dim.profundidade_Z||dim.P||'?'}×${dim.altura_Y||dim.H||'?'} mm`
          : '';
        const tag = source === 'disk-watch' ? 'Atualizado do disco' : 'Projeto importado';
        ai && ai.aiLog(tag + ': ' + (proj.meta?.name || '') + ' rev' + (proj.meta?.rev||'') + dimTxt, 'sys');
      }
      return true;
    };

    /** Carrega project.json do disco (serve estático) e aplica. */
    const applyProjectFromDisk = async (opts = {}) => {
      try {
        const resp = await fetch('project.json', { cache: 'no-store' });
        if (!resp.ok) throw new Error(resp.status + ' ' + resp.statusText);
        const proj = await resp.json();
        return await applyLoadedProject(proj, opts);
      } catch (e) {
        console.warn('[disk-project]', e.message || e);
        return false;
      }
    };

    this.applyLoadedProject = applyLoadedProject;
    this.applyProjectFromDisk = applyProjectFromDisk;

    const runOpenProject = () => {
      project.openProjectFile().then(async (proj) => {
        if (!proj) return;
        await applyLoadedProject(proj, { source: 'import' });
      }).catch((err) => alert('Erro: ' + err.message));
    };

    // ── Auto-refresh: project.json + palette-catalog no disco ──
    // JS continua com full reload via index.html /dev-version.version
    // Aqui só soft-apply quando muda o JSON do projeto ou o catálogo.
    {
      let lastProjectHash = null;
      let lastCatalogHash = null;
      let lastUtilHash = null;
      let diskBusy = false;
      const DISK_POLL_MS = 2000;
      const pollDiskJson = async () => {
        if (diskBusy) return;
        try {
          const r = await fetch('/dev-version', { cache: 'no-store' });
          if (!r.ok) return;
          const d = await r.json();
          const projH = d.project || null;
          const catH = d.catalog || null;
          const utilH = d.utilities || null;
          if (lastProjectHash == null && lastCatalogHash == null && lastUtilHash == null) {
            lastProjectHash = projH;
            lastCatalogHash = catH;
            lastUtilHash = utilH;
            return;
          }
          const projChanged = projH && projH !== lastProjectHash;
          const catChanged = catH && catH !== lastCatalogHash;
          const utilChanged = utilH && utilH !== lastUtilHash;
          if (!projChanged && !catChanged && !utilChanged) return;
          diskBusy = true;
          lastProjectHash = projH || lastProjectHash;
          lastCatalogHash = catH || lastCatalogHash;
          lastUtilHash = utilH || lastUtilHash;
          try {
            if (utilChanged && this.services.connections) {
              await this.services.connections.loadNetworkSpec('data/utilities-network.json');
            }
            if (projChanged || catChanged) {
              await applyProjectFromDisk({ source: 'disk-watch', quiet: false });
            } else if (utilChanged) {
              this.services.connections && this.services.connections.invalidate();
              ai && ai.aiLog('Rede utilidades atualizada (utilities-network.json).', 'sys');
            }
          } finally {
            diskBusy = false;
          }
        } catch (e) {
          diskBusy = false;
        }
      };
      // Boot: carrega project.json do disco (fonte de verdade em dev)
      queueMicrotask(() => {
        applyProjectFromDisk({ source: 'disk-boot', quiet: false }).then((ok) => {
          if (ok) ai && ai.aiLog('Projeto carregado de project.json (disco).', 'sys');
        });
        setInterval(pollDiskJson, DISK_POLL_MS);
        pollDiskJson();
      });
    }
    const btnNewProject = document.getElementById('btn-new-project');
    if (btnNewProject && btnNewProject.dataset.boundDirectAction !== '1') {
      btnNewProject.dataset.boundDirectAction = '1';
      btnNewProject.addEventListener('click', (e) => {
        e.preventDefault();
        runNewProject();
      });
    }
    const btnOpenProject = document.getElementById('btn-open-project');
    if (btnOpenProject && btnOpenProject.dataset.boundDirectAction !== '1') {
      btnOpenProject.dataset.boundDirectAction = '1';
      btnOpenProject.addEventListener('click', (e) => {
        e.preventDefault();
        runOpenProject();
      });
    }

    function bindMenuActionFallback(action, runner) {
      document.querySelectorAll('.gnome-menu-item[data-action="' + action + '"]').forEach((el) => {
        if (el.dataset.boundDirectAction === '1') return;
        el.dataset.boundDirectAction = '1';
        el.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          runner();
        });
      });
    }
    bindMenuActionFallback('new-project', runNewProject);
    bindMenuActionFallback('open-project', runOpenProject);

    if (gnomePanel) {
      gnomePanel.addEventListener('click', (e) => {
        if (e.defaultPrevented) return;
        const item = e.target.closest('.gnome-menu-item:not(.disabled)');
        if (!item) return;
        const action = item.dataset.action;
        gnomeMenus.forEach((m) => m.classList.remove('open'));

        switch (action) {
          case 'new-project':
            runNewProject();
            break;
          case 'save':
            persistProjectNow('menu Salvar');
            break;
          case 'save-as':
            document.getElementById('files-section')?.scrollIntoView({ behavior: 'smooth' });
            break;
          case 'rename-project':
            const renameInput = document.getElementById('file-name-input');
            if (renameInput) {
              renameInput.value = userFiles.getCurrentProjectName() || '';
              renameInput.focus();
            }
            break;
          case 'undo':
            editor.undoEdit();
            this._afterUndoRedo();
            break;
          case 'redo':
            editor.redoEdit();
            this._afterUndoRedo();
            break;
          case 'export-corte':
            document.getElementById('cut-export-modal').style.display = '';
            break;
          case 'download-project':
            try {
              const synced = this.syncProjectFromScene && this.syncProjectFromScene();
              if (synced) ai && ai.aiLog('Medidas sincronizadas: ' + synced.L + '×' + synced.P + '×' + synced.H + ' mm · rev' + synced.rev, 'sys');
            } catch (e) { console.warn(e); }
            project.downloadProject();
            ai && ai.aiLog('Projeto baixado como arquivo .json.', 'sys');
            break;
          case 'open-project':
            runOpenProject();
            break;
          case 'reset':
            save.resetLayout();
            setTimeout(() => {
              const kinds = this.editableMeshes.filter((m) => m.userData && m.userData.kind).map((m) => m.userData.kind);
              weight.syncFromKinds(kinds);
            }, 100);
            break;
          case 'view-planta':
            sceneManager.repositionCamera(0, 8, 0.01, 0, 0, 0);
            break;
          case 'view-baixo':
            sceneManager.repositionCamera(0, -8, 0.01, 0, 0.3, 0);
            break;
          case 'view-isometrica':
            sceneManager.repositionCamera(5, 4, 5, 0, 0.6, 0);
            break;
          case 'view-entrar':
            document.getElementById('btn-enter')?.click();
            break;
          case 'view-mezzanino':
            document.getElementById('btn-mezz')?.click();
            break;
          case 'view-planta-2d': {
            const pv = this.services.planView2D;
            if (pv) {
              pv.activate('horizontal');
              document.getElementById('plan2d-active-hint').style.display = 'flex';
              const vi = document.getElementById('view-info');
              if (vi) vi.textContent = 'vista: PLANTA 2D (horizontal) · Scroll zoom · Arraste mover';
            }
            break;
          }
          case 'view-elevacao-2d': {
            const pv = this.services.planView2D;
            if (pv) {
              pv.activate('vertical');
              document.getElementById('plan2d-active-hint').style.display = 'flex';
              const vi = document.getElementById('view-info');
              if (vi) vi.textContent = 'vista: ELEVAÇÃO 2D (vertical) · Scroll zoom · Arraste mover';
            }
            break;
          }
          case 'toggle-walls':
            showWalls = !showWalls;
            if (body.wallsExt) body.wallsExt.visible = showWalls;
            if (body.backWallGroup) body.backWallGroup.visible = showWalls;
            if (body.frontWallGroup) body.frontWallGroup.visible = showWalls;
            if (body.frontMzGroup) body.frontMzGroup.visible = showWalls;
            item.classList.toggle('checked', showWalls);
            break;
          case 'toggle-roof':
            showRoof = !showRoof;
            if (roof.group) roof.group.visible = showRoof;
            if (windowsM.sky) windowsM.sky.visible = showRoof;
            if (windowsM.mzSky) windowsM.mzSky.visible = showRoof;
            item.classList.toggle('checked', showRoof);
            break;
          case 'toggle-cotas':
            showCotas = !showCotas;
            if (labels.cotasGroup) labels.cotasGroup.visible = showCotas;
            item.classList.toggle('checked', showCotas);
            break;
          case 'toggle-labels':
            showLabels = !showLabels;
            if (labels.labelsGroup) labels.labelsGroup.visible = showLabels;
            item.classList.toggle('checked', showLabels);
            break;
          case 'cat-telhado':
          case 'cat-paredes':
          case 'cat-paredes-int':
          case 'cat-acessorios':
          case 'cat-encanamento':
          case 'cat-eletrica':
            const cat = action.replace('cat-', '').replace('-', '_');
            item.classList.toggle('checked');
            const active = item.classList.contains('checked');
            this.editableMeshes.forEach((m) => {
              if (m.userData.category === cat) m.visible = active;
            });
            if (cat === 'paredes') {
              [body.wallsExt, body.backWallGroup, body.frontWallGroup, body.frontMzGroup].forEach((g) => { if (g) g.visible = active; });
            }
            if (cat === 'paredes_int' && this.models.interior.wallsInt) this.models.interior.wallsInt.visible = active;
            if (cat === 'telhado') {
              if (roof.group) roof.group.visible = active;
              if (windowsM.sky) windowsM.sky.visible = active;
              if (windowsM.mzSky) windowsM.mzSky.visible = active;
            }
            // tubulações / cabos do auto-connect
            if (this.services.connections) {
              if (cat === 'encanamento' || cat === 'eletrica') {
                this.services.connections.setLayerVisible(cat, active);
              }
            }
            const catBtn = document.querySelector(`.cat-btn[data-cat="${cat}"]`);
            if (catBtn) catBtn.classList.toggle('active', active);
            break;
          case 'toggle-win':
            const winId = item.dataset.win;
            if (winId) this._toggleWindow(winId, item);
            break;
        }
      });
    }

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.ui-win-close');
      if (btn) {
        const winId = btn.dataset.close;
        if (winId) this._toggleWindow(winId);
      }
    });

    this._initAuthUI();
    this._initFilesUI();
    this._initRPA();
    this._initPaletteInteractions();
    this._initContextMenu();
    this._initEditorShortcuts();
  }

  _afterUndoRedo() {
    const edtr = this.services.editor;
    if (!edtr) return;
    edtr.updateUndoState();
    if (typeof edtr.onSelectionChange === 'function') edtr.onSelectionChange(edtr.selected || null);
    const kinds = this.editableMeshes.filter((m) => m.userData && m.userData.kind).map((m) => m.userData.kind);
    try { this.services.weight && this.services.weight.syncFromKinds(kinds); } catch (e) { console.warn(e); }
  }

  _flashHint(msg) {
    const vi = document.getElementById('view-info');
    if (!vi) return;
    const prev = vi.textContent;
    vi.style.transition = 'background .2s';
    vi.style.background = 'rgba(229,165,0,0.95)';
    vi.textContent = msg;
    clearTimeout(this._flashT);
    this._flashT = setTimeout(() => { vi.textContent = prev; vi.style.background = ''; }, 2400);
  }

  _exitPlanView2D() {
    const pv = this.services.planView2D;
    if (!pv || !pv.active) return;
    pv.deactivate();
    document.getElementById('plan2d-active-hint').style.display = 'none';
    const vi = document.getElementById('view-info');
    if (vi) vi.textContent = 'vista: 3D restaurada · ESC 1:50';
  }

  _isPlanView2DActive() {
    const pv = this.services.planView2D;
    return pv && pv.active;
  }

  _focusEntryDoor() {
    const sm = this.sceneManager;
    const door = this.entryDoor || (this.editableMeshes || []).find((m) => m.userData && m.userData.kind === 'porta');
    if (!sm) return;
    if (!door) {
      sm.repositionCamera(5, 4, 5, 0, 0.6, 0);
      this._flashHint('Nenhuma porta no projeto');
      return;
    }
    door.updateWorldMatrix(true, false);
    const wp = new THREE.Vector3();
    door.getWorldPosition(wp);
    const halfL = (D.Li || 1.6) / 2;
    const halfT = (D.Lt || 2.5) / 2;
    let dirX = 0, dirZ = 0;
    if (Math.abs(Math.abs(wp.z) - halfT) < 0.35) dirZ = wp.z > 0 ? 1 : -1;
    else if (Math.abs(Math.abs(wp.x) - halfL) < 0.35) dirX = wp.x > 0 ? 1 : -1;
    else dirZ = 1;
    const doorH = D.DOOR_H || 1.6;
    const dw = D.DOOR_W || 0.62;
    const off = dw * 0.5 + 0.7;
    sm.repositionCamera(wp.x + dirX * off, doorH * 0.42 + 0.05, wp.z + dirZ * off, wp.x, doorH * 0.5, wp.z);
    const vi = document.getElementById('view-info');
    if (vi) vi.textContent = 'vista: porta de entrada · ESC 1:50';
  }

  _initEditorShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (this._rpaFsActive) return;
      const edtr = this.services.editor;
      const W = this.services.walkthrough;

      // ── Atalhos 2D (F2/F3/Escape) funcionam sempre ──
      if (e.key === 'F2') {
        e.preventDefault();
        const pv = this.services.planView2D;
        if (pv) {
          if (pv.active) { this._exitPlanView2D(); }
          else {
            pv.activate('horizontal');
            document.getElementById('plan2d-active-hint').style.display = 'flex';
            const vi = document.getElementById('view-info');
            if (vi) vi.textContent = 'vista: PLANTA 2D (horizontal)';
          }
        }
        return;
      }
      if (e.key === 'F3') {
        e.preventDefault();
        const pv = this.services.planView2D;
        if (pv) {
          if (pv.active) { this._exitPlanView2D(); }
          else {
            pv.activate('vertical');
            document.getElementById('plan2d-active-hint').style.display = 'flex';
            const vi = document.getElementById('view-info');
            if (vi) vi.textContent = 'vista: ELEVAÇÃO 2D (vertical)';
          }
        }
        return;
      }
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        if (typeof this.toggleNightMode === 'function') this.toggleNightMode();
        return;
      }
      if (e.key === 'b' || e.key === 'B') {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        e.preventDefault();
        if (typeof this.runPhotoBook === 'function') this.runPhotoBook();
        return;
      }

      if (W && W.walkMode) return;

      const k = e.key.toLowerCase();

      // ── Em modo 2D: atalhos de ferramentas ──
      if (this._isPlanView2DActive()) {
        const pv = this.services.planView2D;
        if (k === 'escape') { e.preventDefault(); this._exitPlanView2D(); return; }
        if (k === 'v') { pv.setTool('select'); pv.render(); return; }
        if (k === 'w') { pv.setTool('wall'); pv.render(); return; }
        if (k === 'j') { pv.setTool('window'); pv.render(); return; }
        if (k === 'd') { pv.setTool('door'); pv.render(); return; }
        if (k === 'x') { pv.setTool('resize'); pv.render(); return; }
        if (k === 'a' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); pv.selectAll(); return; }
        if (k === 'delete' || k === 'backspace') { e.preventDefault(); pv.deleteSelected(); return; }
        if ((e.ctrlKey || e.metaKey) && k === 'g') {
          e.preventDefault();
          if (e.shiftKey) pv.ungroupSelected();
          else pv.groupSelected();
          return;
        }
        if (pv.mode === 'vertical') {
          if (k === '1') { pv.setViewSide('front'); return; }
          if (k === '2') { pv.setViewSide('back'); return; }
          if (k === '3') { pv.setViewSide('left'); return; }
          if (k === '4') { pv.setViewSide('right'); return; }
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        if (k === 's') { e.preventDefault(); if (this.persistProjectNow) this.persistProjectNow('teclado Ctrl+S'); return; }
        if (k === 'z' && edtr) {
          e.preventDefault();
          if (e.shiftKey) edtr.redoEdit(); else edtr.undoEdit();
          this._afterUndoRedo();
          return;
        }
        if (k === 'y' && edtr) {
          e.preventDefault();
          edtr.redoEdit();
          this._afterUndoRedo();
          return;
        }
        return;
      }
      if (!edtr) return;

      if (k === 'g') { document.getElementById('mode-move')?.click(); return; }
      if (k === 'r') { document.getElementById('mode-rotate')?.click(); return; }
      if (k === 's') { document.getElementById('mode-scale')?.click(); return; }
      if (k === 'f') {
        e.preventDefault();
        if (!edtr.selected) { this._flashHint('Selecione um objeto antes de preencher o espaço'); return; }
        document.getElementById('btn-fill')?.click();
        return;
      }
      if (k === 'p') { e.preventDefault(); this._focusEntryDoor(); return; }
      if (k === 'delete' || k === 'backspace') {
        e.preventDefault();
        if (!edtr.selected) { this._flashHint('Nada selecionado para excluir'); return; }
        document.getElementById('btn-delete')?.click();
        return;
      }
      if (k === 'escape') {
        const cm = document.getElementById('ctx-menu');
        if (cm && cm.style.display === 'block') { cm.style.display = 'none'; return; }
        if (edtr.selected) { e.preventDefault(); edtr.deselectObject(); }
        return;
      }
    });
  }

  _initContextMenu() {
    const menu = document.getElementById('ctx-menu');
    if (!menu) return;
    const hide = () => { menu.style.display = 'none'; menu.innerHTML = ''; menu._ctxOpen = false; };

    const buildItem = (label, icon, fn, accel) => {
      const el = document.createElement('div');
      el.className = 'gnome-menu-item';
      el.innerHTML = '<span class="icon">' + (icon || '') + '</span>' + label
        + (accel ? '<span class="shortcut">' + accel + '</span>' : '');
      el.addEventListener('click', (e) => { e.stopPropagation(); hide(); fn(); });
      return el;
    };

    document.addEventListener('pointerdown', (e) => {
      if (menu._ctxOpen && !menu.contains(e.target)) hide();
    });

    const canvas = this.sceneManager ? this.sceneManager.getRenderer().domElement : null;
    if (!canvas) return;

    canvas.addEventListener('contextmenu', (e) => {
      if (this.services.walkthrough && this.services.walkthrough.walkMode) return;
      if (this._rpaFsActive) return;
      e.preventDefault();
      const edtr = this.services.editor;
      if (!edtr) return;

      const obj = edtr.pickAtPx(e.clientX, e.clientY);
      const items = [];
      const modeClick = (id) => () => { document.getElementById(id)?.click(); };

      if (obj) {
        edtr.selectObject(obj);
        items.push(buildItem('Mover', '✥', modeClick('mode-move'), 'G'));
        items.push(buildItem('Girar', '⟳', modeClick('mode-rotate'), 'R'));
        items.push(buildItem('Escalar', '⤢', modeClick('mode-scale'), 'S'));
        items.push('sep');
        items.push(buildItem('Preencher espaço', '⬚', () => document.getElementById('btn-fill')?.click(), 'F'));
        items.push(buildItem('Excluir', '🗑', () => document.getElementById('btn-delete')?.click(), 'Del'));
        items.push('sep');
        items.push(buildItem('Focar porta de entrada', '🚪', () => this._focusEntryDoor(), 'P'));
      } else {
        items.push(buildItem('Focar porta de entrada', '🚪', () => this._focusEntryDoor(), 'P'));
        items.push(buildItem('Focar cena', '◇', () => this.sceneManager && this.sceneManager.repositionCamera(5, 4, 5, 0, 0.6, 0)));
      }

      menu.innerHTML = '';
      items.forEach((it) => {
        if (it === 'sep') {
          const s = document.createElement('div');
          s.className = 'gnome-menu-sep';
          menu.appendChild(s);
          return;
        }
        menu.appendChild(it);
      });
      menu.style.display = 'block';
      menu._ctxOpen = true;
      const r = menu.getBoundingClientRect();
      menu.style.left = Math.min(e.clientX, window.innerWidth - r.width - 8) + 'px';
      menu.style.top = Math.min(e.clientY, window.innerHeight - r.height - 8) + 'px';
    });
  }

  _toggleWindow(winId, menuItem) {
    const el = document.getElementById(winId);
    if (!el) return;
    const closed = el.classList.toggle('closed');
    if (menuItem) {
      menuItem.classList.toggle('checked', !closed);
    } else {
      const mi = document.querySelector(`.gnome-menu-item[data-win="${winId}"]`);
      if (mi) mi.classList.toggle('checked', !closed);
    }
  }

  _initPaletteInteractions() {
    let popover = null;
    const createPopover = () => {
      if (popover) return popover;
      popover = document.createElement('div');
      popover.className = 'pi-popover';
      document.body.appendChild(popover);
      return popover;
    };
    const showPopover = (btn, data) => {
      const pop = createPopover();
      pop.innerHTML = `
        <div class="pop-title">${data.name}</div>
        <div class="pop-row"><span class="pop-key">Peso</span><span class="pop-val">${data.w} kg</span></div>
        <div class="pop-row"><span class="pop-key">Material</span><span class="pop-val">${data.mat}</span></div>
        ${data.v ? `<div class="pop-row"><span class="pop-key">Voltagem</span><span class="pop-val">${data.v}</span></div>` : ''}
        <div class="pop-row"><span class="pop-key">Dimensões</span><span class="pop-val">${data.dims}</span></div>
        <div class="pop-desc">${data.desc}</div>`;
      const r = btn.getBoundingClientRect();
      let left = r.right + 8;
      let top = r.top;
      if (left + 250 > window.innerWidth) left = r.left - 248;
      if (top + 200 > window.innerHeight) top = window.innerHeight - 210;
      if (top < 36) top = 36;
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      pop.classList.add('show');
    };
    const hidePopover = () => { if (popover) popover.classList.remove('show'); };

    document.querySelectorAll('#palette .pi[data-item]').forEach((btn) => {
      const key = btn.dataset.item;
      const data = this._catalogMap[key];
      const label = btn.childNodes[btn.childNodes.length - 1];
      if (label && data) {
        const span = document.createElement('span');
        span.className = 'pi-label';
        span.textContent = data.name;
        btn.replaceChild(span, label);
      }
      btn.addEventListener('mouseenter', () => { if (data) showPopover(btn, data); });
      btn.addEventListener('mouseleave', hidePopover);
      btn.addEventListener('click', (e) => {
        const rect = btn.getBoundingClientRect();
        const ripple = document.createElement('span');
        ripple.className = 'ripple';
        const size = Math.max(rect.width, rect.height);
        ripple.style.width = ripple.style.height = size + 'px';
        ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
        btn.appendChild(ripple);
        setTimeout(() => ripple.remove(), 500);
      });
    });
  }

  _initRPA() {
    const RPA_URL = 'https://www.rpa4all.com';
    const panel = document.getElementById('rpa-panel');
    const panelClose = document.getElementById('rpa-panel-close');
    const panelTab = document.getElementById('rpa-collapsed-tab');
    const fs = document.getElementById('rpa-fullscreen');
    const frame = document.getElementById('rpa-fs-frame');
    const cta = document.getElementById('rpa-cta');
    const cta2 = document.getElementById('rpa-cta-2');
    const btnClose = document.getElementById('rpa-fs-close');
    const btnOpen = document.getElementById('rpa-fs-open');

    const open = () => {
      if (!frame.src) frame.src = RPA_URL;
      fs.classList.add('open');
      // Pausa o render loop enquanto está em fullscreen
      this._rpaFsActive = true;
    };
    const close = () => {
      fs.classList.remove('open');
      this._rpaFsActive = false;
    };

    if (cta) cta.onclick = open;
    if (cta2) cta2.onclick = open;
    if (btnClose) btnClose.onclick = close;
    if (btnOpen) btnOpen.onclick = () => window.open(RPA_URL, '_blank', 'noopener');

    const hidePanel = () => {
      if (panel) panel.style.display = 'none';
      if (panelTab) panelTab.style.display = 'flex';
    };
    const showPanel = () => {
      if (panel) panel.style.display = '';
      if (panelTab) panelTab.style.display = 'none';
    };
    if (panelClose) panelClose.onclick = hidePanel;
    if (panelTab) panelTab.onclick = showPanel;

    // Esc fecha fullscreen
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && fs.classList.contains('open')) close();
    });
  }

  _initAuthUI() {
    const auth = this.services.auth;
    const content = document.getElementById('auth-content');
    const filesSection = document.getElementById('files-section');
    const gnomeAccountBtn = document.getElementById('gnome-account-btn');
    const gnomeAccountDropdown = document.getElementById('gnome-account-dropdown');
    const gnomeAccountIcon = document.getElementById('gnome-account-icon');
    const gnomeAccountText = document.getElementById('gnome-account-text');
    const gnomeContaMenu = gnomeAccountBtn ? gnomeAccountBtn.closest('.gnome-menu') : null;
    if (!content) return;

    const render = () => {
      const user = auth.getUser();
      if (user) {
        content.innerHTML = `
          <div class="auth-user">
            <div class="auth-avatar">${safeUrl(user.avatar) ? `<img src="${escHtml(safeUrl(user.avatar))}" alt="">` : escHtml((user.name || user.email || "?").slice(0, 1).toUpperCase())}</div>
            <div class="auth-info">
              <div class="auth-name">${escHtml(user.name || user.email)}</div>
              <div class="auth-email">${escHtml(user.email)}</div>
            </div>
            <div class="auth-actions">
              <button id="btn-logout" class="btn-mini">Sair</button>
            </div>
          </div>
        `;
        filesSection.classList.remove('locked');
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.onclick = () => auth.logout();

        const initials = (user.name || user.email || '?').slice(0, 1).toUpperCase();
        gnomeAccountIcon.innerHTML = safeUrl(user.avatar) ? `<img src="${escHtml(safeUrl(user.avatar))}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover">` : escHtml(initials);
        gnomeAccountText.textContent = user.name || user.email;

        gnomeAccountDropdown.innerHTML = `
          <div class="gnome-menu-item no-icon" data-action="account-info">
            <span class="icon" style="font-size:16px">${safeUrl(user.avatar) ? `<img src="${escHtml(safeUrl(user.avatar))}" alt="" style="width:20px;height:20px;border-radius:50%;object-fit:cover">` : escHtml(initials)}</span>
            <div style="line-height:1.3">
              <div style="font-weight:600;font-size:11.5px">${escHtml(user.name || user.email)}</div>
              <div style="font-size:10px;color:var(--ink-3)">${escHtml(user.email)}</div>
            </div>
          </div>
          <div class="gnome-menu-sep"></div>
          <div class="gnome-menu-item" data-action="gnome-logout"><span class="icon">⏻</span>Sair</div>
        `;
        gnomeAccountDropdown.querySelector('[data-action="gnome-logout"]').onclick = () => {
          gnomeContaMenu && gnomeContaMenu.classList.remove('open');
          auth.logout();
        };
      } else {
        content.innerHTML = `
          <div class="auth-login">
            <input id="auth-name" type="text" placeholder="Seu nome">
            <input id="auth-email" type="email" placeholder="seu@email.com">
            <div class="auth-error" id="auth-error"></div>
            <div class="row-buttons">
              <button id="btn-login-local" class="btn-primary">Entrar</button>
            </div>
            <div class="auth-divider">ou</div>
            <div class="google-btn" id="google-btn"></div>
          </div>
        `;
        filesSection.classList.add('locked');
        const btnLogin = document.getElementById('btn-login-local');
        const nameInput = document.getElementById('auth-name');
        const emailInput = document.getElementById('auth-email');
        const errEl = document.getElementById('auth-error');
        if (btnLogin) btnLogin.onclick = () => {
          const email = emailInput.value.trim();
          const name = nameInput.value.trim();
          if (!email) { errEl.textContent = 'Informe o e-mail'; return; }
          try {
            auth.loginLocal({ email, name });
            errEl.textContent = '';
          } catch (e) { errEl.textContent = e.message; }
        };
        if (emailInput) emailInput.onkeydown = (e) => { if (e.key === 'Enter') btnLogin.click(); };
        if (nameInput) nameInput.onkeydown = (e) => { if (e.key === 'Enter') btnLogin.click(); };
        const googleContainer = document.getElementById('google-btn');
        if (googleContainer) {
          const tryRender = () => {
            if (auth._googleReady) auth.renderGoogleButton(googleContainer);
            else setTimeout(tryRender, 200);
          };
          tryRender();
        }

        gnomeAccountIcon.innerHTML = '?';
        gnomeAccountText.textContent = 'Entrar';

        gnomeAccountDropdown.innerHTML = `
          <div class="gnome-menu-item no-icon" data-action="account-info">
            <span class="icon">?</span>
            <div style="line-height:1.3">
              <div style="font-weight:600;font-size:11.5px">Não autenticado</div>
              <div style="font-size:10px;color:var(--ink-3)">Faça login para salvar projetos</div>
            </div>
          </div>
          <div class="gnome-menu-sep"></div>
          <div class="gnome-menu-item" data-action="gnome-login-email"><span class="icon">✉</span>Entrar com e-mail</div>
          <div class="gnome-menu-item" data-action="gnome-login-google"><span class="icon">G</span>Entrar com Google</div>
        `;
        gnomeAccountDropdown.querySelector('[data-action="gnome-login-email"]').onclick = () => {
          gnomeContaMenu && gnomeContaMenu.classList.remove('open');
          const emailInput = document.getElementById('auth-email');
          if (emailInput) emailInput.focus();
        };
        gnomeAccountDropdown.querySelector('[data-action="gnome-login-google"]').onclick = () => {
          gnomeContaMenu && gnomeContaMenu.classList.remove('open');
          auth.loginWithGoogle().catch((e) => console.warn('Google login:', e.message));
        };
      }
    };

    auth.on('login', render);
    auth.on('logout', render);
    render();
  }

  renderSpecPanel(rootEl) {
    const { project } = this.services;
    if (project) project.renderSpecPanel(rootEl);
  }

  _initFilesUI() {
    const userFiles = this.services.userFiles;
    const auth = this.services.auth;
    const project = this.services.project;
    const weight = this.services.weight;
    const list = document.getElementById('files-list');
    const input = document.getElementById('file-name-input');
    const btnSave = document.getElementById('btn-save-file');
    const btnRename = document.getElementById('btn-rename-file');
    const nameEl = document.getElementById('files-current-name');
    if (!list || !input || !btnSave) return;

    const updateCurrentName = () => {
      if (nameEl) {
        nameEl.textContent = userFiles.getCurrentProjectName() || project.getMeta()?.name || 'Sem nome';
      }
      // Atualiza input com nome atual
      input.value = userFiles.getCurrentProjectName() || '';
    };

    const render = () => {
      updateCurrentName();
      if (!auth.isAuthenticated()) { list.innerHTML = ''; return; }
      const files = userFiles.list();
      if (!files.length) {
        list.innerHTML = '<div class="file-empty">Nenhum projeto salvo</div>';
        return;
      }
      list.innerHTML = files.map((f) => `
        <div class="file-item" data-id="${f.id}">
          <div class="file-name" title="${f.name}">${f.name}</div>
          <div class="file-date">${new Date(f.updatedAt).toLocaleDateString('pt-BR')}</div>
          <div class="file-actions">
            <button data-act="load" title="Carregar">↥</button>
            <button data-act="rename" title="Renomear">✎</button>
            <button data-act="del" title="Excluir">✕</button>
          </div>
        </div>
      `).join('');
      list.querySelectorAll('.file-item').forEach((el) => {
        const id = el.dataset.id;
        el.querySelector('[data-act="load"]').onclick = (e) => {
          e.stopPropagation();
          try {
            userFiles.load(id);
            // Reconstrói geometry.parts na cena (senão reabre no tamanho antigo)
            const loadedProj = project.getProject();
            if (loadedProj && loadedProj.geometry && Array.isArray(loadedProj.geometry.parts) && loadedProj.geometry.parts.length) {
              if (typeof this.rebuildProjectGeometry === 'function') {
                this.rebuildProjectGeometry(loadedProj);
              }
              if (this.services.export) {
                const parts = this.services.export.extractPartsFromProject(loadedProj);
                this.services.export.setScenePieces(parts.length ? parts : null);
              }
            }
            weight.setProjectWeights(project.getWeights());
            this.renderSpecPanel(document.getElementById('specs-list'));
            updateCurrentName();
            if (typeof this.ensureEnvelopeVisibility === 'function') this.ensureEnvelopeVisibility(true);
          } catch (err) { alert(err.message); }
        };
        el.querySelector('[data-act="rename"]').onclick = (e) => {
          e.stopPropagation();
          const f = userFiles.get(id);
          const newName = prompt('Novo nome:', f.name);
          if (newName) try { userFiles.rename(id, newName); } catch (err) { alert(err.message); }
        };
        el.querySelector('[data-act="del"]').onclick = (e) => {
          e.stopPropagation();
          if (confirm('Excluir "' + userFiles.get(id).name + '"?')) userFiles.remove(id);
        };
      });
    };

    btnSave.onclick = () => {
      if (!auth.isAuthenticated()) { alert('Faça login primeiro'); return; }
      const name = input.value.trim() || userFiles.getCurrentProjectName() || project.getMeta()?.name || 'Projeto sem nome';
      try {
        try { this.syncProjectFromScene && this.syncProjectFromScene(); } catch (e) {}
        const saved = userFiles.saveCurrent(name);
        try { this.services.save.saveLayout(); } catch (e) {}
        input.value = '';
        render();
        setTimeout(() => {
          const item = list.querySelector(`[data-id="${saved.id}"]`);
          if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            item.classList.add('flash');
            setTimeout(() => item.classList.remove('flash'), 1200);
          }
          const hud = document.getElementById('hud');
          if (hud) hud.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 50);
        const dim = project.getProject()?.dimensions_mm?.externo;
        if (dim) {
          ai && ai.aiLog('Salvo "' + saved.name + '": ' + dim.largura_X + '×' + dim.profundidade_Z + '×' + dim.altura_Y + ' mm', 'sys');
        }
      } catch (e) { alert(e.message); }
    };

    if (btnRename) {
      btnRename.onclick = () => {
        if (!auth.isAuthenticated()) { alert('Faça login primeiro'); return; }
        const currentId = userFiles.getCurrentFileId();
        if (!currentId) { alert('Abra um projeto salvo primeiro'); return; }
        const newName = input.value.trim();
        if (!newName) { alert('Digite um nome'); return; }
        try {
          userFiles.rename(currentId, newName);
          render();
        } catch (e) { alert(e.message); }
      };
    }

    userFiles.on('change', render);
    auth.on('login', render);
    auth.on('logout', render);
    render();
  }

  startLoop() {
    const sceneManager = this.sceneManager;
    const renderer = sceneManager.getRenderer();
    const scene = sceneManager.getScene();
    const camera = sceneManager.getCamera();
    const controls = sceneManager.getControls();
    const { walkthrough } = this.services;

    let lastTime = performance.now();
    const animate = () => {
      requestAnimationFrame(animate);
      if (this._rpaFsActive) return; // Pausa render quando fullscreen RPA está ativo
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (walkthrough.walkMode) {
        walkthrough.tickWalk(dt);
      } else {
        controls.update();
      }
      walkthrough.tickDoor(dt);
      if (this.services.connections) this.services.connections.update(dt);
      renderer.render(scene, camera);
    };
    animate();
  }
}

const app = new TrailerApp();
window.__app = app;
window.trailerApp = app;
app.init();
