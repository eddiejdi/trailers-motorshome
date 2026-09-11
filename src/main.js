
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
import MarcenariaService from './services/MarcenariaService.js';
import AuthService from './services/AuthService.js';
import UserFilesService from './services/UserFilesService.js';
import WeightService from './services/WeightService.js';
import ProjectService from './services/ProjectService.js';

const PALLET_DATA = {
  'comoda':         { name:'Cômoda 3 gav.',           cat:'Móveis & Eletro', w:12,  mat:'Compensado',     v:null,    dims:'600×400×500mm', desc:'Cômoda com 3 gavetas de compensado naval, acabamento em laca.' },
  'armario':        { name:'Armário 40×60',           cat:'Móveis & Eletro', w:14,  mat:'Compensado',     v:null,    dims:'400×600×350mm', desc:'Armário de parede com duas portas, prateleira interna.' },
  'banco':          { name:'Banco-baú',               cat:'Móveis & Eletro', w:8,   mat:'Compensado',     v:null,    dims:'1200×450×450mm', desc:'Banco com tampa articulada, espaço interno para armazenamento.' },
  'mesa':           { name:'Mesa Lagun',               cat:'Móveis & Eletro', w:5,   mat:'Laminado',       v:null,    dims:'Ø700×720mm', desc:'Mesa de coluna Lagun, base pivotante, tampa redonda.' },
  'dinette':        { name:'Banco + mesa',             cat:'Móveis & Eletro', w:18,  mat:'Compensado',     v:null,    dims:'1200×900×720mm', desc:'Conjunto dinette: banco com encosto + mesa articulada.' },
  'recpro-38':      { name:'RecPro 38" booth',        cat:'Móveis & Eletro', w:22,  mat:'MDF/Compensado', v:null,    dims:'965×1016×457mm', desc:'Booth de canto RecPro 38", com prateleiras e nichos.' },
  'recpro-44':      { name:'RecPro 44" combo',        cat:'Móveis & Eletro', w:28,  mat:'MDF/Compensado', v:null,    dims:'1118×1016×457mm', desc:'Combo RecPro 44": nichos laterais + painel central.' },
  'camper-40':      { name:'Camper Comfort 40"',      cat:'Móveis & Eletro', w:25,  mat:'MDF',            v:null,    dims:'1016×965×457mm', desc:'Módulo Camper Comfort 40", gavetas e armário integrado.' },
  'pe-dinete-12v':  { name:'Pé dinete 12V',           cat:'Móveis & Eletro', w:3.5, mat:'Compósito',      v:'12V',   dims:'400×400×720mm', desc:'Pé de mesa com motor 12V para elevação automática.' },
  'snap-base':      { name:'SNAP table base',          cat:'Móveis & Eletro', w:6,   mat:'Aço/Alumínio',   v:null,    dims:'600×600×720mm', desc:'Base articulada SNAP para mesa, fixação no piso.' },
  'geladeira':      { name:'Geladeira 12V',            cat:'Móveis & Eletro', w:15,  mat:'Plástico/Aço',   v:'12V DC', dims:'480×500×530mm', desc:'Geladeira compressor 12V DC, 40L, portão reversível.' },
  'porta':          { name:'Porta 62×160',             cat:'Portas & Janelas', w:18,  mat:'Compensado',     v:null,    dims:'620×1600×40mm', desc:'Porta externa de entrada, compensado naval, dobradiça inox.' },
  'porta-int':      { name:'Porta int. 55×170',        cat:'Portas & Janelas', w:12,  mat:'Compensado',     v:null,    dims:'550×1700×35mm', desc:'Porta interna divisória, compensado 15mm, dobradiça escondida.' },
  'janela':         { name:'Janela 50×50',             cat:'Portas & Janelas', w:3.5, mat:'Alumínio/Vidro', v:null,    dims:'500×500mm', desc:'Janela basculante em alumínio com vidro temperado.' },
  'janela-50x35':   { name:'Janela SANJO 50×35',      cat:'Portas & Janelas', w:2.8, mat:'Alumínio/Vidro', v:null,    dims:'500×350mm', desc:'Janela SANJO basculante, perfil de alumínio extrudado.' },
  'janela-70x40':   { name:'Janela SANJO 70×40',      cat:'Portas & Janelas', w:3.6, mat:'Alumínio/Vidro', v:null,    dims:'700×400mm', desc:'Janela SANJO, vidro duplo, vedação em EPDM.' },
  'janela-90x45':   { name:'Janela SANJO 90×45',      cat:'Portas & Janelas', w:4.5, mat:'Alumínio/Vidro', v:null,    dims:'900×450mm', desc:'Janela SANJO ampla, basculante com travas laterais.' },
  'janela-120x50':  { name:'Janela SANJO 120×50',     cat:'Portas & Janelas', w:5.8, mat:'Alumínio/Vidro', v:null,    dims:'1200×500mm', desc:'Janela SANJO panorâmica, perfil duplo, vidro 4mm.' },
  'janela-pp-350':  { name:'Polyplastic 35×50',        cat:'Portas & Janelas', w:1.2, mat:'Plástico',       v:null,    dims:'350×500mm', desc:'Janela Polyplastic flexível, acrílico policarbonato.' },
  'janela-fixa-120':{ name:'Fixa panorâmica 120×50',  cat:'Portas & Janelas', w:4.2, mat:'Alumínio/Vidro', v:null,    dims:'1200×500mm', desc:'Janela fixa panorâmica, vidro temperado 5mm.' },
  'janela-kg-750':  { name:'Janela KG fumê 75×50',    cat:'Portas & Janelas', w:4.8, mat:'Alumínio/Vidro', v:null,    dims:'750×500mm', desc:'Janela KG Acryl fumê, perfil de alumínio, vedação dupla.' },
  'janela-kg-leitosa':{ name:'Janela KG leitosa 60×45',cat:'Portas & Janelas', w:3.2, mat:'Alumínio/Vidro', v:null,    dims:'600×450mm', desc:'Janela KG Acryl leitosa, translúcida, perfil extrudado.' },
  'exaustor':       { name:'Exaustor teto',            cat:'Portas & Janelas', w:0.8, mat:'Plástico',       v:'12V DC', dims:'Ø280mm', desc:'Exaustor de teto 12V, fluxo 300m³/h, baixo ruído.' },
  'exaustor-anti':  { name:'Exaustor Anti-Chuva',     cat:'Portas & Janelas', w:1.2, mat:'Plástico',       v:'12V DC', dims:'150×80mm', desc:'Exaustor com proteção anti-chuva, DPI 44, 12V.' },
  'vent-exaust':    { name:'Ventilador Exaustão 12V',  cat:'Portas & Janelas', w:1.0, mat:'Plástico',       v:'12V DC', dims:'245×245mm', desc:'Ventilador de exaustão 12V, 4 velocidades, grade removível.' },
  'exaustor-coifa': { name:'Exaustor Coifa 12V LED',  cat:'Portas & Janelas', w:1.5, mat:'Plástico/Metal', v:'12V DC', dims:'387×233mm', desc:'Exaustor coifa com LED integrado, 3 velocidades.' },
  'potti':          { name:'Porta Potti',              cat:'Instalações', w:2.5,  mat:'Plástico',       v:null,    dims:'330×450mm', desc:'Porta porta-papel higiênico Potti, fixação na parede.' },
  'tanque':         { name:'Tanque 20L',               cat:'Instalações', w:1.2,  mat:'Polietileno',    v:null,    dims:'300×200×300mm', desc:'Tanque de água limpa 20L, polietileno alimentício, tampa rosqueável.' },
  'quadro':         { name:'Quadro 12V',               cat:'Instalações', w:2.0,  mat:'Plástico/Aço',   v:'12V DC', dims:'300×250×100mm', desc:'Quadro de distribuição 12V, disjuntores termomagnéticos.' },
  'tanque-40':      { name:'Tanque 40L',               cat:'Instalações', w:2.2,  mat:'Polietileno',    v:null,    dims:'500×300×400mm', desc:'Tanque de água limpa 40L, formato axial, tampa rosqueável.' },
  'led-strip':      { name:'LED Strip 5m 12V',         cat:'Iluminação', w:0.3,  mat:'Silicone/LED',   v:'12V DC', dims:'5000×10×2mm', desc:'Fita LED 5m 12V, 60 LEDs/m, branco quente, IP65.' },
  'plafon':         { name:'Plafon LED Ø140',          cat:'Iluminação', w:0.2,  mat:'Plástico/LED',   v:'12V DC', dims:'Ø140×35mm', desc:'Plafon LED redondo 12V, 10W, 800lm, branco neutro.' },
  'spot-led':       { name:'Spot LED 3W',              cat:'Iluminação', w:0.08, mat:'Alumínio/LED',   v:'12V DC', dims:'Ø50×40mm', desc:'Spot LED embutido 12V, 3W, 250lm, branco quente.' },
  'claraboia-280':  { name:'Claraboia 280mm',          cat:'Ventilação', w:1.5,  mat:'Plástico',       v:null,    dims:'280×280×120mm', desc:'Claraboia redonda 280mm, Tampa Anti-UV, vedação EPDM.' },
  'claraboia-400':  { name:'Claraboia 400mm',          cat:'Ventilação', w:2.8,  mat:'Plástico',       v:null,    dims:'400×400×150mm', desc:'Claraboia quadrada 400mm, Tampa dupla, isolamento térmico.' },
  'grade-vent':     { name:'Grade Vent 525×280',       cat:'Ventilação', w:0.6,  mat:'Alumínio',       v:null,    dims:'525×280mm', desc:'Grade de ventilação em alumínio, perfil extrudado, pintura eletrostática.' },
  'box-banheiro':   { name:'Box Banheiro 108cm',       cat:'Banheiro', w:12,   mat:'Acrílico/Fibra', v:null,    dims:'1080×800×1850mm', desc:'Box de banheiro em acrílico branco, porta basculante, perfil cromado.' },
  'ducha-ext':      { name:'Ducha Externa',            cat:'Banheiro', w:1.5,  mat:'Inox/Plástico',  v:null,    dims:'300×200×600mm', desc:'Ducha externa com registro, acabamento cromado, altura ajustável.' },
  'escada-ret':     { name:'Escada Retrátil',          cat:'Acessórios', w:3.2,  mat:'Alumínio',       v:null,    dims:'450×300×700mm', desc:'Escada retrátil 2 degraus, alumínio anodizado, capacidade 150kg.' },
  'porta-copo':     { name:'Porta-copo Dobrável',      cat:'Acessórios', w:0.4,  mat:'Plástico/Aço',   v:null,    dims:'200×150×100mm', desc:'Porta-copo dobrável, suporte para 2 copos, fixação na parede.' },
  'mesa-dob':       { name:'Mesa Dobrável 70×40',      cat:'Acessórios', w:3.5,  mat:'Laminado',       v:null,    dims:'700×400×680mm', desc:'Mesa dobrável de parede, tampa laminada, dobradiça reforçada.' },
  'calco':          { name:'Calço Roda UK36',           cat:'Acessórios', w:0.8,  mat:'Borracha',       v:null,    dims:'150×100×80mm', desc:'Calço de roda em borracha vulcanizada, tamanho UK36.' },
  'calco-inox':     { name:'Calço Inox KG 50cm',       cat:'Acessórios', w:1.0,  mat:'Aço Inoxidável', v:null,    dims:'500×80×60mm', desc:'Calço inox articulado KG 50cm, trava de segurança.' },
  'pingadeira':     { name:'Kit Pingadeira 1400',      cat:'Acessórios', w:0.6,  mat:'Alumínio',       v:null,    dims:'1400×50×30mm', desc:'Kit pingadeira em alumínio extrudado, perfil em L, 1.4m.' },
  'boiler':         { name:'Boiler 10L 12V/220V',      cat:'Acessórios', w:4.5,  mat:'Inox',           v:'12V/220V', dims:'Ø250×380mm', desc:'Boiler 10L bivolt, aquecimento rápido, isolamento térmico.' },
  'cozinha-compacta':{ name:'Cozinha compacta 120',    cat:'Acessórios', w:18,   mat:'MDF/Inox',       v:null,    dims:'1200×450×900mm', desc:'Módulo de cozinha compacto 120cm, fogareiro + armário.' },
  'trava-porta':    { name:'Trava Push-Lock',          cat:'Acessórios', w:0.2,  mat:'Nylon/Aço',      v:null,    dims:'80×60×40mm', desc:'Trava Push-Lock para porta de trailer, trava por pressão.' },
  'caixa-gas':      { name:'Caixa de Gás 88×61',      cat:'Acessórios', w:3.0,  mat:'Compensado',     v:null,    dims:'880×610×400mm', desc:'Caixa de armazenamento de gás, ventilação inferior, acesso rápido.' },
  'clima-evap':     { name:'Climatiz. Evap. 12V',     cat:'Climatização', w:5.5,  mat:'Plástico',       v:'12V DC', dims:'500×300×400mm', desc:'Climatizador evaporativo 12V, tanque 6L, 3 velocidades.' },
  'ac-portatil':    { name:'Ar Cond. Portátil',        cat:'Climatização', w:25,   mat:'Plástico',       v:'220V',  dims:'400×350×700mm', desc:'Ar condicionado portátil 7500 BTU, 220V, modo frio/ar.' },
  'ac-teto':        { name:'Ar Cond. Teto 12V',        cat:'Climatização', w:8,    mat:'Plástico/Metal', v:'12V DC', dims:'400×300×150mm', desc:'Ar condicionado de teto 12V, 3000 BTU, baixo consumo.' },
  'entrada-cabos':  { name:'Entrada Cabos Telhado',    cat:'Elétrica', w:0.3,  mat:'EPDM/Plástico',  v:null,    dims:'Ø30×40mm', desc:'Boot de entrada de cabos, vedação IP67, silicone EPDM.' },
  'painel-dj':      { name:'Painel Disjuntores',       cat:'Elétrica', w:1.5,  mat:'Plástico/Aço',   v:'12V DC', dims:'300×250×100mm', desc:'Painel de disjuntores 12V, 6 circuitos, LEDs indicadores.' },
};

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
      this.services.walkthrough.setMZFloorY(interiorResult.colTopY + 0.04);
      [interiorResult.counter, interiorResult.counterTop, interiorResult.kidBed,
        interiorResult.potti, interiorResult.stairCabs, interiorResult.guard].forEach((obj) => {
        this.services.walkthrough.addWalkSolid(obj, 'cabin');
      });
      [interiorResult.casalBed].forEach((obj) => this.services.walkthrough.addWalkSolid(obj, 'mezz'));
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

      this.services.palette = new PaletteService({
        interior, body, FLOOR_Y: C2.FLOOR_Y,
        editableMeshes: this.editableMeshes,
        pushUndoFn: () => ed.pushUndo(),
        resolvePlacementFn: (obj) => ed.resolvePlacement(obj),
        selectObjectFn: (obj) => ed.selectObject(obj),
        addEditableFn: (mesh, name, cat, kind) => {
          ed.addEditable(mesh, name || (mesh.userData && mesh.userData.name) || 'Objeto', cat, kind);
          if (!this.editableMeshes.includes(mesh)) this.editableMeshes.push(mesh);
        },
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
      this.services.project = new ProjectService();
      if (this.services.export && this.services.export.setProjectService) {
        this.services.export.setProjectService(this.services.project);
      }
      this.services.weight = new WeightService(this.services.project.getWeights());
      this.services.userFiles = new UserFilesService({
        auth: this.services.auth,
        saveService: this.services.save,
        projectService: this.services.project,
        loadDeps: {},
      });

this.initUI();
       this._collectAllEditable();
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

  _collectEditableMeshes() {
    const meshes = [];
    const interior = this.models.interior;

    const NAMES = {
      bath: ['Vaso sanitário', 'Tampa vaso', 'Ducha higiênica', 'Mangueira ducha', 'Espelho banheiro', 'Cuba banheiro'],
      kitchen: ['Balcão cozinha', 'Tampo balcão', 'Geladeira 37L', 'Alça geladeira', 'Galão água 20L', 'Fogareiro 1', 'Fogareiro 2'],
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

    // Janelas e porta de entrada são movíveis pelo layout (projeto manda):
    const addGroup = (g) => {
      if (g && g.userData && g.userData.name && meshes.indexOf(g) < 0) {
        g.userData.editable = true;
        meshes.push(g);
      }
    };
    if (this.models.windows) this.models.windows.windowGroups.forEach(addGroup);
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
    bindNum('pos-x', (o, v) => { o.position.x = v; });
    bindNum('pos-y', (o, v) => { o.position.y = v; });
    bindNum('pos-z', (o, v) => { o.position.z = v; });
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
      spawnPaletteItem: (kind) => palette.spawnPaletteItem(kind),
      attachProductMeta: (mesh, kind) => palette.attachProductMeta(mesh, kind),
      attachCarpentryPart: (parent, spec, worldPoint, localPoint) => marcenaria.attachCarpentryPart(parent, spec, worldPoint, localPoint),
      aiLog: (text, cls) => ai && ai.aiLog(text, cls),
    };
        save.captureFactoryLayout(() => editor.captureLayout());
    save.loadLayout(saveDeps);
    // Restaura geometry.parts salvo (sem login) e reconstrói cena
    try {
      const rawProj = localStorage.getItem('trailer3d-project-json-v1');
      if (rawProj) {
        const savedProj = JSON.parse(rawProj);
        if (savedProj && savedProj.geometry && Array.isArray(savedProj.geometry.parts) && savedProj.geometry.parts.length) {
          this.services.project.loadProject(savedProj);
          // rebuild/setup happens when initUI continues — queue microtask after the scene helpers exist
          queueMicrotask(() => {
            if (savedProj.geometry.kind === 'open-box' || savedProj.geometry.projectType === 'box') {
              if (typeof this.rebuildProjectGeometry === 'function') {
                this.rebuildProjectGeometry(savedProj);
                if (this.services.export) {
                  const parts = this.services.export.extractPartsFromProject(savedProj);
                  this.services.export.setScenePieces(parts.length ? parts : null);
                }
              }
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
      const isOpenBox = geo.kind === 'open-box' || geo.projectType === 'box';
      if (!isOpenBox) return false;

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

    const runOpenProject = () => {
      project.openProjectFile().then((proj) => {
        if (!proj) return;
        try { project.loadProject(proj); } catch (e) { return; }
        if (app.services.export) {
          // Força plano de corte a partir do JSON importado (nunca trailer default)
          const fromFile = app.services.export.extractPartsFromProject
            ? app.services.export.extractPartsFromProject(proj)
            : [];
          app.services.export.setScenePieces(fromFile.length ? fromFile : null);
        }
        const built = buildGeometryFromProject(proj);
        if (!built && (proj.dimensions || proj.weights_kg || proj.specs)) {
          materializeFactory();
          restoreSceneFromEmpty();
          this.ensureEnvelopeVisibility(true, true);
        }

        // ── HOOK: aberturas 100% derivadas do JSON do projeto ──
        // O layout posiciona as janelas/porta; o tool só corta o que está no layout.
        const openSrc = this.editableMeshes.filter((m) => m && m.parent && m.userData && m.position
          && m.position.y < 2
          && (m.userData.kind === 'porta' || m.userData.funcKind === 'janela'));
        if (openSrc.length && this.models.body && typeof this.models.body.setLayoutOpenings === 'function') {
          this.models.body.setLayoutOpenings(openSrc);
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
        updateCurrentProjectName();
        const dim = proj.dimensions_mm && proj.dimensions_mm.externo;
        const dimTxt = dim
          ? ` ${dim.largura_X||dim.L||'?'}×${dim.profundidade_Z||dim.P||'?'}×${dim.altura_Y||dim.H||'?'} mm`
          : '';
        ai && ai.aiLog('Projeto importado: ' + (proj.meta?.name || '') + ' rev' + (proj.meta?.rev||'') + dimTxt, 'sys');
      }).catch((err) => alert('Erro: ' + err.message));
    };
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
      if (W && W.walkMode) return;

      const k = e.key.toLowerCase();

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
      const data = PALLET_DATA[key];
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
      renderer.render(scene, camera);
    };
    animate();
  }
}

const app = new TrailerApp();
window.__app = app;
window.trailerApp = app;
app.init();
