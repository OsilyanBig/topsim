import type { Peg, Segment } from "@/lib/engine/types";
import type { SimDef } from "../types";
import {
  CX,
  CY,
  PALETTES,
  R,
  TAU,
  circleArena,
  fillCircle,
  fmt,
  hsl,
  makeRotor,
  pick,
  rnd,
  tapSpawn,
} from "../helpers";

// ---------------------------------------------------------------- 11
const singleSpinner: SimDef = {
  id: "single-spinner",
  name: "Single Spinner Sweep",
  category: "obstacle",
  hook: "One Bar vs 160 Balls",
  description: "Tek dönen çubuk topları süpürür ve sıkıştırır.",
  accent: "#00e5ff",
  sound: "tick",
  create(w) {
    circleArena(w, "#00e5ff");
    w.gravity.y = 1400;
    w.wallRestitution = 0.6;
    w.ballRestitution = 0.5;
    const rotor = makeRotor(w, CX, CY, 2, R - 46, 20, "#ffffff", 1.6);
    const pal = PALETTES.ocean;
    fillCircle(w, 160, 14, (i) => pal[i % pal.length], 100);
    let sweeps = 0;
    let last = 0;
    return {
      update(dt) {
        rotor.omega = 1.8 * Math.sin(w.t * 0.35) + Math.sign(Math.sin(w.t * 0.35)) * 0.6;
        rotor.update(dt);
        const turns = Math.floor(Math.abs(rotor.angle) / Math.PI);
        if (turns !== last) {
          last = turns;
          sweeps++;
        }
      },
      onSeg(b, s) {
        s.flash = 0.25;
      },
      pointer(x, y) {
        for (let i = 0; i < 10; i++) tapSpawn(w, x + rnd(-30, 30), y + rnd(-30, 30), 14, pick(pal));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `SWEEPS ${sweeps} · SPEED ${Math.abs(rotor.omega).toFixed(1)} rad/s`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 12
const tripleBlade: SimDef = {
  id: "triple-blade",
  name: "Triple Blade Vortex",
  category: "obstacle",
  hook: "Triple Blade Vortex",
  description: "3 kollu dönen pervane topları çevirir.",
  accent: "#ff2e88",
  sound: "marimba",
  create(w) {
    circleArena(w, "#ff2e88");
    w.gravity.y = 1300;
    w.wallRestitution = 0.7;
    w.ballRestitution = 0.6;
    const rotor = makeRotor(w, CX, CY, 3, 370, 24, "#ffffff", 2.4, 0);
    const hub = w.addPeg(CX, CY, 44, "#ff2e88");
    const pal = PALETTES.neon;
    fillCircle(w, 230, 12, (i) => pal[i % pal.length], 100);
    let hits = 0;
    return {
      update(dt) {
        rotor.update(dt);
      },
      onSeg(b, s) {
        s.flash = 0.2;
        hits++;
      },
      onPeg() {
        hub.flash = 0.3;
      },
      pointer() {
        rotor.omega = -rotor.omega;
        w.sfx("whoosh", 1, 20, CX);
        w.text("REVERSE!", CX, CY - 520, "#ff2e88", 60);
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `BLADE HITS ${fmt(hits)} · TAP = REVERSE`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 13
const counterRings: SimDef = {
  id: "counter-rings",
  name: "Counter-Rotating Rings",
  category: "obstacle",
  hook: "Can They Escape 3 Rings?",
  description: "Ters yönlerde dönen halkalar ve açıklıklar.",
  accent: "#7cff4f",
  sound: "glass",
  create(w) {
    circleArena(w, "#7cff4f");
    w.gravity.y = 900;
    w.wallRestitution = 0.85;
    w.maxBalls = 420;
    const radii = [140, 250, 360];
    const colors = ["#ff2e88", "#ffd60a", "#00e5ff"];
    const rings = radii.map((r, i) =>
      w.addRing(CX, CY, r, colors[i], { w: 12, omega: (i % 2 ? -1 : 1) * (1.1 + i * 0.25), gaps: [{ a: 0, w: 0.6 - i * 0.06 }] }),
    );
    const layerHue = [200, 330, 50, 120];
    let spawnT = 0;
    let escaped = 0;
    const target = 250;
    return {
      update(dt) {
        for (const r of rings) r.rot += r.omega * dt;
        spawnT -= dt;
        if (spawnT <= 0 && !w.completed) {
          spawnT = 0.12;
          const a = rnd(0, TAU);
          w.spawn(CX + Math.cos(a) * 20, CY + Math.sin(a) * 20, Math.cos(a) * 300, Math.sin(a) * 300, 10, hsl(200), { hue: 0 });
        }
        for (const b of w.balls) {
          const d = Math.hypot(b.x - CX, b.y - CY);
          let layer = 0;
          for (const r of radii) if (d > r) layer++;
          if (layer !== b.hue) {
            if (layer > b.hue && layer === 3 && !(b.flags & 1)) {
              b.flags |= 1;
              escaped++;
              w.sfx("pop", 0.5, 10, b.x);
            }
            b.hue = layer;
            b.color = hsl(layerHue[layer]);
          }
        }
        if (escaped >= target) w.complete("ALL ESCAPED!");
      },
      onRing(b, r, imp) {
        if (imp > 450) r.flash = 0.12;
      },
      pointer() {
        for (const r of rings) r.omega = -r.omega;
        w.sfx("whoosh", 1, 20, CX);
      },
      hud: () => ({
        main: `ESCAPED: ${escaped}/${target}`,
        sub: `BALLS ${fmt(w.count)} · TAP = REVERSE RINGS`,
        progress: escaped / target,
      }),
    };
  },
};

// ---------------------------------------------------------------- 14
const pendulum: SimDef = {
  id: "pendulum-crusher",
  name: "Pendulum Crusher",
  category: "obstacle",
  hook: "The Pendulum Never Stops",
  description: "Sarkaç gibi salınan ağır top, topları iter ve fırlatır.",
  accent: "#ffc371",
  sound: "soft",
  create(w) {
    circleArena(w, "#ffc371");
    w.gravity.y = 1400;
    w.wallRestitution = 0.6;
    w.ballRestitution = 0.55;
    const L = 290;
    const bobR = 72;
    const amp = 1.35;
    const freq = 1.5;
    const rod = w.addSeg(CX, CY, CX, CY + L, 14, "#ffc371", { cx: CX, cy: CY });
    const bob = w.addPeg(CX, CY + L, bobR, "#ff5f6d");
    w.addPeg(CX, CY, 18, "#ffc371");
    const pal = PALETTES.sunset;
    fillCircle(w, 190, 13, (i) => pal[i % pal.length], 100);
    let swings = 0;
    let lastSign = 1;
    return {
      update() {
        const th = amp * Math.sin(w.t * freq);
        const thd = amp * freq * Math.cos(w.t * freq);
        const sx = Math.sin(th);
        const cy = Math.cos(th);
        const bx = CX + sx * L;
        const by = CY + cy * L;
        rod.bx = bx;
        rod.by = by;
        // angle measured from +y: surface omega in screen coords is -thd
        rod.omega = -thd;
        bob.x = bx;
        bob.y = by;
        bob.vx = Math.cos(th) * thd * L;
        bob.vy = -Math.sin(th) * thd * L;
        const sg = Math.sign(th);
        if (sg !== lastSign && sg !== 0) {
          lastSign = sg;
          swings++;
          w.sfx("whoosh", 0.5, 20, bx);
        }
      },
      onPeg(b, p, imp) {
        if (p === bob && imp > 300) {
          bob.flash = 0.2;
          w.shake(Math.min(8, imp / 200));
        }
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 13, pick(pal));
      },
      hud: () => ({
        main: `SWINGS: ${swings}`,
        sub: `BALLS ${fmt(w.count)}`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 15
const rotatingCross: SimDef = {
  id: "rotating-cross",
  name: "Rotating Cross",
  category: "obstacle",
  hook: "The Gap Keeps Shrinking",
  description: "Artı şeklinde dönen engel ve daralıp genişleyen geçitler.",
  accent: "#b14bff",
  sound: "marimba",
  create(w) {
    circleArena(w, "#b14bff");
    w.gravity.y = 1300;
    w.wallRestitution = 0.7;
    w.ballRestitution = 0.6;
    const rotor = makeRotor(w, CX, CY, 4, 320, 22, "#e9d5ff", 1.2);
    const pal = PALETTES.candy;
    fillCircle(w, 200, 12, (i) => pal[i % pal.length], 100);
    let passes = 0;
    return {
      update(dt) {
        rotor.len = 330 + 70 * Math.sin(w.t * 0.8);
        rotor.update(dt);
      },
      onSeg(b, s, imp) {
        s.flash = 0.2;
        if (imp > 500) passes++;
      },
      drawBack(ctx) {
        const gap = R - rotor.len - 5;
        ctx.save();
        ctx.strokeStyle = "rgba(177,75,255,0.18)";
        ctx.setLineDash([10, 14]);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(CX, CY, rotor.len, 0, TAU);
        ctx.stroke();
        ctx.restore();
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = "700 30px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(`GAP ${Math.round(gap)}px`, CX, CY + R + 70);
      },
      pointer() {
        rotor.omega *= -1;
        w.sfx("whoosh", 1, 20, CX);
      },
      hud: () => ({
        main: `GAP: ${Math.max(0, Math.round(R - rotor.len - 5))}px`,
        sub: `BALLS ${fmt(w.count)} · HARD HITS ${passes}`,
        progress: 1 - (R - rotor.len - 40) / 140,
      }),
    };
  },
};

// ---------------------------------------------------------------- 16
const pinball: SimDef = {
  id: "pinball-bumpers",
  name: "Pinball Bumper Field",
  category: "obstacle",
  hook: "Pinball Bumper Madness",
  description: "Sabit ve hareketli tamponlar arasında seken toplar.",
  accent: "#ff2e88",
  sound: "soft",
  create(w) {
    w.bounds = { x0: 80, y0: 380, x1: 1000, y1: 1880, openBottom: true, color: "#ff2e88", visible: true };
    w.gravity.y = 1500;
    w.wallRestitution = 0.8;
    w.ballRestitution = 0.8;
    const bumpers: Peg[] = [];
    const cols = ["#ff2e88", "#00e5ff", "#ffe600", "#7cff4f"];
    for (let row = 0; row < 4; row++) {
      const n = row % 2 ? 4 : 5;
      for (let i = 0; i < n; i++) {
        const x = 170 + i * 185 + (row % 2) * 92;
        bumpers.push(w.addPeg(x, 640 + row * 220, 36, cols[row], { bounce: 1.25, tag: row === 1 || row === 3 ? "move" : "" }));
      }
    }
    const base = bumpers.map((b) => b.x);
    // slingshots
    w.addSeg(100, 1560, 380, 1760, 14, "#ffe600", { bounce: 1.35 });
    w.addSeg(980, 1560, 700, 1760, 14, "#ffe600", { bounce: 1.35 });
    let score = 0;
    let spawnT = 0;
    return {
      update(dt) {
        bumpers.forEach((b, i) => {
          if (b.tag === "move") {
            const nx = base[i] + Math.sin(w.t * 1.3 + i) * 50;
            b.vx = (nx - b.x) / Math.max(dt, 1e-3);
            b.x = nx;
          }
        });
        spawnT -= dt;
        if (spawnT <= 0 && w.count < 90) {
          spawnT = 0.25;
          w.spawn(rnd(160, 920), 420, rnd(-150, 150), 0, 14, pick(PALETTES.neon));
        }
      },
      onPeg(b, p, imp) {
        if (imp < 100) return;
        p.flash = 0.5;
        score += 10;
        if (Math.random() < 0.25) w.text("+10", p.x, p.y - 50, p.color, 36, 0.5);
      },
      onSeg(b, s) {
        s.flash = 0.4;
        score += 5;
      },
      pointer(x, y) {
        for (let i = 0; i < 6; i++) w.spawn(x + rnd(-30, 30), y, rnd(-200, 200), -300, 14, pick(PALETTES.neon));
      },
      hud: () => ({
        main: `SCORE: ${fmt(score)}`,
        sub: `BALLS ${w.count}`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 17
const flapGate: SimDef = {
  id: "one-way-flap",
  name: "One-Way Flap Gate",
  category: "obstacle",
  hook: "Balls Can Only Go One Way",
  description: "Tek yönlü kapaklar topları tek tarafta biriktirir.",
  accent: "#2ee6a6",
  sound: "tick",
  create(w) {
    circleArena(w, "#2ee6a6");
    w.wallRestitution = 0.6;
    w.ballRestitution = 0.5;
    const G = 1400;
    const openings = [-230, 0, 230];
    const oh = 80;
    // divider
    let y = CY - R;
    const solids: Segment[] = [];
    for (const o of openings) {
      const top = CY + o - oh / 2;
      solids.push(w.addSeg(CX, y, CX, top, 14, "#e5e7eb"));
      y = CY + o + oh / 2;
    }
    solids.push(w.addSeg(CX, y, CX, CY + R, 14, "#e5e7eb"));
    let dir = 1; // +1 traps on the right side
    const flaps = openings.map((o) =>
      w.addSeg(CX, CY + o - oh / 2, CX, CY + o + oh / 2, 8, "#2ee6a6", { oneWay: { nx: 1, ny: 0 }, visible: false }),
    );
    const flapAnim = openings.map(() => 0);
    const pal = PALETTES.mint;
    for (let i = 0; i < 200; i++) {
      const x = rnd(CX - 380, CX - 40);
      const yy = rnd(CY - 300, CY + 300);
      if (Math.hypot(x - CX, yy - CY) < R - 30) w.spawn(x, yy, 0, 0, 12, pal[i % pal.length]);
    }
    const sideOf = (x: number) => (x > CX ? 1 : -1);
    for (const b of w.balls) b.flags = sideOf(b.x) > 0 ? 1 : 0;
    let moved = 0;
    return {
      update(dt) {
        const ang = Math.sin(w.t * 0.8) * 1.25;
        w.gravity = { x: Math.sin(ang) * G, y: Math.cos(ang) * G };
        for (let i = 0; i < flapAnim.length; i++) flapAnim[i] = Math.max(0, flapAnim[i] - dt * 3);
        let left = 0;
        for (const b of w.balls) {
          const s = b.x > CX ? 1 : 0;
          if (s !== (b.flags & 1)) {
            b.flags = (b.flags & ~1) | s;
            if ((s === 1 && dir === 1) || (s === 0 && dir === -1)) {
              moved++;
              const oi = openings.findIndex((o) => Math.abs(b.y - (CY + o)) < oh);
              if (oi >= 0) flapAnim[oi] = 1;
              w.sfx("tap", 0.6, 12, b.x);
            }
          }
          if ((dir === 1 && s === 0) || (dir === -1 && s === 1)) left++;
        }
        if (left === 0 && w.balls.length > 0) {
          dir = -dir;
          for (const f of flaps) f.oneWay = { nx: dir, ny: 0 };
          w.text(dir === 1 ? "→ FLIP →" : "← FLIP ←", CX, CY - R - 40, "#2ee6a6", 64, 1.2);
          w.sfx("win", 1, 20, CX);
        }
      },
      drawFront(ctx) {
        ctx.lineCap = "round";
        openings.forEach((o, i) => {
          const top = CY + o - oh / 2;
          const a = flapAnim[i] * 0.9 * dir;
          ctx.strokeStyle = "#2ee6a6";
          ctx.lineWidth = 10;
          ctx.beginPath();
          ctx.moveTo(CX, top);
          ctx.lineTo(CX + Math.sin(a) * oh, top + Math.cos(a) * oh);
          ctx.stroke();
          ctx.fillStyle = "rgba(46,230,166,0.6)";
          ctx.font = "900 34px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(dir === 1 ? "›" : "‹", CX + dir * 34, CY + o + 12);
        });
      },
      pointer() {
        dir = -dir;
        for (const f of flaps) f.oneWay = { nx: dir, ny: 0 };
        w.sfx("whoosh", 1, 20, CX);
      },
      hud: () => {
        let l = 0;
        let r = 0;
        for (const b of w.balls) b.x > CX ? r++ : l++;
        return {
          main: `LEFT ${l} | RIGHT ${r}`,
          sub: `PASSED ${moved} · TAP = FLIP GATES`,
          bars: [
            { color: "#2ee6a6", value: l },
            { color: "#00e5ff", value: r },
          ],
        };
      },
    };
  },
};

// ---------------------------------------------------------------- 18
const breathingCore: SimDef = {
  id: "breathing-core",
  name: "Expanding / Contracting Core",
  category: "obstacle",
  hook: "The Core Is Breathing",
  description: "Merkezdeki çekirdek büyüyüp küçülerek topları sıkıştırır.",
  accent: "#ff5f6d",
  sound: "bubble",
  create(w) {
    circleArena(w, "#ff5f6d");
    w.gravity = { x: 0, y: 0 };
    w.wallRestitution = 0.5;
    w.ballRestitution = 0.4;
    const minR = 70;
    const maxR = 315;
    const core = w.addPeg(CX, CY, minR, "#ff5f6d", { bounce: 0.6 });
    const pal = PALETTES.fire;
    fillCircle(w, 260, 12, (i) => pal[i % pal.length], 50, R - 30);
    for (const b of w.balls) {
      const d = Math.hypot(b.x - CX, b.y - CY);
      if (d < minR + 20) {
        b.x = CX + 200;
      }
    }
    let breaths = 0;
    let wasUp = false;
    const speed = 1.4;
    return {
      update() {
        const s = (Math.sin(w.t * speed - Math.PI / 2) + 1) / 2;
        const eased = s * s * (3 - 2 * s);
        const r = minR + (maxR - minR) * eased;
        const ds = (Math.cos(w.t * speed - Math.PI / 2) * speed) / 2;
        core.vr = (maxR - minR) * 6 * s * (1 - s) * ds;
        core.r = r;
        const up = s > 0.98;
        if (up && !wasUp) {
          breaths++;
          w.sfx("boom", 0.4, 30, CX);
          w.shake(6);
        }
        wasUp = up;
      },
      force(b, dt) {
        const dx = CX - b.x;
        const dy = CY - b.y;
        const d = Math.hypot(dx, dy) || 1;
        b.vx += (dx / d) * 1300 * dt;
        b.vy += (dy / d) * 1300 * dt;
      },
      drawBack(ctx) {
        const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, core.r + 60);
        g.addColorStop(0, "rgba(255,95,109,0.35)");
        g.addColorStop(1, "rgba(255,95,109,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(CX, CY, core.r + 60, 0, TAU);
        ctx.fill();
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 12, pick(pal));
      },
      hud: () => ({
        main: `PRESSURE: ${Math.round(((core.r - minR) / (maxR - minR)) * 100)}%`,
        sub: `BREATHS ${breaths} · BALLS ${w.count}`,
        progress: (core.r - minR) / (maxR - minR),
      }),
    };
  },
};

export const obstacleSims: SimDef[] = [
  singleSpinner,
  tripleBlade,
  counterRings,
  pendulum,
  rotatingCross,
  pinball,
  flapGate,
  breathingCore,
];
