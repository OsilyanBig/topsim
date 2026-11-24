export interface Ball {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  m: number;
  color: string;
  hue: number;
  team: number;
  alive: boolean;
  escaped: boolean;
  age: number;
  /** generic cooldown (seconds) used by split / clone rules */
  cd: number;
  gen: number;
  /** bitmask for per-ball flags (gates passed, side, etc.) */
  flags: number;
  flash: number;
}

export interface Segment {
  id: number;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** thickness */
  w: number;
  /** rotation pivot + angular velocity, used for surface velocity */
  cx: number;
  cy: number;
  omega: number;
  vx: number;
  vy: number;
  color: string;
  on: boolean;
  visible: boolean;
  /** if set, balls on the side of this normal are blocked, balls from the other side pass */
  oneWay?: { nx: number; ny: number };
  bounce?: number;
  hp?: number;
  group?: number;
  tag?: string;
  flash: number;
}

export interface Peg {
  id: number;
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  /** radial velocity (growing/shrinking core) */
  vr: number;
  color: string;
  bounce?: number;
  on: boolean;
  visible: boolean;
  tag?: string;
  flash: number;
}

export interface Gap {
  /** center angle (radians, relative to ring rotation) */
  a: number;
  /** angular width (radians) */
  w: number;
}

export interface Ring {
  id: number;
  cx: number;
  cy: number;
  r: number;
  w: number;
  rot: number;
  omega: number;
  gaps: Gap[];
  color: string;
  /** inner = container (balls stay inside), otherwise two-sided thin ring */
  inner: boolean;
  visible: boolean;
  flash: number;
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  openTop?: boolean;
  openBottom?: boolean;
  color: string;
  visible: boolean;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
}

export interface FloatText {
  text: string;
  x: number;
  y: number;
  life: number;
  max: number;
  size: number;
  color: string;
}

export type SfxKind =
  | "hit"
  | "tap"
  | "split"
  | "pop"
  | "break"
  | "boom"
  | "bump"
  | "win"
  | "whoosh";

export interface HudBar {
  color: string;
  value: number;
}

export interface Hud {
  main: string;
  sub?: string;
  progress?: number;
  bars?: HudBar[];
}

export interface WorldHooks {
  onWall?(b: Ball, impact: number, nx: number, ny: number): void;
  onSeg?(b: Ball, s: Segment, impact: number, px: number, py: number): void;
  onPeg?(b: Ball, p: Peg, impact: number): void;
  onRing?(b: Ball, r: Ring, impact: number): void;
  onBall?(a: Ball, b: Ball, impact: number): void;
  onEscape?(b: Ball): void;
  onLeave?(b: Ball): void;
  /** per-ball custom force; add to velocity directly using dt */
  force?(b: Ball, dt: number): void;
}
