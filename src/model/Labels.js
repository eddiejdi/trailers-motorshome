export default class Labels {
  constructor(THREE, { BODY_W, Li, Lt, W, WALL_H, FLOOR_Y, roofRise, mzFloorH, mzW, mzL }) {
    this.THREE = THREE;
    this.BODY_W = BODY_W;
    this.Li = Li;
    this.Lt = Lt;
    this.W = W;
    this.WALL_H = WALL_H;
    this.FLOOR_Y = FLOOR_Y;
    this.roofRise = roofRise;
    this.mzFloorH = mzFloorH;
    this.mzW = mzW;
    this.mzL = mzL;
    this.cotasGroup = null;
    this.labelsGroup = null;
  }

  fmtM(n, suffix = '') {
    return n.toFixed(2).replace('.', ',') + suffix;
  }

  cotaText(text, size = 160) {
    const { THREE } = this;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(0, 0, size, 50);
    ctx.strokeStyle = '#002288'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, 48 - 2);
    ctx.fillStyle = '#002288';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, 25);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    return new THREE.Sprite(mat);
  }

  cotaH(x1, x2, y, z, label) {
    const { THREE } = this;
    const cotasGroup = this.cotasGroup;
    const len = Math.abs(x2 - x1);
    const g = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, 0.008), new THREE.MeshBasicMaterial({ color: 0x002288 }));
    line.position.set((x1 + x2) / 2, y, z);
    g.add(line);
    for (const x of [x1, x2]) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 8), new THREE.MeshBasicMaterial({ color: 0x002288 }));
      a.rotation.z = x === x1 ? -Math.PI / 2 : Math.PI / 2;
      a.position.set(x, y, z);
      g.add(a);
    }
    const t = this.cotaText(label, 120);
    t.position.set((x1 + x2) / 2, y + 0.12, z);
    t.scale.set(0.4, 0.16, 1);
    g.add(t);
    cotasGroup.add(g);
  }

  cotaH_z(z1, z2, y, x, label) {
    const { THREE } = this;
    const cotasGroup = this.cotasGroup;
    const len = Math.abs(z2 - z1);
    const g = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.008, len), new THREE.MeshBasicMaterial({ color: 0x002288 }));
    line.position.set(x, y, (z1 + z2) / 2);
    g.add(line);
    for (const z of [z1, z2]) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 8), new THREE.MeshBasicMaterial({ color: 0x002288 }));
      a.rotation.x = z === z1 ? Math.PI / 2 : -Math.PI / 2;
      a.position.set(x, y, z);
      g.add(a);
    }
    const t = this.cotaText(label, 120);
    t.position.set(x, y + 0.12, (z1 + z2) / 2);
    t.scale.set(0.4, 0.16, 1);
    g.add(t);
    cotasGroup.add(g);
  }

  cotaV(y1, y2, x, z, label) {
    const { THREE } = this;
    const cotasGroup = this.cotasGroup;
    const len = Math.abs(y2 - y1);
    const g = new THREE.Group();
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.008, len, 0.008), new THREE.MeshBasicMaterial({ color: 0x002288 }));
    line.position.set(x, (y1 + y2) / 2, z);
    g.add(line);
    for (const y of [y1, y2]) {
      const a = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.10, 8), new THREE.MeshBasicMaterial({ color: 0x002288 }));
      a.rotation.x = y === y1 ? Math.PI : 0;
      a.position.set(x, y, z);
      g.add(a);
    }
    const t = this.cotaText(label, 100);
    t.position.set(x + 0.12, (y1 + y2) / 2, z);
    t.scale.set(0.35, 0.14, 1);
    g.add(t);
    cotasGroup.add(g);
  }

  label(text, x, y, z, color = '#2a2e36', size = 180) {
    const { THREE } = this;
    const labelsGroup = this.labelsGroup;
    const canvas = document.createElement('canvas');
    canvas.width = size; canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, size, 50);
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, 48);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, size / 2, 25);
    const tex = new THREE.CanvasTexture(canvas);
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const s = new THREE.Sprite(m);
    s.position.set(x, y, z);
    s.scale.set(0.5, 0.16, 1);
    s.name = text;
    s.userData.name = text;
    s.userData.kind = 'label';
    labelsGroup.add(s);
  }

  build(scene, dims) {
    const { THREE, BODY_W, Li, Lt, W, WALL_H, FLOOR_Y, roofRise, mzFloorH, mzW, mzL } = this;

    const cotasGroup = new THREE.Group();
    scene.add(cotasGroup);
    this.cotasGroup = cotasGroup;

    const zRoofFront = -Lt / 2 - mzL;
    this.cotaH(-W / 2, W / 2, -0.30, -Lt / 2 - mzL - 0.55, this.fmtM(W) + ' chassi');
    this.cotaH(-BODY_W / 2, BODY_W / 2, -0.30, -Lt / 2 - mzL - 0.35, this.fmtM(BODY_W) + ' caixa');
    this.cotaH(-Li / 2, Li / 2, -0.30, Lt / 2 + 0.20, this.fmtM(Li));
    this.cotaH_z(-Lt / 2, Lt / 2, -0.30, -W / 2 - 0.30, this.fmtM(Lt));
    this.cotaH_z(-Lt / 2 - mzL, -Lt / 2, -0.30, BODY_W / 2 + 0.30, this.fmtM(mzL));
    this.cotaV(0, roofRise + WALL_H + FLOOR_Y, W / 2 + 0.50, 0, this.fmtM(roofRise + WALL_H + FLOOR_Y));
    this.cotaV(0, mzFloorH, -mzW / 2 - 0.30, -Lt / 2 - mzL + 0.20, this.fmtM(mzFloorH));

    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);
    this.labelsGroup = labelsGroup;

    const kX = dims.kX || 0.22;
    const kZ = dims.kZ || Lt / 2 - 0.16;
    const stairX = dims.stairX || BODY_W / 2 - 0.15 - 0.30 / 2;
    const HATCH_Z = dims.HATCH_Z || -Lt / 2 + 0.08 + 0.34 * 3 + 0.34 / 2;
    const bedX = dims.bedX || -Li / 2 + 0.05 + 0.99 / 2;
    const bedZ = dims.bedZ || (-Lt / 2 + 0.05 + 0.80 + 0.03 + 1.60 / 2);
    const mzInnerZ = -Lt / 2 - mzL / 2;
    const colTopY = mzFloorH + 0.02;

    this.label('CUBO BANHEIRO 0,80×0,80', -Li / 2 + 0.40, 2.20, -Lt / 2 + 0.40);
    this.label('PORTA POTTI 365', -Li / 2 + 0.40, 0.80, -Lt / 2 + 0.40);
    this.label('COZINHA LINEAR', kX, 2.20, kZ);
    this.label('GELADEIRA 37L 12V', kX - 0.28, 0.80, kZ);
    this.label('PIA 40cm', kX + 0.22, 1.30, kZ);
    this.label('ARMARIOS-DEGRAU', stairX, 1.15, HATCH_Z + 0.40);
    this.label('VAO MEZANINO (C ou Espaco)', 0.25, FLOOR_Y + 1.55, -Lt / 2 + 0.08);
    this.label('CAMA SOLTEIRO 0,70×1,60', bedX, 0.85, bedZ);
    this.label('CAMACASAL (MEZANINO)', 0, mzFloorH + 1.30, mzInnerZ);
    this.label('FOGAREIRO EXTERNO', 0.35, 1.30, -Lt / 2 - 0.10);
    this.label('PAINEl SOLAR 50W', 0, FLOOR_Y + WALL_H + 0.30, 0.20);
    this.label('GALAO AGUA LIMPA 20L', kX + 0.28, 0.80, kZ);
    this.label('BATERIA 12V', W / 2 - 0.25, 0.10, Lt / 2 - 0.30);

    const nArrow = new THREE.Mesh(new THREE.ConeGeometry(0.10, 0.30, 4), new THREE.MeshBasicMaterial({ color: 0xaa0000 }));
    nArrow.position.set(-3.5, 0.15, 0);
    nArrow.rotation.x = Math.PI / 2;
    nArrow.rotation.z = -Math.PI / 2;
    scene.add(nArrow);
    const nLabel = this.cotaText('N', 60);
    nLabel.position.set(-3.5, 0.40, 0);
    nLabel.scale.set(0.20, 0.20, 1);
    scene.add(nLabel);

    return { cotasGroup, labelsGroup };
  }
}
