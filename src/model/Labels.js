export default class Labels {
  constructor(THREE, { BODY_W, Li, Lt, W, WALL_H, FLOOR_Y, mzFloorH, mzW, mzL }) {
    this.THREE = THREE;
    this.BODY_W = BODY_W;
    this.Li = Li;
    this.Lt = Lt;
    this.W = W;
    this.WALL_H = WALL_H;
    this.FLOOR_Y = FLOOR_Y;
    this.mzFloorH = mzFloorH;
    this.mzW = mzW;
    this.mzL = mzL;
    this.cotasGroup = null;
    this.labelsGroup = null;
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
    const { THREE, BODY_W, Li, Lt, W, WALL_H, FLOOR_Y, mzFloorH, mzW, mzL } = this;

    const cotasGroup = new THREE.Group();
    scene.add(cotasGroup);
    this.cotasGroup = cotasGroup;

    const zRoofFront = -Lt / 2 - mzL;
    this.cotaH(-W / 2, W / 2, -0.30, -Lt / 2 - mzL - 0.55, '1,50 chassi');
    this.cotaH(-BODY_W / 2, BODY_W / 2, -0.30, -Lt / 2 - mzL - 0.35, '1,90 caixa');
    this.cotaH(-Li / 2, Li / 2, -0.30, Lt / 2 + 0.20, '1,80');
    this.cotaH_z(-Lt / 2, Lt / 2, -0.30, -W / 2 - 0.30, '2,90');
    this.cotaH_z(-Lt / 2 - mzL, -Lt / 2, -0.30, BODY_W / 2 + 0.30, '1,88');
    this.cotaV(0, WALL_H + FLOOR_Y, W / 2 + 0.50, 0, '2,65');
    this.cotaV(0, mzFloorH, -mzW / 2 - 0.30, -Lt / 2 - mzL + 0.20, '1,30');

    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);
    this.labelsGroup = labelsGroup;
    // Labels de peças/layout vêm do JSON do projeto — factory não hardcoda nomes.

    return { cotasGroup, labelsGroup };
  }
}
