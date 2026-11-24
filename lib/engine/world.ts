import type {
  Ball,
  Bounds,
  FloatText,
  Particle,
  Peg,
  Ring,
  Segment,
  SfxKind,
  WorldHooks,
} from "./types";

export const W = 1080;
export const H = 1920;

const TAU = Math.PI * 2;
const MARGIN = 300;

export function normAngle(a: number): number {
  a %= TAU;
  if (a > Math.PI) a -= TAU;
  if (a < -Math.PI) a += TAU;
  return a;
}

export interface SpawnOpts {
  team?: number;
  hue?: number;
  gen?: number;
  flags?: number;
  cd?: number;
}

/**
 * Lightweight 2D ball physics world: circular balls, static/kinematic line
 * segments, round pegs, (rotating) rings with gaps, and box bounds.
 * Uses fixed substeps and a uniform spatial hash for ball-ball contacts.
 */
export class World {
  readonly W = W;
  readonly H = H;

  balls: Ball[] = [];
  private pending: Ball[] = [];
  segs: Segment[] = [];
  pegs: Peg[] = [];
  rings: Ring[] = [];
  bounds: Bounds | null = null;

  gravity = { x: 0, y: 1400 };
  wallRestitution = 0.9;
  ballRestitution = 0.9;
  friction = 0.01;
  /** linear damping per second (0 = none) */
  drag = 0;
  ballCollisions = true;
  maxBalls = 1200;
  maxSpeed = 2600;
  substeps = 4;
  soundThreshold = 140;

  t = 0;
  hooks: WorldHooks = {};
  particles: Particle[] = [];
  texts: FloatText[] = [];
  shakeAmt = 0;
  completed = false;
  completeMsg = "";
  completeAt = 0;
  autoRestart = true;
  /** set by the studio, receives sound requests */
  sfx: (kind: SfxKind, intensity: number, r: number, x: number) => void = () => {};
  onComplete: () => void = () => {};

  private nextId = 1;
  private inStep = false;
  // spatial hash buffers
  private head = new Int32Array(0);
  private next = new Int32Array(0);
  private cxs = new Int32Array(0);
  private cys = new Int32Array(0);

  get count(): number {
    return this.balls.length + this.pending.length;
  }

  allBalls(): Ball[] {
    return this.pending.length ? this.balls.concat(this.pending) : this.balls;
  }

  spawn(
    x: number,
    y: number,
    vx: number,
    vy: number,
    r: number,
    color: string,
    o: SpawnOpts = {},
  ): Ball | null {
    if (this.count >= this.maxBalls) return null;
    const b: Ball = {
      id: this.nextId++,
      x,
      y,
      vx,
      vy,
      r,
      m: r * r,
      color,
      hue: o.hue ?? 0,
      team: o.team ?? 0,
      alive: true,
      escaped: false,
      age: 0,
      cd: o.cd ?? 0,
      gen: o.gen ?? 0,
      flags: o.flags ?? 0,
      flash: 0,
    };
    if (this.inStep) this.pending.push(b);
    else this.balls.push(b);
    return b;
  }

  /** clone a ball with its velocity rotated by `angle` */
  clone(b: Ball, angle: number, speedMul = 1, rMul = 1, color?: string): Ball | null {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const vx = (b.vx * c - b.vy * s) * speedMul;
    const vy = (b.vx * s + b.vy * c) * speedMul;
    const r = Math.max(2, b.r * rMul);
    // offset perpendicular to velocity so the two don't sit on top of each other
    const sp = Math.hypot(vx, vy) || 1;
    const ox = (-vy / sp) * r * 0.6;
    const oy = (vx / sp) * r * 0.6;
    return this.spawn(b.x + ox, b.y + oy, vx, vy, r, color ?? b.color, {
      team: b.team,
      hue: b.hue,
      gen: b.gen + 1,
      flags: b.flags,
      cd: b.cd,
    });
  }

  kill(b: Ball): void {
    b.alive = false;
  }

  addSeg(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    w: number,
    color: string,
    extra: Partial<Segment> = {},
  ): Segment {
    const s: Segment = {
      id: this.nextId++,
      ax,
      ay,
      bx,
      by,
      w,
      cx: 0,
      cy: 0,
      omega: 0,
      vx: 0,
      vy: 0,
      color,
      on: true,
      visible: true,
      flash: 0,
      ...extra,
    };
    this.segs.push(s);
    return s;
  }

  addPeg(x: number, y: number, r: number, color: string, extra: Partial<Peg> = {}): Peg {
    const p: Peg = {
      id: this.nextId++,
      x,
      y,
      r,
      vx: 0,
      vy: 0,
      vr: 0,
      color,
      on: true,
      visible: true,
      flash: 0,
      ...extra,
    };
    this.pegs.push(p);
    return p;
  }

  addRing(
    cx: number,
    cy: number,
    r: number,
    color: string,
    extra: Partial<Ring> = {},
  ): Ring {
    const ring: Ring = {
      id: this.nextId++,
      cx,
      cy,
      r,
      w: 10,
      rot: 0,
      omega: 0,
      gaps: [],
      color,
      inner: false,
      visible: true,
      flash: 0,
      ...extra,
    };
    this.rings.push(ring);
    return ring;
  }

  burst(x: number, y: number, color: string, n = 10, speed = 400, size = 5): void {
    const room = 700 - this.particles.length;
    n = Math.min(n, room);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.3 + Math.random() * 0.7);
      const life = 0.35 + Math.random() * 0.45;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life,
        max: life,
        r: size * (0.5 + Math.random() * 0.7),
        color,
      });
    }
  }

  text(text: string, x: number, y: number, color = "#fff", size = 54, life = 0.9): void {
    if (this.texts.length > 40) this.texts.shift();
    this.texts.push({ text, x, y, color, size, life, max: life });
  }

  shake(a: number): void {
    this.shakeAmt = Math.min(40, Math.max(this.shakeAmt, a));
  }

  complete(msg = "COMPLETE!", restart = true): void {
    if (this.completed) return;
    this.completed = true;
    this.completeMsg = msg;
    this.completeAt = this.t;
    this.autoRestart = restart;
    this.sfx("win", 1, 20, W / 2);
    this.onComplete();
  }

  // ---------------------------------------------------------------- step

  step(dt: number): void {
    // keep the physics sub-step around <= 1/240s, even when sped up
    const n = Math.min(14, Math.max(this.substeps, Math.ceil(dt * 240)));
    const h = dt / n;
    this.inStep = true;
    for (let i = 0; i < n; i++) this.substep(h);
    this.inStep = false;

    // finalize: remove dead, add pending
    let j = 0;
    const arr = this.balls;
    for (let i = 0; i < arr.length; i++) {
      const b = arr[i];
      if (b.alive) arr[j++] = b;
    }
    arr.length = j;
    if (this.pending.length) {
      for (const b of this.pending) if (b.alive) arr.push(b);
      this.pending.length = 0;
    }

    // per-frame bookkeeping
    for (const b of arr) {
      b.age += dt;
      if (b.cd > 0) b.cd -= dt;
      if (b.flash > 0) b.flash -= dt * 3;
    }
    for (const s of this.segs) if (s.flash > 0) s.flash -= dt * 3;
    for (const p of this.pegs) if (p.flash > 0) p.flash -= dt * 3;
    for (const r of this.rings) if (r.flash > 0) r.flash -= dt * 3;

    const ps = this.particles;
    let k = 0;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += 700 * dt;
      p.vx *= 1 - 1.5 * dt;
      p.vy *= 1 - 1.5 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ps[k++] = p;
    }
    ps.length = k;
    const ts = this.texts;
    k = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i];
      t.life -= dt;
      t.y -= 60 * dt;
      if (t.life > 0) ts[k++] = t;
    }
    ts.length = k;
    this.shakeAmt *= Math.pow(0.0015, dt);
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;
    this.t += dt;
  }

  private substep(h: number): void {
    const balls = this.balls;
    const gx = this.gravity.x;
    const gy = this.gravity.y;
    const drag = this.drag > 0 ? Math.max(0, 1 - this.drag * h) : 1;
    const maxV = this.maxSpeed;
    const force = this.hooks.force;

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (!b.alive) continue;
      b.vx += gx * h;
      b.vy += gy * h;
      if (force) force(b, h);
      if (drag !== 1) {
        b.vx *= drag;
        b.vy *= drag;
      }
      const sp2 = b.vx * b.vx + b.vy * b.vy;
      if (sp2 > maxV * maxV) {
        const k = maxV / Math.sqrt(sp2);
        b.vx *= k;
        b.vy *= k;
      }
      b.x += b.vx * h;
      b.y += b.vy * h;
    }

    if (this.ballCollisions) this.collideBalls();

    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (!b.alive) continue;
      for (let k = 0; k < this.pegs.length; k++) {
        const p = this.pegs[k];
        if (p.on) this.collidePeg(b, p);
      }
      for (let k = 0; k < this.segs.length; k++) {
        const s = this.segs[k];
        if (s.on) this.collideSeg(b, s);
      }
      for (let k = 0; k < this.rings.length; k++) this.collideRing(b, this.rings[k]);
      if (this.bounds) this.collideBounds(b, this.bounds);
      if (
        b.y > H + MARGIN ||
        b.y < -MARGIN * 2 ||
        b.x < -MARGIN ||
        b.x > W + MARGIN
      ) {
        b.alive = false;
        this.hooks.onLeave?.(b);
      }
    }
  }

  /** resolve velocity against a surface; returns impact speed (>0) */
  private resolve(
    b: Ball,
    nx: number,
    ny: number,
    ux: number,
    uy: number,
    e: number,
  ): number {
    let rvx = b.vx - ux;
    let rvy = b.vy - uy;
    const vn = rvx * nx + rvy * ny;
    if (vn >= 0) return 0;
    const tvx = rvx - vn * nx;
    const tvy = rvy - vn * ny;
    const f = 1 - this.friction;
    rvx = tvx * f - e * vn * nx;
    rvy = tvy * f - e * vn * ny;
    b.vx = rvx + ux;
    b.vy = rvy + uy;
    return -vn;
  }

  private sound(kind: SfxKind, impact: number, b: Ball): void {
    if (impact > this.soundThreshold) this.sfx(kind, Math.min(1, impact / 1600), b.r, b.x);
  }

  private collideBalls(): void {
    const balls = this.balls;
    const n = balls.length;
    if (n < 2) return;
    let maxR = 4;
    for (let i = 0; i < n; i++) if (balls[i].r > maxR) maxR = balls[i].r;
    const cs = Math.max(24, maxR * 2);
    const ox = MARGIN;
    const oy = MARGIN * 2;
    const cols = Math.ceil((W + MARGIN * 2) / cs) + 1;
    const rows = Math.ceil((H + MARGIN * 3) / cs) + 1;
    const cells = cols * rows;
    if (this.head.length < cells) this.head = new Int32Array(cells);
    if (this.next.length < n) {
      const size = Math.max(n, 256) * 2;
      this.next = new Int32Array(size);
      this.cxs = new Int32Array(size);
      this.cys = new Int32Array(size);
    }
    const head = this.head;
    const next = this.next;
    const cxs = this.cxs;
    const cys = this.cys;
    head.fill(-1, 0, cells);
    for (let i = 0; i < n; i++) {
      const b = balls[i];
      let cx = Math.floor((b.x + ox) / cs);
      let cy = Math.floor((b.y + oy) / cs);
      if (cx < 0) cx = 0;
      else if (cx >= cols) cx = cols - 1;
      if (cy < 0) cy = 0;
      else if (cy >= rows) cy = rows - 1;
      cxs[i] = cx;
      cys[i] = cy;
      const c = cy * cols + cx;
      next[i] = head[c];
      head[c] = i;
    }
    const e = this.ballRestitution;
    const onBall = this.hooks.onBall;
    for (let i = 0; i < n; i++) {
      const a = balls[i];
      if (!a.alive) continue;
      const cx = cxs[i];
      const cy = cys[i];
      for (let yy = cy - 1; yy <= cy + 1; yy++) {
        if (yy < 0 || yy >= rows) continue;
        for (let xx = cx - 1; xx <= cx + 1; xx++) {
          if (xx < 0 || xx >= cols) continue;
          let j = head[yy * cols + xx];
          while (j !== -1) {
            if (j > i) {
              const b = balls[j];
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const rs = a.r + b.r;
              const d2 = dx * dx + dy * dy;
              if (d2 < rs * rs && d2 > 1e-9 && b.alive) {
                const d = Math.sqrt(d2);
                const nx = dx / d;
                const ny = dy / d;
                const pen = rs - d;
                const ia = 1 / a.m;
                const ib = 1 / b.m;
                const it = ia + ib;
                a.x -= nx * pen * (ia / it);
                a.y -= ny * pen * (ia / it);
                b.x += nx * pen * (ib / it);
                b.y += ny * pen * (ib / it);
                const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
                if (rv < 0) {
                  const jimp = (-(1 + e) * rv) / it;
                  a.vx -= jimp * ia * nx;
                  a.vy -= jimp * ia * ny;
                  b.vx += jimp * ib * nx;
                  b.vy += jimp * ib * ny;
                  if (-rv > 60) {
                    if (onBall) onBall(a, b, -rv);
                    if (-rv > this.soundThreshold * 1.6) this.sound("tap", -rv * 0.6, a);
                  }
                }
              }
            }
            j = next[j];
          }
        }
      }
    }
  }

  private collidePeg(b: Ball, p: Peg): void {
    const dx = b.x - p.x;
    const dy = b.y - p.y;
    const rs = b.r + p.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rs * rs || d2 < 1e-9) return;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    b.x = p.x + nx * rs;
    b.y = p.y + ny * rs;
    const imp = this.resolve(
      b,
      nx,
      ny,
      p.vx + nx * p.vr,
      p.vy + ny * p.vr,
      p.bounce ?? this.wallRestitution,
    );
    if (imp > 0) {
      this.hooks.onPeg?.(b, p, imp);
      this.sound(p.bounce && p.bounce > 1 ? "bump" : "hit", imp, b);
    }
  }

  private collideSeg(b: Ball, s: Segment): void {
    const ex = s.bx - s.ax;
    const ey = s.by - s.ay;
    const l2 = ex * ex + ey * ey;
    let t = l2 > 0 ? ((b.x - s.ax) * ex + (b.y - s.ay) * ey) / l2 : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const qx = s.ax + ex * t;
    const qy = s.ay + ey * t;
    const dx = b.x - qx;
    const dy = b.y - qy;
    const minD = b.r + s.w * 0.5;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minD * minD) return;
    if (s.oneWay) {
      const side = (b.x - s.ax) * s.oneWay.nx + (b.y - s.ay) * s.oneWay.ny;
      if (side < 0) return; // passing side
    }
    let d = Math.sqrt(d2);
    let nx: number;
    let ny: number;
    if (d < 1e-6) {
      // exactly on the segment: push along segment normal
      const l = Math.sqrt(l2) || 1;
      nx = -ey / l;
      ny = ex / l;
      d = 0;
    } else {
      nx = dx / d;
      ny = dy / d;
    }
    if (s.oneWay) {
      // always push to the blocking side
      const dot = nx * s.oneWay.nx + ny * s.oneWay.ny;
      if (dot < 0) {
        nx = s.oneWay.nx;
        ny = s.oneWay.ny;
      }
    }
    const pen = minD - d;
    b.x += nx * pen;
    b.y += ny * pen;
    const ux = s.vx - s.omega * (qy - s.cy);
    const uy = s.vy + s.omega * (qx - s.cx);
    const imp = this.resolve(b, nx, ny, ux, uy, s.bounce ?? this.wallRestitution);
    if (imp > 0) {
      this.hooks.onSeg?.(b, s, imp, qx, qy);
      this.sound(s.bounce && s.bounce > 1 ? "bump" : "hit", imp, b);
    }
  }

  private inGap(ring: Ring, ang: number, pad: number): boolean {
    for (const g of ring.gaps) {
      const da = Math.abs(normAngle(ang - (g.a + ring.rot)));
      if (da < g.w * 0.5 - pad) return true;
    }
    return false;
  }

  private collidePoint(b: Ball, px: number, py: number, pr: number, ux: number, uy: number): number {
    const dx = b.x - px;
    const dy = b.y - py;
    const rs = b.r + pr;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rs * rs || d2 < 1e-9) return 0;
    const d = Math.sqrt(d2);
    const nx = dx / d;
    const ny = dy / d;
    b.x = px + nx * rs;
    b.y = py + ny * rs;
    return this.resolve(b, nx, ny, ux, uy, this.wallRestitution);
  }

  private collideRing(b: Ball, ring: Ring): void {
    if (ring.inner && b.escaped) return;
    const dx = b.x - ring.cx;
    const dy = b.y - ring.cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1e-6) return;
    const R = ring.r;
    const half = ring.w * 0.5;

    // gap end caps
    if (ring.gaps.length) {
      for (const g of ring.gaps) {
        for (let sgn = -1; sgn <= 1; sgn += 2) {
          const a = ring.rot + g.a + (sgn * g.w) / 2;
          const px = ring.cx + Math.cos(a) * R;
          const py = ring.cy + Math.sin(a) * R;
          const imp = this.collidePoint(
            b,
            px,
            py,
            half,
            -ring.omega * (py - ring.cy),
            ring.omega * (px - ring.cx),
          );
          if (imp > 0) {
            this.sound("hit", imp, b);
            if (ring.inner) this.hooks.onWall?.(b, imp, 0, 0);
            else this.hooks.onRing?.(b, ring, imp);
          }
        }
      }
    }

    const ang = Math.atan2(dy, dx);
    if (ring.inner) {
      if (d + b.r <= R - half) return;
      if (ring.gaps.length && this.inGap(ring, ang, 0)) {
        if (d > R + b.r + half + 2) {
          b.escaped = true;
          this.hooks.onEscape?.(b);
        }
        return;
      }
      if (d > R + half + b.r) {
        // somehow outside (tunnelled) - mark escaped
        b.escaped = true;
        this.hooks.onEscape?.(b);
        return;
      }
      const nx = -dx / d;
      const ny = -dy / d;
      const pen = d + b.r - (R - half);
      b.x += nx * pen;
      b.y += ny * pen;
      const imp = this.resolve(
        b,
        nx,
        ny,
        -ring.omega * dy,
        ring.omega * dx,
        this.wallRestitution,
      );
      if (imp > 0) {
        this.hooks.onWall?.(b, imp, nx, ny);
        this.sound("hit", imp, b);
      }
    } else {
      const off = d - R;
      if (Math.abs(off) >= b.r + half) return;
      if (ring.gaps.length && this.inGap(ring, ang, 0)) return;
      const side = off >= 0 ? 1 : -1;
      const nx = (dx / d) * side;
      const ny = (dy / d) * side;
      const pen = b.r + half - Math.abs(off);
      b.x += nx * pen;
      b.y += ny * pen;
      const imp = this.resolve(
        b,
        nx,
        ny,
        -ring.omega * dy,
        ring.omega * dx,
        this.wallRestitution,
      );
      if (imp > 0) {
        this.hooks.onRing?.(b, ring, imp);
        this.sound("hit", imp, b);
      }
    }
  }

  private collideBounds(b: Ball, bd: Bounds): void {
    const e = this.wallRestitution;
    let imp = 0;
    let nx = 0;
    let ny = 0;
    if (b.x - b.r < bd.x0) {
      b.x = bd.x0 + b.r;
      if (b.vx < 0) {
        imp = -b.vx;
        b.vx = -b.vx * e;
        b.vy *= 1 - this.friction;
        nx = 1;
      }
    } else if (b.x + b.r > bd.x1) {
      b.x = bd.x1 - b.r;
      if (b.vx > 0) {
        imp = b.vx;
        b.vx = -b.vx * e;
        b.vy *= 1 - this.friction;
        nx = -1;
      }
    }
    if (!bd.openBottom && b.y + b.r > bd.y1) {
      b.y = bd.y1 - b.r;
      if (b.vy > 0) {
        imp = Math.max(imp, b.vy);
        b.vy = -b.vy * e;
        b.vx *= 1 - this.friction;
        ny = -1;
      }
    } else if (!bd.openTop && b.y - b.r < bd.y0) {
      b.y = bd.y0 + b.r;
      if (b.vy < 0) {
        imp = Math.max(imp, -b.vy);
        b.vy = -b.vy * e;
        ny = 1;
      }
    }
    if (imp > 0) {
      this.hooks.onWall?.(b, imp, nx, ny);
      this.sound("hit", imp, b);
    }
  }
}
