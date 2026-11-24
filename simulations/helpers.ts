import type { Ball, Ring, Segment } from "@/lib/engine/types";
import type { World } from "@/lib/engine/world";

export const TAU = Math.PI * 2;
/** default arena: centered circle under the HUD */
export const CX = 540;
export const CY = 1100;
export const R = 440;

export const rnd = (a: number, b: number) => a + Math.random() * (b - a);
export const rndInt = (a: number, b: number) => Math.floor(rnd(a, b + 1));
export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const hsl = (h: number, s = 90, l = 60) => `hsl(${Math.round(((h % 360) + 360) % 360)},${s}%,${l}%)`;

export const PALETTES: Record<string, string[]> = {
  neon: ["#ff2e88", "#00e5ff", "#ffe600", "#7cff4f", "#b14bff", "#ff7a1a"],
  candy: ["#ff8fab", "#ffc6ff", "#bdb2ff", "#a0c4ff", "#9bf6ff", "#caffbf"],
  sunset: ["#ff5f6d", "#ffc371", "#ff9a8b", "#f9f871", "#ff6a88", "#ffa94d"],
  ocean: ["#00b4d8", "#48cae4", "#90e0ef", "#0077b6", "#56cfe1", "#72efdd"],
  fire: ["#ff1e1e", "#ff6b00", "#ffb800", "#ffe45c", "#ff3d68", "#ff8c42"],
  mint: ["#2ee6a6", "#7af7c9", "#00d1b2", "#b5ffe1", "#43e97b", "#38f9d7"],
};

export const TEAM_COLORS = ["#ff3b5c", "#2ec4ff", "#ffd60a", "#3dff8a", "#b26bff", "#ff8a2a"];
export const TEAM_NAMES = ["RED", "BLUE", "YELLOW", "GREEN", "PURPLE", "ORANGE"];

export function circleArena(w: World, color: string, extra: Partial<Ring> = {}): Ring {
  return w.addRing(CX, CY, R, color, { inner: true, w: 10, ...extra });
}

export function randomInCircle(cx: number, cy: number, rad: number): [number, number] {
  const a = Math.random() * TAU;
  const d = Math.sqrt(Math.random()) * rad;
  return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
}

export function fillCircle(
  w: World,
  n: number,
  r: number | (() => number),
  color: (i: number) => string,
  speed = 300,
  rad = R - 40,
  opts: (i: number) => { team?: number; hue?: number } = () => ({}),
): Ball[] {
  const out: Ball[] = [];
  for (let i = 0; i < n; i++) {
    const [x, y] = randomInCircle(CX, CY, rad);
    const a = Math.random() * TAU;
    const rr = typeof r === "number" ? r : r();
    const b = w.spawn(x, y, Math.cos(a) * speed, Math.sin(a) * speed, rr, color(i), opts(i));
    if (b) out.push(b);
  }
  return out;
}

export interface Rotor {
  cx: number;
  cy: number;
  angle: number;
  omega: number;
  len: number;
  inner: number;
  segs: Segment[];
  update(dt: number): void;
}

export function makeRotor(
  w: World,
  cx: number,
  cy: number,
  arms: number,
  len: number,
  width: number,
  color: string,
  omega: number,
  inner = 0,
): Rotor {
  const segs: Segment[] = [];
  for (let i = 0; i < arms; i++) segs.push(w.addSeg(cx, cy, cx, cy, width, color, { cx, cy, tag: "rotor" }));
  const rotor: Rotor = {
    cx,
    cy,
    angle: 0,
    omega,
    len,
    inner,
    segs,
    update(dt: number) {
      rotor.angle += rotor.omega * dt;
      for (let i = 0; i < segs.length; i++) {
        const a = rotor.angle + (i * TAU) / segs.length;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const sg = segs[i];
        sg.ax = rotor.cx + c * rotor.inner;
        sg.ay = rotor.cy + s * rotor.inner;
        sg.bx = rotor.cx + c * rotor.len;
        sg.by = rotor.cy + s * rotor.len;
        sg.cx = rotor.cx;
        sg.cy = rotor.cy;
        sg.omega = rotor.omega;
      }
    },
  };
  rotor.update(0);
  return rotor;
}

/** keep balls moving: gently pull each ball's speed toward `target` */
export function keepSpeed(b: Ball, target: number, dt: number, k = 1.5): void {
  const sp = Math.hypot(b.vx, b.vy);
  if (sp < 1) {
    const a = Math.random() * TAU;
    b.vx = Math.cos(a) * target * 0.5;
    b.vy = Math.sin(a) * target * 0.5;
    return;
  }
  const f = 1 + ((target - sp) / sp) * Math.min(1, k * dt);
  b.vx *= f;
  b.vy *= f;
}

export function polygonSegs(
  w: World,
  cx: number,
  cy: number,
  rad: number,
  sides: number,
  rot: number,
  width: number,
  color: string,
): Segment[] {
  const segs: Segment[] = [];
  for (let i = 0; i < sides; i++) {
    const a0 = rot + (i * TAU) / sides;
    const a1 = rot + ((i + 1) * TAU) / sides;
    segs.push(
      w.addSeg(
        cx + Math.cos(a0) * rad,
        cy + Math.sin(a0) * rad,
        cx + Math.cos(a1) * rad,
        cy + Math.sin(a1) * rad,
        width,
        color,
        { cx, cy },
      ),
    );
  }
  return segs;
}

export function setPolygon(segs: Segment[], cx: number, cy: number, rad: number, rot: number, omega: number): void {
  const n = segs.length;
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n;
    const a1 = rot + ((i + 1) * TAU) / n;
    const s = segs[i];
    s.ax = cx + Math.cos(a0) * rad;
    s.ay = cy + Math.sin(a0) * rad;
    s.bx = cx + Math.cos(a1) * rad;
    s.by = cy + Math.sin(a1) * rad;
    s.cx = cx;
    s.cy = cy;
    s.omega = omega;
  }
}

export function pointInPolygon(x: number, y: number, pts: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(ax - bx, ay - by);
}

/** default tap behaviour: drop a ball at the point */
export function tapSpawn(w: World, x: number, y: number, r: number, color: string): void {
  const a = Math.random() * TAU;
  w.spawn(x, y, Math.cos(a) * 200, Math.sin(a) * 200, r, color, { hue: Math.random() * 360 });
  w.burst(x, y, color, 8, 250, 4);
}

export function fmt(n: number): string {
  return n.toLocaleString("en-US");
}
