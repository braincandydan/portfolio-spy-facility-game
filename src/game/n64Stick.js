// N64-style analog stick processing: octagonal gate, deadzone, and response curve.
// Pure functions — no DOM or Three.js. Feed raw [-1,1] stick values in, get
// GoldenEye-ready walk/turn magnitudes out.

/** N64 stick housing was an octagon — diagonals can't reach full circular magnitude. */
export function clampToOctagon(x, y) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax < 1e-8 && ay < 1e-8) return { x: 0, y: 0 };

  // Regular octagon: |x| + |y| <= √2  (for unit circle that touches at axes)
  // Scale so axis extrema remain at 1.
  const limit = Math.SQRT2;
  const manhattan = ax + ay;
  if (manhattan <= limit) return { x, y };

  const scale = limit / manhattan;
  return { x: x * scale, y: y * scale };
}

/**
 * Apply deadzone then power-curve response.
 * @param {number} v  raw axis in [-1, 1] (already gate-clamped)
 * @param {number} deadzone  fraction of range treated as zero (default ~N64 center play)
 * @param {number} power  >1 softens near center (walk→run ramp)
 */
export function applyCurve(v, deadzone = 0.12, power = 1.6) {
  const sign = v < 0 ? -1 : 1;
  const a = Math.abs(v);
  if (a <= deadzone) return 0;
  const t = (a - deadzone) / (1 - deadzone);
  return sign * Math.pow(Math.min(1, t), power);
}

/**
 * Process a raw joystick sample into GoldenEye "Honey" control outputs.
 * Y = walk forward/back (analog speed), X = turn (analog turn rate). No strafe.
 *
 * @returns {{ walk: number, turn: number, x: number, y: number }}
 *   walk/turn in [-1, 1]; x/y are gate-clamped raw for UI knob display.
 */
export function processStick(rawX, rawY, {
  deadzone = 0.1,
  walkPower = 1.45,
  turnPower = 1.15,
} = {}) {
  const gated = clampToOctagon(
    Math.max(-1, Math.min(1, rawX)),
    Math.max(-1, Math.min(1, rawY)),
  );
  return {
    x: gated.x,
    y: gated.y,
    walk: applyCurve(gated.y, deadzone, walkPower),
    turn: applyCurve(gated.x, deadzone, turnPower),
  };
}

/** Max turn rate (rad/s) at full stick deflection. */
export const TURN_RATE = 2.9;

/** Walk speed (units/s) at full forward stick. */
export const WALK_SPEED = 7.2;

/** How fast pitch eases back to level while walking (1/s). */
export const PITCH_RECENTER = 2.8;

/** Aim-mode crosshair half-extents in NDC (-1..1 screen space). */
export const AIM_BOX = 0.55;

/** Stick → crosshair speed while aiming (NDC units/s at full deflection). */
export const AIM_STICK_SPEED = 1.8;

/** Camera turn/pitch when crosshair is pushed to the aim-box edge (rad/s). */
export const AIM_EDGE_TURN = 1.6;
export const AIM_EDGE_PITCH = 1.2;
