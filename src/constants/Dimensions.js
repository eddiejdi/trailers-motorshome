/**
 * Trailer dimension constants.
 *
 * All measurements are in meters unless otherwise noted.
 * Reference frame:
 *   - Z axis: front (hitch) = −Z, rear = +Z
 *   - X axis: left = −X, right = +X
 *   - Y axis: up
 */

// Chassis width (track + wheels)
export const W = 1.50;

// Outer body width (walls outside the wheels — "saia")
export const BODY_W = 1.90;

// Platform length
export const L = 3.00;

// Internal length
export const Lt = 2.90;

// Cargo bed height
export const Hc = 0.80;

// Internal height (floor-to-ceiling)
export const Hint = 1.80;

// Wall thickness
export const wth = 0.05;

// Internal width (BODY_W minus two walls)
export const Li = BODY_W - 2 * wth; // 1.80 m

// Mattress dimensions (Brazilian standard, not stretched)
export const MATTRESS_CASAL_L = 1.88;
export const MATTRESS_SOLTEIRO_L = 1.88;

// Mezzanine: outside the cargo bed, over the tongue
export const mzL = MATTRESS_CASAL_L;   // follows mattress length
export const mzW = BODY_W;              // same skin as body
export const mzIntH = 0.77;             // internal mezzanine height (aligned to roof)

// Chassis Y position: wheel radius → axle height
export const CHASSIS_Y = 0.28;

// Mezzanine floor height above cargo bed (for visibility inside)
export const mzFloorH = 1.50;

// Chassis beam dimensions (steel U/C profiles)
export const CHASSIS_BEAM_H = 0.15;  // height of the chassis beam
export const CHASSIS_BEAM_W = 0.06;  // width of the beam flange

// Joists (caibros) screwed on the rails to raise the Cargo bed floor
// so the water tanks fit above the axle, between the chassis rails.
export const JOIST_H = 0.26;

// Wall height (internal + top margin for roof curve)
export const WALL_H = Hint + 0.05;   // 1.85 m

// Roof parameters
export const ROOF_W = BODY_W;
export const ROOF_CURVE_R = 0.40;
export const ROOF_RISE = ROOF_CURVE_R;

// Door dimensions
export const DOOR_W = 0.62;
export const DOOR_H = 1.60;
export const DOOR_SILL = 0.08;

// Interior door dimensions
export const INT_DOOR_W = 0.55;
export const INT_DOOR_H = 1.70;
export const INT_SILL = 0.02;

// Bathroom cube
export const BATH_W = 0.80;

// Stair cabinet
export const N_STEPS = 4;
export const STAIR_W = 0.30;
export const TREAD_D = 0.34;

// Loft hatch
export const LOFT_HATCH_W = 0.78;
export const LOFT_HATCH_H = 0.70;

// Skirt (body panel below the floor)
export const SKIRT_T = 0.03;

// Wheel arch clearance
export const WHEEL_ARCH = 0.42;

// Floor thickness
export const FLOOR_T = 0.04;
