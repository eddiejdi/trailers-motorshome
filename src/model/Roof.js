export default class Roof {
  constructor(THREE, M, { BODY_W, Lt, WALL_H, zRoofFront, zRoofRear, roofTotalL, roofCurveR, roofRise, roofFlatStart, roofFlatEnd, roofY, roofTop }) {
    this.THREE = THREE;
    this.M = M;
    this.BODY_W = BODY_W;
    this.Lt = Lt;
    this.WALL_H = WALL_H;
    this.zRoofFront = zRoofFront;
    this.zRoofRear = zRoofRear;
    this.roofTotalL = roofTotalL;
    this.roofCurveR = roofCurveR;
    this.roofRise = roofRise;
    this.roofFlatStart = roofFlatStart;
    this.roofFlatEnd = roofFlatEnd;
    this.roofY = roofY;
    this.roofTop = roofTop;
    this.group = null;
  }

  build() {
    const { THREE, M, BODY_W, WALL_H, zRoofFront, zRoofRear, roofTotalL, roofY } = this;
    const roofGroup = new THREE.Group();

    const roofW = BODY_W;
    const roofSegs = 40;
    const roofWSegs = 10;
    const halfW = roofW / 2;
    const rVerts = [], rIdx = [], rUVs = [];
    const cols = roofWSegs + 1;
    const rows = roofSegs + 1;
    for (let ix = 0; ix <= roofWSegs; ix++) {
      const x = -halfW + ix * (roofW / roofWSegs);
      for (let iz = 0; iz <= roofSegs; iz++) {
        const t = iz / roofSegs;
        const z = zRoofFront + t * roofTotalL;
        rVerts.push(x, roofY(z), z);
        rUVs.push(ix / roofWSegs, t);
      }
    }
    for (let ix = 0; ix < roofWSegs; ix++) {
      for (let iz = 0; iz < roofSegs; iz++) {
        const a = ix * rows + iz;
        const b = a + 1;
        const c = a + rows;
        const d = c + 1;
        rIdx.push(a, b, c, b, d, c);
      }
    }
    const roofGeo = new THREE.BufferGeometry();
    roofGeo.setAttribute('position', new THREE.Float32BufferAttribute(rVerts, 3));
    roofGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUVs, 2));
    roofGeo.setIndex(rIdx);
    roofGeo.computeVertexNormals();

    const roofMesh = new THREE.Mesh(roofGeo, M.telhado);
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    roofGroup.add(roofMesh);

    const addEaveRibbon = (sx, xOut) => {
      const segs = 56;
      const verts = [], idx = [];
      const drop = 0.045;
      const out = xOut;
      for (let i = 0; i <= segs; i++) {
        const z = zRoofFront + (i / segs) * roofTotalL;
        const y = roofY(z);
        verts.push(sx, y, z, sx + out, y, z, sx + out, y - drop, z, sx, y - drop, z);
        if (i > 0) {
          const b = (i - 1) * 4, c = i * 4;
          idx.push(b, c, b + 1, c, c + 1, b + 1);
          idx.push(b + 1, c + 1, b + 2, c + 1, c + 2, b + 2);
          idx.push(b + 2, c + 2, b + 3, c + 2, c + 3, b + 3);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, M.aluminioD);
      m.castShadow = true;
      roofGroup.add(m);
    };
    addEaveRibbon(-halfW, -0.04);
    addEaveRibbon(halfW, 0.04);

    const addEndEave = (zPos) => {
      const e = new THREE.Mesh(new THREE.BoxGeometry(roofW + 0.08, 0.045, 0.04), M.aluminioD);
      e.position.set(0, roofY(zPos) - 0.02, zPos);
      roofGroup.add(e);
    };
    addEndEave(zRoofFront);
    addEndEave(zRoofRear);

    roofGroup.position.set(0, WALL_H, 0);
    this.group = roofGroup;
    return roofGroup;
  }
}
