const THREE = window.THREE;

const PALETTE_CATALOG = {
  pia: { q: 'pia inox Ø280 trailer motorhome', buy: 'https://www.google.com/search?tbm=shop&q=pia+inox+28cm+trailer' },
  comoda: { q: 'cômoda 3 gavetas compacta 50x40', buy: 'https://www.google.com/search?tbm=shop&q=c%C3%B4moda+3+gavetas+50cm' },
  armario: { q: 'armário suspenso 40x60 trailer', buy: 'https://www.google.com/search?tbm=shop&q=arm%C3%A1rio+40x60+trailer' },
  banco: { q: 'banco baú trailer motorhome', buy: 'https://www.google.com/search?tbm=shop&q=banco+ba%C3%BA+trailer' },
  mesa: { q: 'mesa Lagun motorhome', buy: 'https://www.meutrailer.com.br/base-de-mesa-motorhome-desmontavel-com-encaixe-novo-modelo/p/9191' },
  dinette: { q: 'banco mesa dinete trailer vira cama RecPro', buy: 'https://recpro.com/recpro-38-rv-dinette-booth-with-optional-table-and-leg/' },
  geladeira: { q: 'geladeira 12V 37L trailer', buy: 'https://www.google.com/search?tbm=shop&q=geladeira+12V+37L+trailer' },
  porta: { q: 'porta entrada trailer 62x160', buy: 'https://www.google.com/search?tbm=shop&q=porta+entrada+trailer+62x160' },
  janela: { q: 'janela trailer 500x500', buy: 'https://www.google.com/search?tbm=shop&q=janela+trailer+50x50' },
  potti: { q: 'Thetford Porta Potti 365', buy: 'https://www.google.com/search?tbm=shop&q=Porta+Potti+365' },
  tanque: { q: 'tanque água 20L trailer', buy: 'https://www.google.com/search?tbm=shop&q=tanque+%C3%A1gua+20L+trailer' },
  'caixa-agua-80': { q: 'caixa de água 80L trailer van motorhome', buy: 'https://www.mercadolivre.com.br/caixa-de-agua-para-trailer-van-e-motorhome-80l/up/MLBU3419758639' },
  'caixa-agua-100': { q: 'caixa d\'água 100 litros trailer van motorhome', buy: 'https://www.mercadolivre.com.br/caixa-d-agua-100-litros-para-trailer-van-motorhome/up/MLBU1738593317' },
  'caixa-agua-130': { q: 'caixa de água polietileno 130L trailer motorhome', buy: 'https://www.google.com/search?tbm=shop&q=caixa+de+%C3%A1gua+polietileno+130L+trailer' },
  'caixa-agua-152': { q: 'caixa de água 152L baixo perfil trailer', buy: 'https://www.meutrailer.com.br/caixa-de-agua-de-polietileno-152l-p-trailer-van-motorhome/p/1074' },
  'tanque-agua-30': { q: 'tanque água fresca 30L 40L vertical RV trailer', buy: 'https://pt.aliexpress.com/item/1005004815933161.html' },
  'reservatorio-40': { q: 'reservatório água 40L com rodas e alça transporte', buy: 'https://www.toprv.com.br/reservatorio-de-agua-40l-com-rodas-e-alca-para-transporte-9160004' },
  quadro: { q: 'quadro elétrico 12V trailer', buy: 'https://www.google.com/search?tbm=shop&q=quadro+el%C3%A9trico+12V+trailer' },
  exaustor: { q: 'exaustor teto 12V trailer', buy: 'https://www.google.com/search?tbm=shop&q=exaustor+teto+12V+trailer' },
  'led-strip': { q: 'fita LED 12V 5m trailer', buy: 'https://www.google.com/search?tbm=shop&q=fita+LED+12V+5m+trailer' },
  plafon: { q: 'plafon LED 140mm 12V trailer', buy: 'https://www.google.com/search?tbm=shop&q=plafon+LED+140mm+12V+trailer' },
  boiler: { q: 'boiler 10L 12V 220V trailer', buy: 'https://www.google.com/search?tbm=shop&q=boiler+10L+12V+220V+trailer' },
};

function productSearchUrl(q) {
  return 'https://www.google.com/search?tbm=shop&q=' + encodeURIComponent(q);
}

export default class PaletteService {
  constructor({ interior, body, FLOOR_Y, editableMeshes, pushUndoFn, resolvePlacementFn, selectObjectFn, addEditableFn, uniqueNameFn, roofTopFn, makeHingedDoorFn, makeRvWindowFn, makeDinetteGroupFn, M, matFn, weightService }) {
    this.interior = interior;
    this.body = body || null;
    this.FLOOR_Y = FLOOR_Y;
    this.editableMeshes = editableMeshes;
    this.pushUndo = pushUndoFn;
    this.resolvePlacement = resolvePlacementFn;
    this.selectObject = selectObjectFn;
    this.addEditable = addEditableFn;
    this.uniqueName = uniqueNameFn;
    this.roofTop = roofTopFn;
    this.makeHingedDoor = makeHingedDoorFn;
    this.makeRvWindow = makeRvWindowFn;
    this.makeDinetteGroup = makeDinetteGroupFn;
    this.M = M;
    this.mat = matFn;
    this.weightService = weightService || null;

    this.PALETTE_CATALOG = PALETTE_CATALOG;
  }

  productMeta(kind) {
    const c = PALETTE_CATALOG[kind];
    if (!c) return null;
    return { kind, buyUrl: c.buy, searchUrl: productSearchUrl(c.q), query: c.q };
  }

  attachProductMeta(mesh, kind) {
    const meta = this.productMeta(kind);
    if (!mesh || !meta) return;
    mesh.userData.kind = kind;
    mesh.userData.buyUrl = meta.buyUrl;
    mesh.userData.searchUrl = meta.searchUrl;
    mesh.userData.productQuery = meta.query;
  }

  interiorGroup() {
    return (this.interior && this.interior.interior) ? this.interior.interior : this.interior;
  }

  spawnPaletteItem(kind) {
    const M = this.M;
    const matFn = this.mat;
    let mesh, name, cat = 'acessorios';
    const roofTop = this.roofTop;

    if (kind === 'pia') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xa8a8a8, metalness: 0.7 }));
      mesh.position.set(0.2, 0.90, 0); name = 'Pia'; cat = 'encanamento';
    } else if (kind === 'porta') {
      mesh = this.makeHingedDoor({ w: 0.62, h: 1.60, open: -0.9 });
      mesh.position.set(0.3, 0.08, 0.4); name = 'Porta entrada'; cat = 'paredes';
    } else if (kind === 'porta-int') {
      mesh = this.makeHingedDoor({ w: 0.55, h: 1.70, open: 0.9 });
      mesh.position.set(0, 0.02, 0.2); name = 'Porta interna'; cat = 'paredes-int';
    } else if (kind === 'comoda') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.70, 0.40), M.madeiraD);
      mesh.position.set(0, 0.35, 0.4); name = 'Cômoda';
    } else if (kind === 'armario') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.60, 0.35), M.madeira);
      mesh.position.set(0.2, 0.30, 0); name = 'Armário';
    } else if (kind === 'banco') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.42, 0.70), M.madeira);
      mesh.position.set(0, 0.21, 0.6); name = 'Banco-baú';
    } else if (kind === 'mesa') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.04, 0.45), M.madeira);
      mesh.position.set(0, 0.62, 0.4); name = 'Mesa Lagun';
      mesh.userData.role = 'table'; mesh.userData.restY = 0.62; mesh.userData.bedY = 0.37;
    } else if (kind === 'geladeira') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.58, 0.44), M.geladeira);
      mesh.position.set(0.3, 0.29, -0.4); name = 'Geladeira 12V';
    } else if (kind === 'potti') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.38), M.vaso);
      mesh.position.set(-0.3, 0.21, -0.8); name = 'Porta Potti'; cat = 'encanamento';
    } else if (kind === 'tanque') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.40, 12), new THREE.MeshStandardMaterial({ color: 0x4a8ab0, transparent: true, opacity: 0.7 }));
      mesh.position.set(0.2, 0.20, -0.5); name = 'Tanque 20L'; cat = 'encanamento';
    } else if (kind === 'quadro') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.06), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
      mesh.position.set(0.55, 1.20, 0); name = 'Quadro 12V'; cat = 'eletrica';
    } else if (kind === 'exaustor') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.06, 16), M.aluminio);
      mesh.position.set(0, roofTop(0) + 0.04, 0.5); name = 'Exaustor'; cat = 'eletrica';
    } else if (kind === 'led-strip') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.015, 0.015), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0xffe066, emissiveIntensity: 0.15 }));
      mesh.position.set(0, roofTop(0) + 0.01, 0); name = 'LED Strip 5m'; cat = 'eletrica';
    } else if (kind === 'plafon') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 16), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, emissive: 0xfff8e0, emissiveIntensity: 0.3 }));
      mesh.position.set(0, roofTop(0) - 0.01, 0); name = 'Plafon LED Ø140'; cat = 'eletrica';
    } else if (kind === 'boiler') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.40, 16), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.5, emissive: 0xff8640, emissiveIntensity: 0.12 }));
      mesh.position.set(0.35, 0.20, -0.55); name = 'Boiler 10L'; cat = 'encanamento';
    } else if (kind === 'janela' || kind.indexOf('janela-') === 0) {
      const specs = {
        janela: [0.50, 0.50, 'Janela 50×50'],
        'janela-50x35': [0.50, 0.35, 'Janela SANJO 50×35'],
        'janela-70x40': [0.70, 0.40, 'Janela SANJO 70×40'],
        'janela-90x45': [0.90, 0.45, 'Janela SANJO 90×45'],
        'janela-120x50': [1.20, 0.50, 'Janela SANJO 120×50'],
        'janela-pp-350': [0.35, 0.50, 'Polyplastic 35×50'],
        'janela-fixa-120': [1.20, 0.50, 'Fixa panorâmica 120×50'],
        'janela-kg-750': [0.75, 0.50, 'Janela KG fumê 75×50'],
        'janela-kg-leitosa': [0.60, 0.45, 'Janela KG leitosa 60×45'],
      };
      const sp = specs[kind] || specs.janela;
      mesh = this.makeRvWindow(sp[0], sp[1]);
      mesh.position.set(0, 1.20, 0);
      name = sp[2]; cat = 'paredes';
    } else if (kind === 'dinette') {
      mesh = this.makeDinetteGroup ? this.makeDinetteGroup() : new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.45, 0.8), M.madeira);
      mesh.position.set(0, 0.22, 0.4); name = 'Dinette'; cat = 'acessorios';
    } else if (kind === 'recpro-38') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.46, 0.44), M.madeira));
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.02, 0.44), M.madeira);
      shelf.position.y = 0.23; g.add(shelf);
      mesh = g; mesh.position.set(0, 0.23, 0); name = 'RecPro 38"'; cat = 'acessorios';
    } else if (kind === 'recpro-44') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.46, 0.44), M.madeira));
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.02, 0.44), M.madeira);
      shelf.position.y = 0.23; g.add(shelf);
      mesh = g; mesh.position.set(0, 0.23, 0); name = 'RecPro 44"'; cat = 'acessorios';
    } else if (kind === 'camper-40') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.46, 0.44), M.madeira));
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.02, 0.44), M.madeira);
      shelf.position.y = 0.23; g.add(shelf);
      mesh = g; mesh.position.set(0, 0.23, 0); name = 'Camper Comfort 40"'; cat = 'acessorios';
    } else if (kind === 'pe-dinete-12v') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.70, 8), new THREE.MeshStandardMaterial({ color: 0xa0a8b0, metalness: 0.6 }));
      mesh.position.set(0, 0.35, 0.4); name = 'Pé dinete 12V'; cat = 'acessorios';
    } else if (kind === 'snap-base') {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.30, 0.03, 16), M.madeira);
      top.position.y = 0.72; g.add(top);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.70, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
      leg.position.y = 0.35; g.add(leg);
      mesh = g; mesh.position.set(0, 0, 0.4); name = 'SNAP table base'; cat = 'acessorios';
    } else if (kind === 'exaustor-anti') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xd0d0d0 }));
      mesh.position.set(0, roofTop(0) + 0.04, 0.5); name = 'Exaustor Anti-Chuva'; cat = 'eletrica';
    } else if (kind === 'vent-exaust') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.245, 0.245, 0.08), new THREE.MeshStandardMaterial({ color: 0xe0e0e0 }));
      mesh.position.set(0, roofTop(0) + 0.04, 0.5); name = 'Ventilador Exaustão'; cat = 'eletrica';
    } else if (kind === 'exaustor-coifa') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.06, 0.23), new THREE.MeshStandardMaterial({ color: 0xd8d8d8 })));
      const light = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 0.04), new THREE.MeshStandardMaterial({ color: 0xffe066, emissive: 0xffe066, emissiveIntensity: 0.4 }));
      light.position.set(0, -0.04, 0); g.add(light);
      mesh = g; mesh.position.set(0, roofTop(0) + 0.04, 0.5); name = 'Exaustor Coifa 12V LED'; cat = 'eletrica';
    } else if (kind === 'tanque-40') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.40, 0.30), new THREE.MeshStandardMaterial({ color: 0x4a8ab0, transparent: true, opacity: 0.7 }));
      mesh.position.set(0.2, 0.20, -0.5); name = 'Tanque 40L'; cat = 'encanamento';
    } else if (kind === 'caixa-agua-80' || kind === 'caixa-agua-100' || kind === 'caixa-agua-130' || kind === 'caixa-agua-152') {
      const specs = {
        'caixa-agua-80':  [1.30, 0.42, 0.38, 'Caixa de Água 80L'],
        'caixa-agua-100': [1.10, 0.45, 0.55, 'Caixa de Água 100L'],
        'caixa-agua-130': [1.23, 0.30, 0.56, 'Caixa de Água 130L'],
        'caixa-agua-152': [1.45, 0.22, 0.56, 'Caixa de Água 152L'],
      };
      const sp = specs[kind];
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(sp[0], sp[1], sp[2]), new THREE.MeshStandardMaterial({ color: 0x8ec6de, transparent: true, opacity: 0.55 }));
      g.add(body);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x2a5a70 }));
      cap.position.y = sp[1] / 2 + 0.025; g.add(cap);
      mesh = g; mesh.position.set(0, 0.02, 0); name = sp[3]; cat = 'encanamento';
    } else if (kind === 'tanque-agua-30') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.60, 14), new THREE.MeshStandardMaterial({ color: 0x4a8ab0, transparent: true, opacity: 0.7 }));
      mesh.position.set(0.2, 0.30, -0.5); name = 'Tanque de Água Vertical 30/40L'; cat = 'encanamento';
    } else if (kind === 'reservatorio-40') {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.32), new THREE.MeshStandardMaterial({ color: 0x6ab0c8, transparent: true, opacity: 0.65 }));
      g.add(body);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
        const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(-0.15 + i * 0.30, -0.16, -0.09 + j * 0.18); g.add(wheel);
      }
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 14), new THREE.MeshStandardMaterial({ color: 0x2a5a70 }));
      handle.position.y = 0.15; g.add(handle);
      mesh = g; mesh.position.set(0.2, 0.13, -0.5); name = 'Reservatório 40L c/ rodas'; cat = 'encanamento';
    } else if (kind === 'spot-led') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xfff8e0, emissiveIntensity: 0.5 }));
      mesh.position.set(0, roofTop(0) - 0.01, 0); name = 'Spot LED 3W'; cat = 'eletrica';
    } else if (kind === 'claraboia-280') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 16), new THREE.MeshStandardMaterial({ color: 0xd0d8d8, transparent: true, opacity: 0.6 }));
      mesh.position.set(0, roofTop(0) + 0.06, 0); name = 'Claraboia 280mm'; cat = 'acessorios';
    } else if (kind === 'claraboia-400') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.15, 16), new THREE.MeshStandardMaterial({ color: 0xc8d0d0, transparent: true, opacity: 0.6 }));
      mesh.position.set(0, roofTop(0) + 0.08, 0); name = 'Claraboia 400mm'; cat = 'acessorios';
    } else if (kind === 'grade-vent') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.525, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.5 }));
      mesh.position.set(0, 1.0, 0); name = 'Grade Vent 525×280'; cat = 'acessorios';
    } else if (kind === 'box-banheiro') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.85, 0.02), new THREE.MeshStandardMaterial({ color: 0xe0e8e8, transparent: true, opacity: 0.5 })));
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.85, 0.80), new THREE.MeshStandardMaterial({ color: 0xe0e8e8, transparent: true, opacity: 0.5 }));
      side.position.set(-0.54, 0, 0.40); g.add(side);
      mesh = g; mesh.position.set(-0.3, 0.92, -0.6); name = 'Box Banheiro 108cm'; cat = 'encanamento';
    } else if (kind === 'ducha-ext') {
      const g = new THREE.Group();
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.7 }));
      pipe.position.y = 0.3; g.add(pipe);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 0.06), new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.6 }));
      head.position.y = 0.6; g.add(head);
      mesh = g; mesh.position.set(-0.5, 0.02, 0); name = 'Ducha Externa'; cat = 'encanamento';
    } else if (kind === 'escada-ret') {
      const g = new THREE.Group();
      const rail1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.70, 6), new THREE.MeshStandardMaterial({ color: 0xb0b0b0, metalness: 0.7 }));
      rail1.position.set(-0.12, 0.35, 0); g.add(rail1);
      const rail2 = rail1.clone(); rail2.position.x = 0.12; g.add(rail2);
      for (let i = 0; i < 3; i++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.06), new THREE.MeshStandardMaterial({ color: 0x999999 }));
        step.position.set(0, 0.15 + i * 0.20, 0); g.add(step);
      }
      mesh = g; mesh.position.set(0, 0.02, 0.5); name = 'Escada Retrátil'; cat = 'acessorios';
    } else if (kind === 'porta-copo') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.15, 0.10), new THREE.MeshStandardMaterial({ color: 0x444444 })));
      const c1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x555555 }));
      c1.position.set(-0.05, 0, 0.06); g.add(c1);
      const c2 = c1.clone(); c2.position.x = 0.05; g.add(c2);
      mesh = g; mesh.position.set(0, 0.90, 0.4); name = 'Porta-copo Dobrável'; cat = 'acessorios';
    } else if (kind === 'mesa-dob') {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.03, 0.40), M.madeira);
      top.position.y = 0.68; g.add(top);
      const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.65, 0.03), M.madeira);
      leg1.position.set(-0.30, 0.32, 0.18); g.add(leg1);
      const leg2 = leg1.clone(); leg2.position.x = 0.30; g.add(leg2);
      mesh = g; mesh.position.set(0, 0.02, 0.4); name = 'Mesa Dobrável 70×40'; cat = 'acessorios';
    } else if (kind === 'calco') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 0.10), new THREE.MeshStandardMaterial({ color: 0xe8a020 }));
      mesh.position.set(0, 0.04, 0.5); name = 'Calço Roda UK36'; cat = 'acessorios';
    } else if (kind === 'calco-inox') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.06, 0.08), new THREE.MeshStandardMaterial({ color: 0xc8d0d4, metalness: 0.7 }));
      mesh.position.set(0, 0.03, 0.5); name = 'Calço Inox KG 50cm'; cat = 'acessorios';
    } else if (kind === 'pingadeira') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.40, 0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0xb8c0c4, metalness: 0.5 }));
      mesh.position.set(0, 1.80, 0); name = 'Kit Pingadeira 1400'; cat = 'acessorios';
    } else if (kind === 'cozinha-compacta') {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.90, 0.45), M.madeira));
      const counter = new THREE.Mesh(new THREE.BoxGeometry(1.20, 0.03, 0.45), new THREE.MeshStandardMaterial({ color: 0xa8a8a8, metalness: 0.3 }));
      counter.position.y = 0.45; g.add(counter);
      mesh = g; mesh.position.set(0, 0.45, 0.4); name = 'Cozinha compacta 120'; cat = 'acessorios';
    } else if (kind === 'trava-porta') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0xf0f0f0 }));
      mesh.position.set(0.32, 0.90, 0.42); name = 'Trava Push-Lock'; cat = 'acessorios';
    } else if (kind === 'caixa-gas') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.40, 0.61), M.madeira);
      mesh.position.set(0, 0.20, 0.6); name = 'Caixa de Gás'; cat = 'acessorios';
    } else if (kind === 'clima-evap') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.50, 0.40, 0.30), new THREE.MeshStandardMaterial({ color: 0xb0c8d8, emissive: 0x76c6ff, emissiveIntensity: 0.12 }));
      mesh.position.set(0.3, 0.20, -0.4); name = 'Climatiz. Evap. 12V'; cat = 'acessorios';
    } else if (kind === 'ac-portatil') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.70, 0.35), new THREE.MeshStandardMaterial({ color: 0xe0e0e0 }));
      mesh.position.set(0.3, 0.35, -0.4); name = 'Ar Cond. Portátil'; cat = 'acessorios';
    } else if (kind === 'ac-teto') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.15, 0.30), new THREE.MeshStandardMaterial({ color: 0xd0d0d0 }));
      mesh.position.set(0, roofTop(0) - 0.08, 0); name = 'Ar Cond. Teto 12V'; cat = 'acessorios';
    } else if (kind === 'entrada-cabos') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      mesh.position.set(0, roofTop(0) + 0.02, 0.3); name = 'Entrada Cabos Telhado'; cat = 'eletrica';
    } else if (kind === 'painel-dj') {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.25, 0.10), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
      mesh.position.set(0.55, 1.20, 0); name = 'Painel Disjuntores'; cat = 'eletrica';
    } else {
      return null;
    }

    mesh.userData.kind = kind;
    this.attachProductMeta(mesh, kind);
    mesh.castShadow = true;
    const group = this.interiorGroup();
    if (!group || typeof group.add !== 'function') return null;
    group.add(mesh);
    this.addEditable(mesh, this.uniqueName(name), cat);
    if (this.weightService) this.weightService.addItem(kind);
    return mesh;
  }

  finalizeWallOpening(item) {
    if (!item || !this.body || typeof this.body.applyOpening !== 'function') return;
    const kind = item.userData && item.userData.kind;
    if (this.body.isWallOpeningKind(kind) || (item.userData && item.userData.funcKind === 'janela')) {
      this.body.applyOpening(item);
    }
  }

  placePaletteAtClient(kind, clientX, clientY, renderer, raycaster, mouse, camera) {
    this.pushUndo();
    const item = this.spawnPaletteItem(kind);
    if (!item) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.FLOOR_Y);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      const group = this.interiorGroup();
      if (!group || typeof group.worldToLocal !== 'function') return null;
      const local = group.worldToLocal(hit.clone());
      item.position.x = local.x;
      item.position.z = local.z;
    } else {
      this.resolvePlacement(item);
    }
    this.finalizeWallOpening(item);
    this.selectObject(item);
    return item;
  }

  setupDragAndDrop(renderer, camera) {
    const buttons = document.querySelectorAll('#palette .pi[data-item]');
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    buttons.forEach((btn) => {
      const kind = btn.dataset.item;
      btn.setAttribute('draggable', 'true');
      btn.addEventListener('click', () => {
        this.pushUndo();
        const item = this.spawnPaletteItem(kind);
        if (!item) return;
        this.resolvePlacement(item);
        this.finalizeWallOpening(item);
        this.selectObject(item);
      });
      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', kind);
        e.dataTransfer.effectAllowed = 'copy';
      });
    });
    if (!renderer || !renderer.domElement) return;
    const dom = renderer.domElement;
    dom.addEventListener('dragover', (e) => {
      if (e.dataTransfer.types.includes('text/plain')) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }
    });
    dom.addEventListener('drop', (e) => {
      const kind = e.dataTransfer.getData('text/plain');
      if (!kind) return;
      e.preventDefault();
      this.placePaletteAtClient(kind, e.clientX, e.clientY, renderer, raycaster, mouse, camera);
    });
  }
}
