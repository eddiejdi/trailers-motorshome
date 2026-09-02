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
  constructor({ interior, FLOOR_Y, editableMeshes, pushUndoFn, resolvePlacementFn, selectObjectFn, addEditableFn, uniqueNameFn, roofTopFn, makeHingedDoorFn, makeRvWindowFn, makeDinetteGroupFn, M, matFn, weightService }) {
    this.interior = interior;
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
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.015, 0.015), new THREE.MeshStandardMaterial({ color: 0x333333 }));
      mesh.position.set(0, roofTop(0) + 0.01, 0); name = 'LED Strip 5m'; cat = 'eletrica';
    } else if (kind === 'plafon') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.025, 16), new THREE.MeshStandardMaterial({ color: 0xf0f0f0, emissive: 0xfff8e0, emissiveIntensity: 0.3 }));
      mesh.position.set(0, roofTop(0) - 0.01, 0); name = 'Plafon LED Ø140'; cat = 'eletrica';
    } else if (kind === 'boiler') {
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.40, 16), new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.5 }));
      mesh.position.set(0.35, 0.20, -0.55); name = 'Boiler 10L'; cat = 'encanamento';
    } else if (kind === 'janela' || kind.indexOf('janela-') === 0) {
      const specs = {
        janela: [0.50, 0.50, 'Janela 50×50'],
        'janela-50x35': [0.50, 0.35, 'Janela SANJO 50×35'],
        'janela-70x40': [0.70, 0.40, 'Janela SANJO 70×40'],
      };
      const sp = specs[kind] || specs.janela;
      mesh = this.makeRvWindow(sp[0], sp[1]);
      mesh.position.set(0, 1.20, 0);
      name = sp[2]; cat = 'paredes';
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
