import type { Ball } from "@/lib/engine/types";
import type { SimDef } from "../types";
import {
  CX,
  CY,
  R,
  TAU,
  TEAM_COLORS,
  circleArena,
  clamp,
  dist,
  fillCircle,
  fmt,
  hsl,
  makeRotor,
  pointInPolygon,
  polygonSegs,
  rnd,
  setPolygon,
  tapSpawn,
} from "../helpers";

// ---------------------------------------------------------------- 1
const bounceDouble: SimDef = {
  id: "bounce-double",
  name: "1 Bounce = 2 Balls",
  category: "multiply",
  hook: "1 Bounce = 2 Balls",
  description: "Her duvar sekmesinde top sayısı ikiye katlanır. Hedef: 1024.",
  accent: "#ffd60a",
  sound: "marimba",
  footer: "Wait for 1024...",
  create(w) {
    const target = 1024;
    circleArena(w, "#ffd60a");
    w.ballCollisions = false;
    w.wallRestitution = 1;
    w.friction = 0;
    w.gravity.y = 1300;
    w.maxBalls = target;
    w.spawn(CX, CY - 250, 380, 0, 26, hsl(50), { hue: 50 });
    return {
      onWall(b, imp) {
        if (w.completed || b.cd > 0 || imp < 150) return;
        b.cd = 0.18;
        b.hue += 23;
        b.color = hsl(b.hue);
        const c = w.clone(b, rnd(0.25, 0.6) * (Math.random() < 0.5 ? -1 : 1), 1, w.count > 64 ? 0.985 : 1);
        if (c) {
          c.r = Math.max(9, c.r);
          c.m = c.r * c.r;
          w.sfx("split", Math.min(1, imp / 1200), b.r, b.x);
        }
        if (w.count >= target) w.complete("1024 REACHED!");
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 16, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `TARGET ${fmt(target)}`,
        progress: Math.log2(Math.max(1, w.count)) / Math.log2(target),
      }),
    };
  },
};

// ---------------------------------------------------------------- 2
const wallSplit: SimDef = {
  id: "wall-split",
  name: "Wall Hit Split",
  category: "multiply",
  hook: "Only Wall Hits Split",
  description: "Sadece dış duvara çarpan toplar bölünür; iç tamponlar bölmez.",
  accent: "#00e5ff",
  sound: "glass",
  create(w) {
    circleArena(w, "#00e5ff");
    w.gravity.y = 1100;
    w.wallRestitution = 0.98;
    w.ballRestitution = 0.92;
    w.maxBalls = 600;
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4 + Math.PI / 4;
      w.addPeg(CX + Math.cos(a) * 200, CY + Math.sin(a) * 200, 40, "#ff2e88", { bounce: 1.05 });
    }
    w.addPeg(CX, CY, 30, "#ff2e88", { bounce: 1.05 });
    w.spawn(CX, CY - 300, 500, 100, 14, hsl(190), { hue: 190 });
    let splits = 0;
    return {
      onWall(b, imp) {
        if (b.cd > 0 || imp < 200 || w.completed) return;
        b.cd = 0.3;
        const c = w.clone(b, rnd(-0.5, 0.5), 1.05);
        if (c) {
          c.hue = b.hue + 12;
          c.color = hsl(c.hue);
          splits++;
          w.sfx("split", 0.6, b.r, b.x);
        }
        if (w.count >= w.maxBalls) w.complete("ARENA FULL!");
      },
      onPeg(b, p) {
        p.flash = 1;
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 14, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `WALL SPLITS ${fmt(splits)} · MAX ${w.maxBalls}`,
        progress: w.count / w.maxBalls,
      }),
    };
  },
};

// ---------------------------------------------------------------- 3
const spinnerClone: SimDef = {
  id: "spinner-clone",
  name: "Spinner Hit Clone",
  category: "multiply",
  hook: "Touch the Spinner = Clone",
  description: "Dönen çubuğa çarpan her top klonlanır.",
  accent: "#ff2e88",
  sound: "marimba",
  create(w) {
    circleArena(w, "#ff2e88");
    w.gravity.y = 1300;
    w.maxBalls = 700;
    w.wallRestitution = 0.95;
    const rotor = makeRotor(w, CX, CY, 2, 300, 20, "#ffffff", 2.2);
    w.spawn(CX - 150, CY - 300, 200, 0, 13, hsl(330), { hue: 330 });
    let clones = 0;
    return {
      update(dt) {
        rotor.update(dt);
      },
      onSeg(b, s, imp) {
        s.flash = 0.6;
        if (b.cd > 0 || imp < 120 || w.completed) return;
        b.cd = 0.35;
        const c = w.clone(b, rnd(-0.6, 0.6));
        if (c) {
          c.hue = b.hue + 15;
          c.color = hsl(c.hue);
          clones++;
          w.sfx("split", 0.7, b.r, b.x);
        }
        if (w.count >= w.maxBalls) w.complete("SPINNER WINS!");
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 13, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `CLONES ${fmt(clones)}`,
        progress: w.count / w.maxBalls,
      }),
    };
  },
};

// ---------------------------------------------------------------- 4
const timerBurst: SimDef = {
  id: "timer-burst",
  name: "Timer Burst",
  category: "multiply",
  hook: "Every 2s: New Wave",
  description: "Belirli aralıklarla merkezden büyüyen top dalgaları fışkırır.",
  accent: "#7cff4f",
  sound: "bubble",
  create(w) {
    circleArena(w, "#7cff4f");
    w.gravity.y = 1200;
    w.maxBalls = 900;
    const interval = 2;
    let timer = 0.4;
    let wave = 0;
    return {
      update(dt) {
        if (w.completed) return;
        timer -= dt;
        if (timer <= 0) {
          timer = interval;
          wave++;
          const n = Math.min(2 ** wave, 256, w.maxBalls - w.count);
          const hue = wave * 47;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU + rnd(-0.05, 0.05);
            const sp = rnd(600, 900);
            w.spawn(CX + Math.cos(a) * 12, CY + Math.sin(a) * 12, Math.cos(a) * sp, Math.sin(a) * sp, 11, hsl(hue + rnd(-15, 15)));
          }
          w.burst(CX, CY, hsl(hue), 20, 600, 6);
          w.text(`WAVE ${wave}  +${n}`, CX, CY - 40, hsl(hue, 90, 70), 64);
          w.sfx("boom", 0.6, 20, CX);
          w.shake(10);
          if (w.count >= w.maxBalls) w.complete("MAX WAVE!");
        }
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 11, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `WAVE ${wave} · NEXT IN ${Math.max(0, timer).toFixed(1)}s`,
        progress: 1 - timer / interval,
      }),
    };
  },
};

// ---------------------------------------------------------------- 5
const sizeDecay: SimDef = {
  id: "size-decay",
  name: "Size Decay Split",
  category: "multiply",
  hook: "Smaller & Faster Every Hit",
  description: "Bölündükçe küçülen ve hızlanan toplar.",
  accent: "#ff7a1a",
  sound: "soft",
  create(w) {
    circleArena(w, "#ff7a1a");
    w.gravity.y = 1100;
    w.wallRestitution = 0.97;
    w.maxBalls = 1000;
    const minR = 6;
    w.spawn(CX, CY - 150, 500, 0, 95, hsl(20), { hue: 20 });
    return {
      onWall(b, imp) {
        if (b.cd > 0 || imp < 150 || b.r <= minR || w.completed) return;
        b.cd = 0.25;
        const nr = Math.max(minR, b.r * 0.74);
        b.r = nr;
        b.m = nr * nr;
        b.vx *= 1.1;
        b.vy *= 1.1;
        b.hue += 18;
        b.color = hsl(b.hue);
        w.clone(b, rnd(0.3, 0.7) * (Math.random() < 0.5 ? 1 : -1));
        w.sfx("split", 0.8, nr, b.x);
        w.burst(b.x, b.y, b.color, 4, 300, 3);
      },
      update() {
        if (w.completed) return;
        if (w.count >= w.maxBalls) w.complete("DUST!");
        else if (w.count > 8 && w.balls.every((b) => b.r <= minR)) w.complete("TOO SMALL!");
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 40, hsl(rnd(0, 360)));
      },
      hud: () => {
        const avg = w.balls.length ? w.balls.reduce((s, b) => s + b.r, 0) / w.balls.length : 0;
        return {
          main: `BALLS: ${fmt(w.count)}`,
          sub: `AVG SIZE ${avg.toFixed(1)}px`,
          progress: 1 - (avg - minR) / (95 - minR),
        };
      },
    };
  },
};

// ---------------------------------------------------------------- 6
const ARROWS = ["↓", "←", "↑", "→"];
const gravityFlip: SimDef = {
  id: "gravity-flip",
  name: "Gravity Flip Duplicator",
  category: "multiply",
  hook: "Gravity Flips = Balls Double",
  description: "Yerçekimi her yön değiştirdiğinde toplar çoğalır.",
  accent: "#b14bff",
  sound: "glass",
  create(w) {
    circleArena(w, "#b14bff");
    w.maxBalls = 800;
    const G = 1500;
    const dirs = [
      [0, 1],
      [-1, 0],
      [0, -1],
      [1, 0],
    ];
    let dir = 0;
    let timer = 2.2;
    let flips = 0;
    w.gravity = { x: 0, y: G };
    w.spawn(CX, CY, 150, -200, 14, hsl(280), { hue: 280 });
    w.spawn(CX + 30, CY, -150, -200, 14, hsl(300), { hue: 300 });
    return {
      update(dt) {
        timer -= dt;
        if (timer <= 0 && !w.completed) {
          timer = 2.2;
          dir = (dir + 1) % 4;
          flips++;
          w.gravity = { x: dirs[dir][0] * G, y: dirs[dir][1] * G };
          const list = w.balls.slice();
          for (const b of list) {
            if (w.count >= w.maxBalls) break;
            const c = w.clone(b, rnd(-0.8, 0.8));
            if (c) {
              c.hue = b.hue + 30;
              c.color = hsl(c.hue);
            }
          }
          w.sfx("whoosh", 1, 20, CX);
          w.sfx("split", 1, 14, CX);
          w.text(`FLIP ${ARROWS[dir]}  x2`, CX, CY, "#e9d5ff", 72);
          if (w.count >= w.maxBalls) w.complete("GRAVITY MASTER!");
        }
      },
      drawBack(ctx) {
        ctx.save();
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#b14bff";
        ctx.font = "900 520px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(ARROWS[dir], CX, CY + 20);
        ctx.restore();
      },
      pointer(x, y) {
        tapSpawn(w, x, y, 14, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `GRAVITY ${ARROWS[dir]} · FLIPS ${flips} · NEXT ${Math.max(0, timer).toFixed(1)}s`,
        progress: w.count / w.maxBalls,
      }),
    };
  },
};

// ---------------------------------------------------------------- 7
interface Gate {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  mult: number;
  plus: number;
  label: string;
  color: string;
  bit: number;
  flash: number;
}
const gateMultiplier: SimDef = {
  id: "gate-multiplier",
  name: "Gate Multiplier",
  category: "multiply",
  hook: "Pick the Right Gate",
  description: "Kapılardan geçen toplar x2 / x3 / +5 ile çoğalarak çıkar.",
  accent: "#2ee6a6",
  sound: "tick",
  create(w) {
    const X0 = 80;
    const X1 = 1000;
    w.bounds = { x0: X0, y0: 380, x1: X1, y1: 1880, openBottom: true, color: "#2ee6a6", visible: true };
    w.ballCollisions = false;
    w.gravity.y = 900;
    w.wallRestitution = 0.6;
    w.maxBalls = 900;
    const gates: Gate[] = [];
    const defs: [number, number, string, string][] = [
      [2, 0, "x2", "#2ee6a6"],
      [3, 0, "x3", "#00e5ff"],
      [1, 5, "+5", "#ffd60a"],
      [2, 0, "x2", "#ff2e88"],
    ];
    const rows = [720, 1060, 1400];
    let bit = 1;
    rows.forEach((y, ri) => {
      const pair = ri === 1 ? [defs[1], defs[2]] : ri === 0 ? [defs[0], defs[2]] : [defs[3], defs[1]];
      pair.forEach((d, k) => {
        gates.push({
          x: k === 0 ? 140 : 600,
          y,
          w: 340,
          h: 60,
          vx: ri,
          mult: d[0],
          plus: d[1],
          label: d[2],
          color: d[3],
          bit,
          flash: 0,
        });
        bit <<= 1;
      });
    });
    // scatter pegs between rows
    for (let r = 0; r < 3; r++) {
      const y = 560 + r * 340;
      for (let i = 0; i < 7; i++) w.addPeg(160 + i * 127 + (r % 2) * 60, y, 10, "#3f3f46");
    }
    let spawnT = 0;
    let collected = 0;
    return {
      update(dt) {
        spawnT -= dt;
        if (spawnT <= 0) {
          spawnT = 0.4;
          w.spawn(CX + rnd(-120, 120), 420, rnd(-120, 120), 0, 10, "#ffffff", { hue: 0 });
        }
        // each row of two gates slides back and forth as a unit
        for (let i = 0; i < gates.length; i += 2) {
          const row = gates[i].vx;
          const off = Math.sin(w.t * (0.7 + row * 0.25) + row * 1.7) * 30;
          gates[i].x = 120 + off;
          gates[i + 1].x = 620 + off;
        }
        for (const g of gates) if (g.flash > 0) g.flash -= dt * 4;
        for (const b of w.balls) {
          for (const g of gates) {
            if (b.flags & g.bit) continue;
            if (b.x > g.x && b.x < g.x + g.w && b.y > g.y && b.y < g.y + g.h) {
              b.flags |= g.bit;
              b.color = g.color;
              const extra = g.mult - 1 + g.plus;
              for (let k = 0; k < extra; k++) {
                const c = w.clone(b, rnd(-0.5, 0.5));
                if (c) {
                  c.vx += rnd(-160, 160);
                  c.color = g.color;
                }
              }
              g.flash = 1;
              w.sfx("split", 0.5, 12, b.x);
            }
          }
        }
      },
      onLeave(b) {
        if (b.y > 1800) collected++;
      },
      drawBack(ctx) {
        for (const g of gates) {
          ctx.fillStyle = g.color + (g.flash > 0 ? "88" : "33");
          ctx.fillRect(g.x, g.y, g.w, g.h);
          ctx.strokeStyle = g.color;
          ctx.lineWidth = 4;
          ctx.strokeRect(g.x, g.y, g.w, g.h);
          ctx.fillStyle = "#fff";
          ctx.font = "900 44px system-ui, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(g.label, g.x + g.w / 2, g.y + g.h / 2 + 2);
        }
      },
      pointer(x, y) {
        for (let i = 0; i < 5; i++) w.spawn(x + rnd(-20, 20), y, rnd(-80, 80), 0, 10, "#ffffff");
      },
      hud: () => ({
        main: `COLLECTED: ${fmt(collected)}`,
        sub: `ACTIVE ${fmt(w.count)} · GATES x2 x3 +5`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 8
const colorChain: SimDef = {
  id: "color-chain",
  name: "Color Chain Clone",
  category: "multiply",
  hook: "Same Color Touch = New Ball",
  description: "Aynı renkteki iki top çarpışınca yeni top doğar.",
  accent: "#ff8fab",
  sound: "bubble",
  create(w) {
    circleArena(w, "#ff8fab");
    w.gravity.y = 700;
    w.wallRestitution = 1;
    w.ballRestitution = 0.98;
    w.maxBalls = 700;
    const teams = 4;
    const counts = () => {
      const c = new Array(teams).fill(0);
      for (const b of w.balls) c[b.team]++;
      return c;
    };
    fillCircle(w, teams * 3, 14, (i) => TEAM_COLORS[i % teams], 500, R - 60, (i) => ({ team: i % teams }));
    return {
      onBall(a, b, imp) {
        if (a.team !== b.team || a.cd > 0 || b.cd > 0 || imp < 80 || w.completed) return;
        a.cd = b.cd = 0.9;
        const c = w.spawn((a.x + b.x) / 2, (a.y + b.y) / 2, (a.vx + b.vx) / 2 + rnd(-200, 200), (a.vy + b.vy) / 2 - 200, 14, a.color, {
          team: a.team,
          cd: 0.9,
        });
        if (c) {
          c.flash = 1;
          w.sfx("pop", 0.6, 14, c.x);
        }
        if (w.count >= w.maxBalls) {
          const cs = counts();
          const best = cs.indexOf(Math.max(...cs));
          w.complete(`${["RED", "BLUE", "YELLOW", "GREEN"][best]} WINS!`);
        }
      },
      pointer(x, y) {
        const t = Math.floor(rnd(0, teams));
        w.spawn(x, y, 0, 0, 14, TEAM_COLORS[t], { team: t });
      },
      update(dt) {
        for (const b of w.balls) if (Math.hypot(b.vx, b.vy) < 250) { b.vx *= 1 + dt; b.vy *= 1 + dt; }
      },
      hud: () => {
        const cs = counts();
        return {
          main: `BALLS: ${fmt(w.count)}`,
          sub: cs.map((c, i) => `${["R", "B", "Y", "G"][i]} ${c}`).join("  ·  "),
          bars: cs.map((v, i) => ({ color: TEAM_COLORS[i], value: v })),
        };
      },
    };
  },
};

// ---------------------------------------------------------------- 9
const cornerRicochet: SimDef = {
  id: "corner-ricochet",
  name: "Corner Ricochet Boost",
  category: "multiply",
  hook: "Corner Hit = Triple Split",
  description: "Dönen üçgenin keskin köşelerine çarpan toplar 3'e bölünüp hızlanır.",
  accent: "#ffe600",
  sound: "tick",
  create(w) {
    const rad = 470;
    const cy = CY + 40;
    let rot = -Math.PI / 2;
    const omega = 0.5;
    const segs = polygonSegs(w, CX, cy, rad, 3, rot, 18, "#ffe600");
    w.gravity.y = 900;
    w.wallRestitution = 0.98;
    w.maxBalls = 650;
    w.spawn(CX, cy, 450, -300, 13, hsl(55), { hue: 55 });
    let corners = 0;
    const verts = (): [number, number][] =>
      [0, 1, 2].map((i) => [CX + Math.cos(rot + (i * TAU) / 3) * rad, cy + Math.sin(rot + (i * TAU) / 3) * rad]);
    let flashes = [0, 0, 0];
    return {
      update(dt) {
        rot += omega * dt;
        setPolygon(segs, CX, cy, rad, rot, omega);
        flashes = flashes.map((f) => Math.max(0, f - dt * 3));
        const v = verts();
        for (const b of w.balls) if (!pointInPolygon(b.x, b.y, v)) w.kill(b);
      },
      onSeg(b, s, imp, px, py) {
        if (b.cd > 0 || imp < 150 || w.completed) return;
        const v = verts();
        let best = 1e9;
        let bi = 0;
        v.forEach(([x, y], i) => {
          const d = dist(px, py, x, y);
          if (d < best) {
            best = d;
            bi = i;
          }
        });
        if (best < 130) {
          b.cd = 0.3;
          corners++;
          flashes[bi] = 1;
          b.vx *= 1.12;
          b.vy *= 1.12;
          b.hue += 25;
          b.color = hsl(b.hue);
          w.clone(b, 0.45);
          w.clone(b, -0.45);
          w.sfx("split", 1, b.r, b.x);
          w.burst(px, py, "#ffe600", 6, 400, 4);
          if (w.count >= w.maxBalls) w.complete("CORNER KING!");
        }
      },
      drawFront(ctx) {
        verts().forEach(([x, y], i) => {
          ctx.fillStyle = `rgba(255,230,0,${0.25 + flashes[i] * 0.75})`;
          ctx.beginPath();
          ctx.arc(x, y, 26 + flashes[i] * 20, 0, TAU);
          ctx.fill();
        });
      },
      pointer(x, y) {
        if (pointInPolygon(x, y, verts())) tapSpawn(w, x, y, 13, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: `CORNER HITS ${fmt(corners)} · x3 SPLIT`,
        progress: w.count / w.maxBalls,
      }),
    };
  },
};

// ---------------------------------------------------------------- 10
const targetFrenzy: SimDef = {
  id: "target-frenzy",
  name: "Target Cap Frenzy",
  category: "multiply",
  hook: "512 Then... OVERFLOW",
  description: "512'ye kadar hızla çoğalır, sonra çember açılır ve kaos başlar.",
  accent: "#ff1e1e",
  sound: "marimba",
  create(w) {
    const cap = 512;
    const ring = circleArena(w, "#ff6b00");
    w.bounds = { x0: 0, y0: -2000, x1: 1080, y1: 1880, color: "#ff1e1e", visible: false };
    w.ballCollisions = false;
    w.wallRestitution = 1;
    w.friction = 0;
    w.gravity.y = 1200;
    w.maxBalls = cap;
    let phase: "grow" | "overflow" = "grow";
    let overT = 0;
    w.spawn(CX, CY - 200, 300, 0, 12, hsl(30), { hue: 30 });
    const startOverflow = () => {
      phase = "overflow";
      w.text("OVERFLOW!", CX, CY, "#ff1e1e", 120, 1.6);
      w.sfx("boom", 1, 30, CX);
      w.shake(30);
      ring.color = "#ff1e1e";
      ring.gaps = [0, 1, 2, 3].map((i) => ({ a: (i * TAU) / 4 + Math.PI / 4, w: 0.05 }));
      ring.omega = 0.8;
      w.gravity.y = 1800;
      w.ballCollisions = true;
      w.wallRestitution = 0.6;
      w.ballRestitution = 0.4;
    };
    return {
      update(dt) {
        if (phase === "overflow") {
          overT += dt;
          for (const g of ring.gaps) g.w = Math.min(1.2, g.w + dt * 0.25);
          ring.rot += ring.omega * dt;
          w.shake(4);
          const inside = w.balls.filter((b) => !b.escaped).length;
          if ((inside === 0 || overT > 12) && !w.completed) w.complete("TOTAL CHAOS!");
        }
      },
      onWall(b, imp) {
        if (phase !== "grow" || b.cd > 0 || imp < 150 || b.escaped) return;
        b.cd = 0.1;
        b.hue += 9;
        b.color = hsl(b.hue, 95, 58);
        if (w.clone(b, rnd(0.2, 0.5) * (Math.random() < 0.5 ? 1 : -1))) w.sfx("split", 0.7, b.r, b.x);
        if (w.count >= cap) startOverflow();
      },
      pointer() {
        if (phase === "grow") startOverflow();
        else w.shake(20);
      },
      hud: () => ({
        main: `BALLS: ${fmt(w.count)}`,
        sub: phase === "grow" ? `PHASE: FRENZY · CAP ${cap}` : `PHASE: OVERFLOW · ${w.balls.filter((b) => b.escaped).length} OUT`,
        progress: phase === "grow" ? w.count / cap : clamp(overT / 12, 0, 1),
      }),
    };
  },
};

export const multiplySims: SimDef[] = [
  bounceDouble,
  wallSplit,
  spinnerClone,
  timerBurst,
  sizeDecay,
  gravityFlip,
  gateMultiplier,
  colorChain,
  cornerRicochet,
  targetFrenzy,
];

export type { Ball };
