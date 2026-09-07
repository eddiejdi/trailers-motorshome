export default class Chassis {
  constructor(THREE, M, { W, BODY_W, L, CHASSIS_Y, JOIST_H }) {
    this.THREE = THREE;
    this.M = M;
    this.W = W;
    this.BODY_W = BODY_W;
    this.L = L;
    this.CHASSIS_Y = CHASSIS_Y;
    this.chassisBeamH = 0.15;
    this.chassisBeamW = 0.06;
    this.JOIST_H = JOIST_H || 0.24;
    this.group = null;
  }

  build() {
    const { THREE, M, W, BODY_W, L, CHASSIS_Y, chassisBeamH, chassisBeamW } = this;
    const JOIST_H = this.JOIST_H;
    const chassisG = new THREE.Group();

    const railTop = CHASSIS_Y + 0.04 + chassisBeamH;
    const deckTop = railTop + JOIST_H;

    // Caibros de madeira parafusados sobre as longarinas (suspendem o assoalho
    // até a altura das rodas, criando o vão entre as longarinas para as caixas
    // de água ficarem acima do eixo com espaço para a suspensão).
    const caibroPos = [-W / 2 + chassisBeamW / 2, 0, W / 2 - chassisBeamW / 2];
    for (const cx of caibroPos) {
      const base = cx === 0 ? CHASSIS_Y + 0.04 + chassisBeamH * 0.7 : railTop;
      const hgt = deckTop - base;
      const caibro = new THREE.Mesh(new THREE.BoxGeometry(0.06, hgt, L), M.madeiraD);
      caibro.position.set(cx, base + hgt / 2, 0);
      caibro.castShadow = true;
      chassisG.add(caibro);
      for (const sz of [-1.2, -0.6, 0, 0.6, 1.2]) {
        const par = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 8), M.chassis);
        par.position.set(cx, deckTop - 0.015, sz);
        par.rotation.x = Math.PI / 2;
        chassisG.add(par);
      }
    }

    const floor = new THREE.Mesh(new THREE.BoxGeometry(W, 0.04, L), M.chassis);
    floor.position.y = deckTop + 0.02;
    floor.castShadow = true; floor.receiveShadow = true;
    chassisG.add(floor);

    for (const sx of [-W / 2 + chassisBeamW / 2, W / 2 - chassisBeamW / 2]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(chassisBeamW, chassisBeamH, L), M.chassis);
      rail.position.set(sx, CHASSIS_Y + 0.04 + chassisBeamH / 2, 0);
      rail.castShadow = true;
      chassisG.add(rail);
    }

    for (const sz of [-L / 2 + 0.20, -0.5, 0.0, 0.5, L / 2 - 0.20]) {
      const tr = new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.04, chassisBeamW), M.chassis);
      tr.position.set(0, CHASSIS_Y + 0.04 + chassisBeamH - 0.02, sz);
      chassisG.add(tr);
    }

    const centerRail = new THREE.Mesh(new THREE.BoxGeometry(0.05, chassisBeamH * 0.7, L - 0.40), M.chassis);
    centerRail.position.set(0, CHASSIS_Y + 0.04 + chassisBeamH * 0.35, 0);
    chassisG.add(centerRail);

    for (const sx of [-W / 2, W / 2]) {
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 }));
      tire.rotation.z = Math.PI / 2;
      tire.position.set(sx, 0.28, 0);
      tire.castShadow = true;
      chassisG.add(tire);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.19, 12), M.aluminioD);
      rim.rotation.z = Math.PI / 2;
      rim.position.copy(tire.position);
      chassisG.add(rim);
      const fender = new THREE.Mesh(
        new THREE.CylinderGeometry(0.30, 0.30, 0.03, 16, 1, true, Math.PI, Math.PI),
        M.chassis
      );
      fender.rotation.y = Math.PI / 2;
      fender.position.set(sx, 0.30, 0);
      chassisG.add(fender);
    }

    const tongueH = CHASSIS_Y + 0.04 + chassisBeamH / 2;
    const tongueEndZ = -L / 2 - 0.90;
    const tongueStartZ = -L / 2;
    for (const sx of [-W / 2 + 0.10, W / 2 - 0.10]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 1.00), M.chassis);
      const midX = (sx + 0) / 2;
      const len = Math.hypot(sx, tongueEndZ - tongueStartZ);
      beam.scale.set(1, 1, len / 1.00);
      beam.position.set(midX, tongueH, (tongueStartZ + tongueEndZ) / 2);
      beam.rotation.y = Math.atan2(0 - sx, tongueEndZ - tongueStartZ);
      beam.castShadow = true;
      chassisG.add(beam);
    }

    const hitchMount = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 12), M.chassis);
    hitchMount.position.set(0, tongueH - 0.02, tongueEndZ + 0.04);
    chassisG.add(hitchMount);
    const hitch = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), M.chassis);
    hitch.position.set(0, tongueH, tongueEndZ);
    chassisG.add(hitch);

    const jack = new THREE.Group();
    const jp = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), M.chassis);
    jp.position.y = -0.12;
    jack.add(jp);
    const jf = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.20), M.chassis);
    jf.position.y = -0.34;
    jack.add(jf);
    const jh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.15, 6), M.aluminio);
    jh.rotation.z = Math.PI / 2;
    jh.position.set(0.10, 0.05, 0);
    jack.add(jh);
    jack.position.set(0.18, tongueH, tongueEndZ + 0.20);
    chassisG.add(jack);

    this.group = chassisG;
    return chassisG;
  }
}
