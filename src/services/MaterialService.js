const THREE = window.THREE;

const MAT_PRESETS = [
  { name:'Madeira',       color:'#d4b483', rough:0.70, metal:0.10 },
  { name:'Pinus',         color:'#e8d8a0', rough:0.75, metal:0.05 },
  { name:'MDF',           color:'#c0a878', rough:0.80, metal:0.05 },
  { name:'Nogueira',      color:'#6a4a28', rough:0.60, metal:0.08 },
  { name:'Carvalho',      color:'#b08050', rough:0.65, metal:0.08 },
  { name:'Peroba',        color:'#8a5030', rough:0.60, metal:0.08 },
  { name:'Freijo',        color:'#c8a870', rough:0.65, metal:0.08 },
  { name:'Madeira Escura',color:'#a08050', rough:0.70, metal:0.10 },
  { name:'Alumínio',      color:'#c8c8c8', rough:0.40, metal:0.70 },
  { name:'Aço',           color:'#2a2e36', rough:0.50, metal:0.60 },
  { name:'Inox',          color:'#d0d0d0', rough:0.30, metal:0.80 },
  { name:'Cobre',         color:'#b87333', rough:0.35, metal:0.75 },
  { name:'Galvanizado',   color:'#a0a8b0', rough:0.45, metal:0.55 },
  { name:'Telhado',       color:'#8e949a', rough:0.42, metal:0.50 },
  { name:'Preto',         color:'#1a1a1a', rough:0.60, metal:0.30 },
  { name:'Branco',        color:'#f0f0f0', rough:0.50, metal:0.05 },
  { name:'Cinza',         color:'#808080', rough:0.60, metal:0.15 },
  { name:'Vermelho',      color:'#c03030', rough:0.55, metal:0.10 },
  { name:'Azul',          color:'#3060c0', rough:0.55, metal:0.10 },
  { name:'Verde',         color:'#30a050', rough:0.55, metal:0.10 },
  { name:'Marrom',        color:'#6a4020', rough:0.70, metal:0.08 },
  { name:'Bege',          color:'#d8c8a0', rough:0.65, metal:0.05 },
  { name:'Creme',         color:'#f0e8d0', rough:0.60, metal:0.05 },
  { name:'Porcelanato',   color:'#e0d8c8', rough:0.25, metal:0.10 },
  { name:'Vidro',         color:'#b8d4e8', rough:0.10, metal:0.40, transparent:true, opacity:0.45 },
  { name:'EPS',           color:'#f0d848', rough:0.95, metal:0.00 },
  { name:'Granito',       color:'#505050', rough:0.30, metal:0.15 },
  { name:'Mármore',       color:'#e8e0d8', rough:0.20, metal:0.10 },
];

const WOOD_MAT_KEYS = new Set(['madeira', 'madeiraD', 'parede', 'paredeD', 'piso']);
const MATERIAL_FAMILY = { wood: 'wood', metal: 'metal', glass: 'glass', fabric: 'fabric', other: 'other' };

function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color,
    roughness: 0.7,
    metalness: 0.1,
    flatShading: true,
  }, opts));
}

export default class MaterialService {
  constructor() {
    this.MAT_PRESETS = MAT_PRESETS;
    this.MATERIAL_FAMILY = MATERIAL_FAMILY;
    this.mat = mat;
  }

  getCurrentMatProps(selected) {
    if (!selected) return null;
    let mesh = selected;
    if (selected.isGroup) {
      selected.traverse((c) => { if (c.isMesh) mesh = c; });
    }
    if (!mesh || !mesh.material) return null;
    const m = mesh.material;
    return {
      color: '#' + m.color.getHexString(),
      roughness: m.roughness,
      metalness: m.metalness,
      transparent: m.transparent,
      opacity: m.opacity,
    };
  }

  applyMaterialToSelected(selected, color, roughness, metalness, transparent, opacity, pushUndoFn) {
    if (!selected) return;
    if (pushUndoFn) pushUndoFn();
    const apply = (obj) => {
      if (!obj.isMesh) return;
      const isWall = obj.material && obj.material.side === THREE.DoubleSide;
      const isGlass = transparent || (color && parseInt(color.replace('#', ''), 16) === 0xb8d4e8);
      const opts = { color, roughness, metalness, flatShading: true };
      if (isWall) opts.side = THREE.DoubleSide;
      if (isGlass) { opts.transparent = true; opts.opacity = opacity || 0.45; }
      obj.material = mat(color, opts);
    };
    if (selected.isGroup) { selected.traverse(apply); }
    else { apply(selected); }
  }

  updateMatUI(selected) {
    const props = this.getCurrentMatProps(selected);
    if (!props) return;
    const colorEl = document.getElementById('mat-color');
    const hexEl = document.getElementById('mat-color-hex');
    const roughEl = document.getElementById('mat-roughness');
    const roughVal = document.getElementById('mat-roughness-val');
    const metalEl = document.getElementById('mat-metalness');
    const metalVal = document.getElementById('mat-metalness-val');
    if (colorEl) colorEl.value = props.color;
    if (hexEl) hexEl.value = props.color;
    if (roughEl) roughEl.value = props.roughness;
    if (roughVal) roughVal.textContent = props.roughness.toFixed(2);
    if (metalEl) metalEl.value = props.metalness;
    if (metalVal) metalVal.textContent = props.metalness.toFixed(2);
    document.querySelectorAll('.mat-preset').forEach((p) => {
      const pc = p.dataset.color;
      p.classList.toggle('active', pc && pc.toLowerCase() === props.color.toLowerCase());
    });
  }

  materialFamilyOf(obj) {
    if (!obj) return MATERIAL_FAMILY.other;
    if (obj.userData && obj.userData.matFamily) return obj.userData.matFamily;
    const name = ((obj.userData && obj.userData.name) || '').toLowerCase();
    if (/vidro|janela/.test(name)) return MATERIAL_FAMILY.glass;
    if (/colch|travesseiro|tecido/.test(name)) return MATERIAL_FAMILY.fabric;
    if (/geladeira|alumin|chassis|inox|metal|torneira|fogareiro/.test(name)) return MATERIAL_FAMILY.metal;
    let foundWood = false;
    let foundMetal = false;
    obj.traverse((ch) => {
      const m = ch.material;
      if (!m) return;
      const mats = Array.isArray(m) ? m : [m];
      mats.forEach((mm) => {
        if (!mm || !mm.isMeshStandardMaterial) return;
        if (mm.metalness > 0.45) foundMetal = true;
        const hex = mm.color ? mm.color.getHex() : 0;
        if (WOOD_MAT_KEYS.has(mm.userData && mm.userData.key)) foundWood = true;
        if (mm.metalness < 0.28 && hex >= 0x8a6030 && hex <= 0xe8d0a0) foundWood = true;
        const c = mm.color;
        if (c && mm.metalness < 0.28 && c.r > 0.45 && c.g > 0.28 && c.b < 0.55 && c.r > c.b) foundWood = true;
      });
    });
    if (/arm[aá]rio|balc[aã]o|tampo|cozinha|madeira|escada|saia|bancada|gaveta/.test(name)) foundWood = true;
    if (foundWood && !foundMetal) return MATERIAL_FAMILY.wood;
    if (foundWood) return MATERIAL_FAMILY.wood;
    if (foundMetal) return MATERIAL_FAMILY.metal;
    return MATERIAL_FAMILY.other;
  }

  isWoodSelected(selected) {
    return this.materialFamilyOf(selected) === MATERIAL_FAMILY.wood;
  }

  getMatDefs() {
    return {
      'madeira':       { color: 0xd4b483, roughness: 0.70, metalness: 0.10 },
      'madeira clara': { color: 0xd4b483, roughness: 0.70, metalness: 0.10 },
      'compensado':    { color: 0xd4b483, roughness: 0.70, metalness: 0.10 },
      'madeira escura':{ color: 0xa08050, roughness: 0.70, metalness: 0.10 },
      'freijo':        { color: 0xc8a870, roughness: 0.65, metalness: 0.08 },
      'pinus':         { color: 0xe8d8a0, roughness: 0.75, metalness: 0.05 },
      'mdf':           { color: 0xc0a878, roughness: 0.80, metalness: 0.05 },
      'nogueira':      { color: 0x6a4a28, roughness: 0.60, metalness: 0.08 },
      'carvalho':      { color: 0xb08050, roughness: 0.65, metalness: 0.08 },
      'peroba':        { color: 0x8a5030, roughness: 0.60, metalness: 0.08 },
      'aluminio':      { color: 0xc8c8c8, roughness: 0.40, metalness: 0.70 },
      'aco':           { color: 0x2a2e36, roughness: 0.50, metalness: 0.60 },
      'inox':          { color: 0xd0d0d0, roughness: 0.30, metalness: 0.80 },
      'cobre':         { color: 0xb87333, roughness: 0.35, metalness: 0.75 },
      'telhado':       { color: 0x8e949a, roughness: 0.42, metalness: 0.50 },
      'galvanizado':   { color: 0xa0a8b0, roughness: 0.45, metalness: 0.55 },
      'preto':         { color: 0x1a1a1a, roughness: 0.60, metalness: 0.30 },
      'branco':        { color: 0xf0f0f0, roughness: 0.50, metalness: 0.05 },
      'cinza':         { color: 0x808080, roughness: 0.60, metalness: 0.15 },
      'vermelho':      { color: 0xc03030, roughness: 0.55, metalness: 0.10 },
      'azul':          { color: 0x3060c0, roughness: 0.55, metalness: 0.10 },
      'verde':         { color: 0x30a050, roughness: 0.55, metalness: 0.10 },
      'marrom':        { color: 0x6a4020, roughness: 0.70, metalness: 0.08 },
      'bege':          { color: 0xd8c8a0, roughness: 0.65, metalness: 0.05 },
      'creme':         { color: 0xf0e8d0, roughness: 0.60, metalness: 0.05 },
      'eps':           { color: 0xf0d848, roughness: 0.95, metalness: 0.00 },
      'vidro':         { color: 0xb8d4e8, roughness: 0.10, metalness: 0.40, transparent: true, opacity: 0.45 },
      'piso':          { color: 0xb89060, roughness: 0.90, metalness: 0.05 },
      'porcelanato':   { color: 0xe0d8c8, roughness: 0.25, metalness: 0.10 },
      'colchao':       { color: 0xd08080, roughness: 0.95, metalness: 0.00 },
      'vaso':          { color: 0xf8f8f8, roughness: 0.40, metalness: 0.05 },
      'geladeira':     { color: 0xb0b0b0, roughness: 0.40, metalness: 0.50 },
      'granito':       { color: 0x505050, roughness: 0.30, metalness: 0.15 },
      'marmore':       { color: 0xe8e0d8, roughness: 0.20, metalness: 0.10 },
    };
  }

  buildMatPresetsUI(wrapId) {
    const wrap = document.getElementById(wrapId);
    if (!wrap) return;
    MAT_PRESETS.forEach((p) => {
      const d = document.createElement('div');
      d.className = 'mat-preset';
      d.style.background = p.color;
      d.title = p.name;
      d.dataset.color = p.color;
      d.dataset.rough = p.rough;
      d.dataset.metal = p.metal;
      d.dataset.trans = p.transparent ? '1' : '';
      d.dataset.opacity = p.opacity || '';
      wrap.appendChild(d);
    });
  }
}
