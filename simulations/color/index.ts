import type { Ball, Segment } from "@/lib/engine/types";
import type { SimDef } from "../types";
import {
  CX,
  CY,
  PALETTES,
  R,
  TAU,
  TEAM_COLORS,
  TEAM_NAMES,
  circleArena,
  dist,
  fmt,
  hsl,
  keepSpeed,
  makeRotor,
  pick,
  randomInCircle,
  rnd,
  tapSpawn,
} from "../helpers";

function teamCounts(balls: Ball[], n: number): number[] {
  const c = new Array(n).fill(0);
  for (const b of balls) c[b.team]++;
  return c;
}

// ---------------------------------------------------------------- 19
const colorBattle: SimDef = {
  id: "color-battle",
  name: "Color Battle Arena",
  category: "color",
  hook: "Which Color Wins in 30s?",
  description: "Renkler çarpışarak birbirini dönüştürür; 30 saniyede en kalabalık renk kazanır.",
  accent: "#ffd60a",
  sound: "marimba",
  create(w) {
    circleArena(w, "#ffd60a");
    w.gravity = { x: 0, y: 0 };
    w.wallRestitution = 1;
    w.ballRestitution = 1;
    w.friction = 0;
    const teams = 4;
    const per = 45;
    for (let t = 0; t < teams; t++) {
      const a = (t * TAU) / teams + Math.PI / 4;
      for (let i = 0; i < per; i++) {
        const [x, y] = randomInCircle(CX + Math.cos(a) * 230, CY + Math.sin(a) * 230, 120);
        const va = rnd(0, TAU);
        w.spawn(x, y, Math.cos(va) * 450, Math.sin(va) * 450, 12, TEAM_COLORS[t], { team: t });
      }
    }
    const duration = 30;
    let left = duration;
    return {
      update(dt) {
        if (w.completed) return;
        left -= dt;
        for (const b of w.balls) keepSpeed(b, 450, dt);
        if (left <= 0) {
          const c = teamCounts(w.balls, teams);
          const best = c.indexOf(Math.max(...c));
          w.complete(`${TEAM_NAMES[best]} WINS!`);
        }
      },
      onBall(a, b) {
        if (a.team === b.team || w.completed) return;
        const sa = Math.hypot(a.vx, a.vy);
        const sb = Math.hypot(b.vx, b.vy);
        const [win, lose] = sa >= sb ? [a, b] : [b, a];
        lose.team = win.team;
        lose.color = win.color;
        lose.flash = 0.4;
        w.sfx("pop", 0.4, 12, lose.x);
      },
      pointer(x, y) {
        const t = Math.floor(rnd(0, teams));
        for (let i = 0; i < 5; i++) w.spawn(x + rnd(-20, 20), y + rnd(-20, 20), rnd(-400, 400), rnd(-400, 400), 12, TEAM_COLORS[t], { team: t });
      },
      hud: () => {
        const c = teamCounts(w.balls, teams);
        return {
          main: `TIME: ${Math.max(0, left).toFixed(1)}s`,
          sub: c.map((v, i) => `${TEAM_NAMES[i]} ${v}`).join(" · "),
          bars: c.map((v, i) => ({ color: TEAM_COLORS[i], value: v })),
        };
      },
    };
  },
};

// ---------------------------------------------------------------- 20
const lastColor: SimDef = {
  id: "last-color",
  name: "Last Color Standing",
  category: "color",
  hook: "Last Color Standing",
  description: "Çarpışan toplar renk değiştirir, son kalan renk kazanır. Dokunarak top rengini değiştir.",
  accent: "#3dff8a",
  sound: "bubble",
  create(w) {
    circleArena(w, "#3dff8a");
    w.gravity = { x: 0, y: 0 };
    w.wallRestitution = 1;
    w.ballRestitution = 1;
    w.friction = 0;
    const teams = 6;
    for (let i = 0; i < teams * 16; i++) {
      const [x, y] = randomInCircle(CX, CY, R - 40);
      const va = rnd(0, TAU);
      w.spawn(x, y, Math.cos(va) * 420, Math.sin(va) * 420, 15, TEAM_COLORS[i % teams], { team: i % teams });
    }
    const alive = new Array(teams).fill(true);
    return {
      update(dt) {
        for (const b of w.balls) keepSpeed(b, 420, dt);
        const c = teamCounts(w.balls, teams);
        c.forEach((v, i) => {
          if (alive[i] && v === 0) {
            alive[i] = false;
            w.text(`${TEAM_NAMES[i]} OUT`, CX, CY - R - 50, TEAM_COLORS[i], 60, 1.2);
            w.sfx("break", 1, 20, CX);
          }
        });
        const remaining = alive.filter(Boolean).length;
        if (remaining === 1) {
          const t = alive.indexOf(true);
          w.complete(`${TEAM_NAMES[t]} SURVIVES!`);
        }
      },
      onBall(a, b) {
        if (a.team === b.team || w.completed) return;
        const c = teamCounts(w.balls, teams);
        // rich get richer: bigger team converts more often
        const pa = c[a.team] ** 1.6 / (c[a.team] ** 1.6 + c[b.team] ** 1.6);
        const [win, lose] = Math.random() < pa ? [a, b] : [b, a];
        lose.team = win.team;
        lose.color = win.color;
        lose.flash = 0.4;
        w.sfx("tap", 0.8, 15, lose.x);
      },
      pointer(x, y) {
        let best: Ball | null = null;
        let bd = 80;
        for (const b of w.balls) {
          const d = dist(x, y, b.x, b.y);
          if (d < bd) {
            bd = d;
            best = b;
          }
        }
        if (best) {
          const t = (best.team + 1) % teams;
          best.team = t;
          best.color = TEAM_COLORS[t];
          best.flash = 1;
          if (!alive[t]) alive[t] = true;
          w.sfx("pop", 1, 15, x);
        }
      },
      hud: () => {
        const c = teamCounts(w.balls, teams);
        const rem = c.filter((v) => v > 0).length;
        return {
          main: `COLORS LEFT: ${rem}`,
          sub: `BALLS ${w.count} · TAP A BALL = SWITCH COLOR`,
          bars: c.map((v, i) => ({ color: TEAM_COLORS[i], value: v })),
        };
      },
    };
  },
};

// ---------------------------------------------------------------- 21
const overflow: SimDef = {
  id: "overflow-pressure",
  name: "Overflow Pressure",
  category: "color",
  hook: "Will the Cup Overflow?",
  description: "Hazneye top doldukça basınç artar, sonunda taşar.",
  accent: "#ff3d68",
  sound: "soft",
  create(w) {
    w.gravity.y = 1500;
    w.wallRestitution = 0.3;
    w.ballRestitution = 0.25;
    w.friction = 0.03;
    w.maxBalls = 1100;
    const walls: Segment[] = [
      w.addSeg(240, 980, 320, 1700, 18, "#2ee6a6"),
      w.addSeg(320, 1700, 760, 1700, 18, "#2ee6a6"),
      w.addSeg(760, 1700, 840, 980, 18, "#2ee6a6"),
    ];
    const capacity = 480;
    let rate = 10;
    let acc = 0;
    let spilled = 0;
    let announced = false;
    const inCup = () => {
      let n = 0;
      for (const b of w.balls) if (b.y > 980 && b.y < 1700 && b.x > 240 && b.x < 840) n++;
      return n;
    };
    let pressure = 0;
    return {
      update(dt) {
        rate = Math.min(60, rate + dt * 1.2);
        acc += rate * dt;
        while (acc >= 1 && !w.completed) {
          acc -= 1;
          w.spawn(CX + rnd(-20, 20), 470, rnd(-40, 40), 300, 11, hsl(200 + rnd(-20, 20) - pressure * 200, 90, 60));
        }
        pressure = inCup() / capacity;
        const col = hsl(150 - Math.min(1, pressure) * 150, 90, 55);
        for (const s of walls) s.color = col;
        if (pressure > 0.6) w.shake((pressure - 0.6) * 12);
        if (pressure >= 1 && !announced) {
          announced = true;
          w.text("OVERFLOW!", CX, 880, "#ff3d68", 110, 1.6);
          w.sfx("boom", 1, 30, CX);
        }
        if (spilled >= 350) w.complete("IT OVERFLOWED!");
      },
      onLeave(b) {
        if (b.y > 1800) {
          spilled++;
          if (spilled % 5 === 0) w.sfx("pop", 0.4, 11, b.x);
        }
      },
      drawBack(ctx) {
        // spout
        ctx.fillStyle = "#3f3f46";
        ctx.fillRect(CX - 50, 400, 100, 50);
        ctx.fillStyle = "#71717a";
        ctx.fillRect(CX - 30, 440, 60, 20);
        // pressure gauge
        const p = Math.min(1.2, pressure);
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(930, 980, 40, 720);
        ctx.fillStyle = hsl(150 - Math.min(1, p) * 150, 90, 55);
        const h = (Math.min(1, p) * 720) | 0;
        ctx.fillRect(930, 1700 - h, 40, h);
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 3;
        ctx.strokeRect(930, 980, 40, 720);
      },
      pointer(x, y) {
        for (let i = 0; i < 12; i++) w.spawn(x + rnd(-30, 30), y + rnd(-30, 30), rnd(-100, 100), 0, 11, hsl(rnd(0, 360)));
      },
      hud: () => ({
        main: `PRESSURE: ${Math.round(pressure * 100)}%`,
        sub: `SPILLED ${fmt(spilled)} · FLOW ${rate.toFixed(0)}/s`,
        progress: pressure,
      }),
    };
  },
};

// ---------------------------------------------------------------- 22
const shredder: SimDef = {
  id: "shredder-drain",
  name: "Shredder / Drain Hole",
  category: "color",
  hook: "Into the Shredder",
  description: "Alttaki delikten akan toplar dönen bıçaklarda parçalanır.",
  accent: "#ff6b00",
  sound: "tick",
  create(w) {
    const cy = 1020;
    const rad = 400;
    w.addRing(CX, cy, rad, "#ff6b00", { inner: true, w: 10, gaps: [{ a: Math.PI / 2, w: 0.24 }] });
    w.gravity.y = 1500;
    w.wallRestitution = 0.5;
    w.ballRestitution = 0.4;
    const shredY = cy + rad + 150;
    const r1 = makeRotor(w, CX - 80, cy + rad + 95, 4, 70, 14, "#d4d4d8", 7);
    const r2 = makeRotor(w, CX + 80, cy + rad + 95, 4, 70, 14, "#d4d4d8", -7);
    const pal = PALETTES.fire;
    for (let i = 0; i < 300; i++) {
      const [x, y] = randomInCircle(CX, cy - 60, rad - 70);
      w.spawn(x, y, 0, 0, 11, pal[i % pal.length]);
    }
    let shredded = 0;
    let refill = 0;
    return {
      update(dt) {
        r1.update(dt);
        r2.update(dt);
        for (const b of w.balls) {
          if (b.y > shredY) {
            w.kill(b);
            shredded++;
            w.burst(b.x, b.y, b.color, 7, 500, 4);
            w.sfx("pop", 0.6, 8, b.x);
          }
        }
        refill -= dt;
        if (refill <= 0 && w.count < 300) {
          refill = 0.03;
          for (let k = 0; k < 2; k++) w.spawn(CX + rnd(-250, 250), cy - rad + 60 + rnd(0, 40), rnd(-50, 50), 0, 11, pick(pal));
        }
      },
      drawBack(ctx) {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(CX - 170, cy + rad + 20, 340, 160);
        ctx.strokeStyle = "#ff6b00";
        ctx.lineWidth = 4;
        ctx.strokeRect(CX - 170, cy + rad + 20, 340, 160);
      },
      onSeg(b, s) {
        if (s.tag === "rotor") s.flash = 0.2;
      },
      pointer(x, y) {
        for (let i = 0; i < 10; i++) tapSpawn(w, x + rnd(-20, 20), y + rnd(-20, 20), 11, pick(pal));
      },
      hud: () => ({
        main: `SHREDDED: ${fmt(shredded)}`,
        sub: `IN THE BOWL ${w.count}`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 23
const spiralFunnel: SimDef = {
  id: "spiral-funnel",
  name: "Spiral Funnel",
  category: "color",
  hook: "Down the Spiral",
  description: "Dönen sarmal duvar topları merkezdeki tahliyeye taşır.",
  accent: "#00b4d8",
  sound: "glass",
  trail: 0.25,
  create(w) {
    circleArena(w, "#00b4d8");
    w.gravity = { x: 0, y: 0 };
    w.wallRestitution = 0.4;
    w.ballRestitution = 0.3;
    w.friction = 0.02;
    const r0 = 385;
    const r1 = 95;
    const turns = 2.5;
    const thetaMax = turns * TAU;
    const b = (r0 - r1) / thetaMax;
    const step = 0.16;
    const segs: Segment[] = [];
    const n = Math.ceil(thetaMax / step);
    for (let i = 0; i < n; i++) segs.push(w.addSeg(0, 0, 0, 0, 10, "#00b4d8", { cx: CX, cy: CY }));
    let rot = 0;
    const omega = -2.4;
    const layout = () => {
      for (let i = 0; i < n; i++) {
        const t0 = i * step;
        const t1 = Math.min(thetaMax, (i + 1) * step);
        const ra = r0 - b * t0;
        const rb = r0 - b * t1;
        const s = segs[i];
        s.ax = CX + Math.cos(t0 + rot) * ra;
        s.ay = CY + Math.sin(t0 + rot) * ra;
        s.bx = CX + Math.cos(t1 + rot) * rb;
        s.by = CY + Math.sin(t1 + rot) * rb;
        s.omega = omega;
        s.color = hsl(190 + (i / n) * 120, 90, 60);
      }
    };
    layout();
    let drained = 0;
    let spawnT = 0;
    const pal = PALETTES.ocean;
    return {
      update(dt) {
        rot += omega * dt;
        layout();
        spawnT -= dt;
        if (spawnT <= 0 && w.count < 260) {
          spawnT = 0.12;
          const a = rnd(0, TAU);
          w.spawn(CX + Math.cos(a) * 415, CY + Math.sin(a) * 415, 0, 0, 10, pick(pal));
        }
        for (const ball of w.balls) {
          if (Math.hypot(ball.x - CX, ball.y - CY) < 55) {
            w.kill(ball);
            drained++;
            w.burst(CX, CY, ball.color, 4, 250, 4);
            if (drained % 2 === 0) w.sfx("pop", 0.5, 10 - (drained % 10), CX);
          }
        }
      },
      force(ball, dt) {
        const dx = CX - ball.x;
        const dy = CY - ball.y;
        const d = Math.hypot(dx, dy) || 1;
        const nx = dx / d;
        const ny = dy / d;
        // inward pull + tangential swirl along the spiral channel (increasing angle)
        ball.vx += nx * 600 * dt + ny * 1400 * dt;
        ball.vy += ny * 600 * dt - nx * 1400 * dt;
      },
      drawBack(ctx) {
        const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 70);
        g.addColorStop(0, "#000");
        g.addColorStop(1, "rgba(0,180,216,0.35)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(CX, CY, 60, 0, TAU);
        ctx.fill();
      },
      pointer(x, y) {
        for (let i = 0; i < 8; i++) tapSpawn(w, x + rnd(-20, 20), y + rnd(-20, 20), 10, pick(pal));
      },
      hud: () => ({
        main: `DRAINED: ${fmt(drained)}`,
        sub: `ON THE SPIRAL ${w.count}`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 24
const cageBreak: SimDef = {
  id: "cage-break",
  name: "Cage Break",
  category: "color",
  hook: "Break the Cage",
  description: "Dış çemberin kırılabilir parçalarına çarpan toplar duvarı kırar.",
  accent: "#ff2e88",
  sound: "glass",
  create(w) {
    w.gravity.y = 900;
    w.wallRestitution = 1.0;
    w.ballRestitution = 1;
    w.friction = 0;
    const pieces = 28;
    const sub = 3;
    let layer = 0;
    let groups: { segs: Segment[]; hp: number; max: number; hue: number }[] = [];
    let escaped = 0;
    const build = () => {
      layer++;
      for (const g of groups) for (const s of g.segs) s.on = false;
      w.segs = w.segs.filter((s) => s.on);
      groups = [];
      const hp = 2 + layer;
      for (let i = 0; i < pieces; i++) {
        const segs: Segment[] = [];
        const hue = (i / pieces) * 360;
        for (let k = 0; k < sub; k++) {
          const a0 = ((i * sub + k) / (pieces * sub)) * TAU;
          const a1 = ((i * sub + k + 1) / (pieces * sub)) * TAU;
          segs.push(
            w.addSeg(CX + Math.cos(a0) * R, CY + Math.sin(a0) * R, CX + Math.cos(a1) * R, CY + Math.sin(a1) * R, 16, hsl(hue), {
              group: i,
            }),
          );
        }
        groups.push({ segs, hp, max: hp, hue });
      }
      for (let i = 0; i < 3; i++) {
        const a = rnd(0, TAU);
        w.spawn(CX, CY, Math.cos(a) * 900, Math.sin(a) * 900, 16, hsl(rnd(0, 360), 90, 70));
      }
      w.text(`LAYER ${layer}`, CX, CY, "#ff2e88", 90, 1.2);
    };
    build();
    return {
      update(dt) {
        let inside = 0;
        for (const b of w.balls) {
          const d = Math.hypot(b.x - CX, b.y - CY);
          if (d < R) {
            inside++;
            keepSpeed(b, 950, dt, 0.8);
          } else if (!b.escaped && d > R + 25) {
            b.escaped = true;
            escaped++;
            w.sfx("whoosh", 0.6, 16, b.x);
          }
        }
        if (inside === 0 && !w.completed) {
          if (layer >= 4) w.complete("CAGE DESTROYED!");
          else build();
        }
      },
      onSeg(b, s) {
        if (s.group === undefined) return;
        const g = groups[s.group];
        if (!g || g.hp <= 0) return;
        g.hp--;
        for (const sg of g.segs) {
          sg.flash = 0.4;
          sg.color = hsl(g.hue, 90, 30 + (g.hp / g.max) * 35);
        }
        if (g.hp <= 0) {
          for (const sg of g.segs) {
            sg.on = false;
            w.burst((sg.ax + sg.bx) / 2, (sg.ay + sg.by) / 2, hsl(g.hue), 8, 500, 5);
          }
          w.sfx("break", 1, 16, b.x);
          w.shake(8);
          if (w.balls.length < 30) w.spawn(CX, CY, rnd(-600, 600), rnd(-600, 600), 16, hsl(g.hue, 90, 70));
        }
      },
      pointer(x, y) {
        if (Math.hypot(x - CX, y - CY) < R) w.spawn(x, y, rnd(-800, 800), rnd(-800, 800), 16, hsl(rnd(0, 360), 90, 70));
      },
      hud: () => {
        const broken = groups.filter((g) => g.hp <= 0).length;
        return {
          main: `LAYER ${layer} · ${broken}/${pieces} BROKEN`,
          sub: `ESCAPED ${escaped}`,
          progress: broken / pieces,
        };
      },
    };
  },
};

export const colorSims: SimDef[] = [colorBattle, lastColor, overflow, shredder, spiralFunnel, cageBreak];
