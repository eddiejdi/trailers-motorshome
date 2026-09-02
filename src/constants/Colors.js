/**
 * Color palette and material factory for the trailer 3D project.
 *
 * C — flat colour constants (hex integers for THREE.js)
 * M — pre-built MeshStandardMaterial instances
 * mat — factory function to create new materials with project defaults
 */

// ============ COLOURS (technical, flat) ============
export const C = {
  chassis:    0x2a2e36,
  madeira:    0xd4b483,
  madeiraD:   0xa08050,
  piso:       0xb89060,
  aluminio:   0xc8c8c8,
  aluminioD:  0x8a8a8a,
  eps:        0xf0d848,
  vidro:      0xb8d4e8,
  colchaoC:   0xd08080,
  colchaoS:   0x80c0a0,
  vaso:       0xf8f8f8,
  travesseiro: 0xf0f0e0,
  geladeira:  0xb0b0b0,
  escada:     0xe0a040,
  planta:     0x4a8a4a,
  cota:       0x002288,
  eixo:       0xaa0000,
  chao:       0xe0dcc8,
  grid:       0xb8b0a0,
};

/**
 * Material factory — returns a MeshStandardMaterial with project-wide defaults.
 * @param {number} color   hex colour
 * @param {Object} [opts]  additional material properties
 * @returns {THREE.MeshStandardMaterial}
 */
export function mat(color, opts = {}, THREE) {
  return new THREE.MeshStandardMaterial(Object.assign({
    color,
    roughness: 0.7,
    metalness: 0.1,
    flatShading: true,  // technical-project visual style
  }, opts));
}

/**
 * Create the pre-built material set.
 * Must be called once with the THREE instance after it is loaded.
 * @param {Object} THREE
 * @returns {Object} M — material dictionary
 */
export function createMaterials(THREE) {
  const _mat = (color, opts = {}) => mat(color, opts, THREE);

  return {
    chassis:    _mat(C.chassis, { metalness: 0.6, roughness: 0.5 }),
    madeira:    _mat(C.madeira),
    madeiraD:   _mat(C.madeiraD),
    parede:     _mat(C.madeira, { side: THREE.DoubleSide, roughness: 0.72 }),
    paredeD:    _mat(C.madeiraD, { side: THREE.DoubleSide, roughness: 0.7 }),
    piso:       _mat(C.piso, { roughness: 0.9 }),
    aluminio:   _mat(C.aluminio, { metalness: 0.7, roughness: 0.4 }),
    aluminioD:  _mat(C.aluminioD, { metalness: 0.6, roughness: 0.5 }),
    aluRib:     _mat(0xd4d4d0, { metalness: 0.82, roughness: 0.32 }),
    telhado:    _mat(0x8e949a, { metalness: 0.5, roughness: 0.42, side: THREE.DoubleSide }),
    eps:        _mat(C.eps, { roughness: 0.95 }),
    vidro:      _mat(C.vidro, {
      transparent: true, opacity: 0.18, roughness: 0.04,
      metalness: 0.15, depthWrite: false, side: THREE.DoubleSide,
    }),
    colchaoC:   _mat(C.colchaoC, { roughness: 0.95 }),
    colchaoS:   _mat(C.colchaoS, { roughness: 0.95 }),
    vaso:       _mat(C.vaso, { roughness: 0.4 }),
    travesseiro: _mat(C.travesseiro, { roughness: 0.95 }),
    geladeira:  _mat(C.geladeira, { metalness: 0.5, roughness: 0.4 }),
    escada:     _mat(C.escada, { roughness: 0.6 }),
    planta:     _mat(C.planta, { roughness: 0.9 }),
  };
}
