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
import AIService from './services/AIService.js?v=20260831-2050';
import ExportService from './services/ExportService.js';
import PaletteService from './services/PaletteService.js';
import MarcenariaService from './services/MarcenariaService.js';
import AuthService from './services/AuthService.js';
import UserFilesService from './services/UserFilesService.js';
import WeightService from './services/WeightService.js';

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
    const chassisDeckT = 0.04;
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
      // Window cuts
      function winCut(z, y, w, h) {
        return { z0: z - w / 2, z1: z + w / 2, y0: y - h / 2, y1: y + h / 2 };
      }
      const winLCuts = [winCut(0.20, 1.20, 0.50, 0.50), winCut(0.95, 1.20, 0.50, 0.50)];
      const winRCuts = [
        { z0: C2.doorZ0, z1: C2.doorZ1, y0: D.DOOR_SILL, y1: D.DOOR_SILL + D.DOOR_H },
        winCut(-0.35, 1.20, 0.50, 0.50),
        winCut(0.85, 1.20, 0.50, 0.50),
      ];

      this.models.body = body;
      const bodyResult = body.build(null, winLCuts, winRCuts, chassisG);
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
        wth: D.wth, BODY_W: D.BODY_W, interior
      });

      this.services.save = new SaveService({
        editableMeshes: this.editableMeshes
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
      this.services.walkthrough.setMZFloorY(interiorResult.colTopY + 0.04);
      [interiorResult.counter, interiorResult.counterTop, interiorResult.freshWater, interiorResult.kidBed,
        interiorResult.potti, interiorResult.stairCabs, interiorResult.guard].forEach((obj) => {
        this.services.walkthrough.addWalkSolid(obj, 'cabin');
      });
      [interiorResult.casalBed].forEach((obj) => this.services.walkthrough.addWalkSolid(obj, 'mezz'));
      const ed = this.services.editor;
      this.services.ai = new AIService({
        editableMeshes: this.editableMeshes,
        trailer: this.trailer,
        setWorldPosFn: (obj, x, y, z) => { obj.position.set(x, y, z); },
        resolvePlacementFn: (obj) => ed.resolvePlacement(obj),
        pushUndoFn: () => ed.pushUndo(),
        selectObjectFn: (obj) => ed.selectObject(obj),
        deselectObjectFn: () => ed.deselectObject(),
        updateEditorPanelFn: () => {}
      });

      this.services.export = new ExportService();

      const matFn = (color, opts) => mat(color, opts, THREE);

      this.services.palette = new PaletteService({
        interior, FLOOR_Y: C2.FLOOR_Y,
        editableMeshes: this.editableMeshes,
        pushUndoFn: () => ed.pushUndo(),
        resolvePlacementFn: (obj) => ed.resolvePlacement(obj),
        selectObjectFn: (obj) => ed.selectObject(obj),
        addEditableFn: (mesh) => { if (!this.editableMeshes.includes(mesh)) this.editableMeshes.push(mesh); },
        uniqueNameFn: (base) => {
          let n = base, i = 2;
          while (this.editableMeshes.some(m => m.userData && m.userData.name === n)) n = base + ' ' + i++;
          return n;
        },
        roofTopFn: (z) => C2.roofTop(z),
        makeHingedDoorFn: (opts) => interior.makeHingedDoor(opts),
        makeRvWindowFn: (w, h) => windows.makeRvWindow(w, h),
        makeDinetteGroupFn: () => interior.makeDinetteGroup ? interior.makeDinetteGroup() : null,
        M, matFn,
        weightService: this.services.weight
      });

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

      this.services.auth = new AuthService();
      this.services.userFiles = new UserFilesService({
        auth: this.services.auth,
        saveService: this.services.save,
        loadDeps: {},
      });
      this.services.weight = new WeightService();

      this.initUI();
      this.startLoop();
      console.log('Trailer 3D Studio inicializado com sucesso!');
    } catch (err) {
      console.error('TRAILER 3D ERROR:', err);
      const wrap = document.getElementById('canvas-wrap');
      if (wrap) wrap.innerHTML +=
        '<div style="color:#a00;padding:20px;font-family:monospace;white-space:pre-wrap">ERRO:\n' +
        (err && err.message ? err.message : String(err)) + '</div>';
    }
  }

  _collectEditableMeshes() {
    const meshes = [];
    const interior = this.models.interior;

    const NAMES = {
      bath: ['Vaso sanitário', 'Tampa vaso', 'Ducha higiênica', 'Mangueira ducha', 'Espelho banheiro', 'Cuba banheiro'],
      kitchen: ['Balcão cozinha', 'Tampo balcão', 'Geladeira 37L', 'Alça geladeira', 'Pia inox', 'Torneira', 'Cabeça torneira', 'Armário superior', 'Galão água 20L', 'Fogareiro 1', 'Fogareiro 2'],
      stairCabs: ['Armário-degrau 1', 'Armário-degrau 2', 'Armário-degrau 3', 'Armário-degrau 4'],
      mezz: ['Coluna mez. esq. frente', 'Coluna mez. dir. frente', 'Coluna mez. esq. trás', 'Coluna mez. dir. trás', 'Viga mez. frente', 'Viga mez. trás', 'Piso mezanino', 'Cama casal', 'Travesseiro esq.', 'Travesseiro dir.', 'Guarda-corpo'],
      wallsInt: ['Parede banheiro fundo', 'Parede banheiro frente', 'Parede banheiro lateral'],
    };
    if (interior) {
      const groups = [
        { g: interior.bath, names: NAMES.bath },
        { g: interior.kitchen, names: NAMES.kitchen },
        { g: interior.stairCabs, names: NAMES.stairCabs },
        { g: interior.mezz, names: NAMES.mezz },
        { g: interior.wallsInt, names: NAMES.wallsInt },
      ];
      groups.forEach(({ g, names }) => {
        if (!g) return;
        let idx = 0;
        g.traverse((c) => {
          if (c.isMesh) {
            c.userData.editable = true;
            c.userData.name = names[idx] || 'Objeto Interior';
            idx++;
            meshes.push(c);
          }
        });
      });
    }
    // Also collect kidBed (dinette)
    if (interior && interior.kidBed) {
      interior.kidBed.traverse((c) => {
        if (c.isMesh) { c.userData.editable = true; c.userData.name = 'Dinete'; meshes.push(c); }
      });
    }

    this.editableMeshes = meshes;
    console.log('Editable meshes:', meshes.length);
  }

  initUI() {
    const { editor, walkthrough, palette, save, ai, material, marcenaria } = this.services;
    const THREE = window.THREE;
    const scene = this.sceneManager.getScene();
    const camera = this.sceneManager.getCamera();
    const controls = this.sceneManager.getControls();
    const body = this.models.body;
    const roof = this.models.roof;
    const labels = this.models.labels;
    const windowsM = this.models.windows;

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
      camera.position.set(0, 8, 0.01);
      controls.target.set(0, 0, 0);
      const vi = document.getElementById('view-info');
      if (vi) vi.textContent = 'vista: PLANTA (top-down) · ESC 1:50';
    });
    bind('btn-iso', () => {
      if (walkthrough.walkMode) {
        const btn = document.getElementById('btn-enter');
        const walkHud = document.getElementById('walk-hud');
        const crosshair = document.getElementById('crosshair');
        walkthrough.exitWalk(btn, walkHud, crosshair, null);
      }
      camera.position.set(5, 4, 5);
      controls.target.set(0, 0.6, 0);
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
      camera.position.set(0, D.mzFloorH + 1.25, -D.Lt / 2 - D.mzL / 2 + 0.05);
      controls.target.set(0, D.mzFloorH + 0.15, -D.Lt / 2 - D.mzL / 2 + 0.05);
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
      camera.position.set(5, 4, 5);
      controls.target.set(0, 0.6, 0);
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
    bind('btn-save', () => save.saveLayout());

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
      if (material) material.updateMatUI(obj);
      if (marcenaria) marcenaria.updateMarcenariaButton(obj, (o) => material.materialFamilyOf(o));
    };
    editor.onSelectionChange = updateEditorPanel;
    if (ai) ai.updateEditorPanel = updateEditorPanel;

    [['mode-move', 'translate'], ['mode-rotate', 'rotate'], ['mode-scale', 'scale']].forEach(([id, mode]) => {
      bind(id, () => {
        editor.transformCtrl.setMode(mode);
        ['mode-move', 'mode-rotate', 'mode-scale'].forEach((bid) => document.getElementById(bid)?.classList.remove('active'));
        document.getElementById(id)?.classList.add('active');
      });
    });
    const bindNum = (id, fn) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (!editor.selected) return;
        editor.pushUndo();
        fn(editor.selected, parseFloat(el.value) || 0);
        editor.resolvePlacement(editor.selected);
        updateEditorPanel();
      });
    };
    bindNum('pos-x', (o, v) => { o.position.x = v; });
    bindNum('pos-y', (o, v) => { o.position.y = v; });
    bindNum('pos-z', (o, v) => { o.position.z = v; });
    bindNum('scl-x', (o, v) => { o.scale.x = Math.max(0.01, v); });
    bindNum('scl-y', (o, v) => { o.scale.y = Math.max(0.01, v); });
    bindNum('scl-z', (o, v) => { o.scale.z = Math.max(0.01, v); });
    bindNum('rot-x', (o, v) => { o.rotation.x = v * Math.PI / 180; });
    bindNum('rot-y', (o, v) => { o.rotation.y = v * Math.PI / 180; });
    bindNum('rot-z', (o, v) => { o.rotation.z = v * Math.PI / 180; });
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
    const weight = this.services.weight;
    const updateWeightUI = () => {
      const data = weight.getWeightBreakdown();
      const cat = WeightService.getWeightCategory(data.total);
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

      const pct = Math.min(100, (data.total / 750) * 100);
      barEl.style.width = pct + '%';
      barEl.className = 'weight-bar' + (cat !== 'ok' ? ' ' + cat : '');

      let html = '';
      html += '<div class="wb-row"><span class="wb-label">Chassi + rodas</span><span class="wb-val">' + (data.breakdown.chassis + data.breakdown.wheels) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Carroceria</span><span class="wb-val">' + (data.breakdown.wallsExt + data.breakdown.roof + data.breakdown.floor + data.breakdown.skirt) + ' kg</span></div>';
      html += '<div class="wb-row"><span class="wb-label">Interior</span><span class="wb-val">' + (data.breakdown.mezzanine + data.breakdown.bathCube + data.breakdown.kitchen + data.breakdown.stairCabs + data.breakdown.mattress) + ' kg</span></div>';
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
        spawnPaletteItem: (kind) => palette.spawnPaletteItem(kind),
        attachProductMeta: (mesh, kind) => palette.attachProductMeta(mesh, kind),
        attachCarpentryPart: (parent, spec, worldPoint, localPoint) => marcenaria.attachCarpentryPart(parent, spec, worldPoint, localPoint),
        aiLog: (text, cls) => ai && ai.aiLog(text, cls),
      };
      save.captureFactoryLayout(() => editor.captureLayout());
      save.loadLayout(saveDeps);

      // Sincronizar peso com itens carregados
      const loadedKinds = this.editableMeshes
        .filter((m) => m.userData && m.userData.kind)
        .map((m) => m.userData.kind);
      weight.syncFromKinds(loadedKinds);

      if (typeof this.ensureEnvelopeVisibility === 'function') this.ensureEnvelopeVisibility(true, true);

    this._initAuthUI();
    this._initFilesUI();
    this._initRPA();
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
    const accountMenu = document.getElementById('account-menu');
    const accountBtn = document.getElementById('account-btn');
    const accountDropdown = document.getElementById('account-dropdown');
    const accountAvatar = document.getElementById('account-avatar');
    const accountBtnText = document.getElementById('account-btn-text');
    const accHeader = document.getElementById('acc-header');
    const accItems = document.getElementById('acc-items');
    if (!content) return;

    const render = () => {
      const user = auth.getUser();
      if (user) {
        // Form de login no HUD (ainda visível para contexto)
        content.innerHTML = `
          <div class="auth-user">
            <div class="auth-avatar">${user.avatar ? `<img src="${user.avatar}" alt="">` : (user.name || user.email).slice(0, 1).toUpperCase()}</div>
            <div class="auth-info">
              <div class="auth-name">${user.name || user.email}</div>
              <div class="auth-email">${user.email}</div>
            </div>
            <div class="auth-actions">
              <button id="btn-logout" class="btn-mini">Sair</button>
            </div>
          </div>
        `;
        filesSection.classList.remove('locked');
        const btnLogout = document.getElementById('btn-logout');
        if (btnLogout) btnLogout.onclick = () => auth.logout();

        // Header account menu
        accountMenu.classList.remove('logged-out');
        const initials = (user.name || user.email || '?').slice(0, 1).toUpperCase();
        accountAvatar.innerHTML = user.avatar ? `<img src="${user.avatar}" alt="">` : initials;
        accountBtnText.textContent = user.name || user.email;
        accountBtnText.className = 'acc-name';
        accHeader.innerHTML = `
          <div class="acc-avatar-lg">${user.avatar ? `<img src="${user.avatar}" alt="">` : initials}</div>
          <div class="acc-name-lg">${user.name || user.email}</div>
          <div class="acc-email-lg">${user.email}</div>
          <div class="acc-provider">${user.provider === 'google' ? 'Google' : 'Local'}</div>
        `;
        accItems.innerHTML = `
          <div class="acc-item" data-act="files">
            <span class="icon">📁</span>
            <span>Meus projetos</span>
          </div>
          <div class="acc-divider"></div>
          <div class="acc-item danger" data-act="logout">
            <span class="icon">⏻</span>
            <span>Sair</span>
          </div>
        `;
        accItems.querySelector('[data-act="files"]').onclick = () => {
          accountDropdown.classList.remove('show');
          const hud = document.getElementById('hud');
          if (hud) hud.scrollIntoView({ behavior: 'smooth', block: 'end' });
        };
        accItems.querySelector('[data-act="logout"]').onclick = () => {
          accountDropdown.classList.remove('show');
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

        // Header account menu (logged out)
        accountMenu.classList.add('logged-out');
        accountAvatar.innerHTML = '?';
        accountBtnText.textContent = 'Entrar';
        accountBtnText.className = 'acc-login-text';
        accHeader.innerHTML = `
          <div class="acc-avatar-lg">?</div>
          <div class="acc-name-lg">Não autenticado</div>
          <div class="acc-email-lg">Faça login para salvar projetos</div>
        `;
        accItems.innerHTML = `
          <div class="acc-item" data-act="login-email">
            <span class="icon">✉</span>
            <span>Entrar com e-mail</span>
          </div>
          <div class="acc-divider"></div>
          <div class="acc-item" data-act="login-google">
            <span class="icon">G</span>
            <span>Entrar com Google</span>
          </div>
        `;
        accItems.querySelector('[data-act="login-email"]').onclick = () => {
          accountDropdown.classList.remove('show');
          const emailInput = document.getElementById('auth-email');
          if (emailInput) emailInput.focus();
        };
        accItems.querySelector('[data-act="login-google"]').onclick = () => {
          accountDropdown.classList.remove('show');
          auth.loginWithGoogle().catch((e) => console.warn('Google login:', e.message));
        };
      }
    };

    // Toggle dropdown
    if (accountBtn) {
      accountBtn.onclick = (e) => {
        e.stopPropagation();
        accountDropdown.classList.toggle('show');
      };
      // Fecha ao clicar fora
      document.addEventListener('click', (e) => {
        if (!accountMenu.contains(e.target)) accountDropdown.classList.remove('show');
      });
      // Fecha com Esc
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') accountDropdown.classList.remove('show');
      });
    }

    auth.on('login', render);
    auth.on('logout', render);
    render();
  }

  _initFilesUI() {
    const userFiles = this.services.userFiles;
    const auth = this.services.auth;
    const list = document.getElementById('files-list');
    const input = document.getElementById('file-name-input');
    const btnSave = document.getElementById('btn-save-file');
    if (!list || !input || !btnSave) return;

    const render = () => {
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
      const name = input.value.trim() || 'Projeto sem nome';
      try {
        const saved = userFiles.saveCurrent(name);
        input.value = '';
        // Feedback visual + scroll para o item salvo
        render();
        setTimeout(() => {
          const item = list.querySelector(`[data-id="${saved.id}"]`);
          if (item) {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            item.classList.add('flash');
            setTimeout(() => item.classList.remove('flash'), 1200);
          }
          // Garante que a seção de arquivos está visível
          const hud = document.getElementById('hud');
          if (hud) hud.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 50);
      } catch (e) { alert(e.message); }
    };

    userFiles.on('change', render);
    auth.on('login', render);
    auth.on('logout', render);
    render();
  }

  startLoop() {
    const renderer = this.sceneManager.getRenderer();
    const scene = this.sceneManager.getScene();
    const camera = this.sceneManager.getCamera();
    const controls = this.sceneManager.getControls();
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
      renderer.render(scene, camera);
    };
    animate();
  }
}

const app = new TrailerApp();
window.trailerApp = app;
app.init();
