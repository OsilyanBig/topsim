import type { SimDef, SimInstance } from "../types";
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
  keepSpeed,
  makeRotor,
  pick,
  rnd,
  rndInt,
  tapSpawn,
  TEAM_COLORS,
  type Rotor,
} from "../helpers";
import type { Peg } from "@/lib/engine/types";

// ---------------------------------------------------------------- 25
const zeroG: SimDef = {
  id: "zero-g",
  name: "Zero-G Float",
  category: "physics",
  hook: "Zero Gravity Relaxation",
  description: "Yerçekimsiz ortamda duvar ve engellerden sekerek süzülen toplar.",
  accent: "#bdb2ff",
  sound: "glass",
  trail: 0.35,
  create(w) {
    circleArena(w, "#bdb2ff");
    w.gravity = { x: 0, y: 0 };
    w.wallRestitution = 1;
    w.ballRestitution = 1;
    w.friction = 0;
    const pal = PALETTES.candy;
    for (let i = 0; i < 5; i++) {
      const a = (i * TAU) / 5;
      w.addPeg(CX + Math.cos(a) * 250, CY + Math.sin(a) * 250, 30, "#a0c4ff", { bounce: 1 });
    }
    const rotor = makeRotor(w, CX, CY, 2, 140, 14, "#ffc6ff", 0.4);
    fillCircle(w, 70, () => rnd(10, 32), (i) => pal[i % pal.length], 300, R - 50);
    return {
      update(dt) {
        rotor.update(dt);
        for (const b of w.balls) keepSpeed(b, 300, dt, 0.5);
      },
      onPeg(b, p) {
        p.flash = 0.3;
      },
      pointer(x, y) {
        tapSpawn(w, x, y, rnd(12, 30), pick(pal));
      },
      hud: () => ({ main: `FLOATING: ${w.count}`, sub: "NO GRAVITY · PURE BOUNCE" }),
    };
  },
};

// ---------------------------------------------------------------- 26
const highG: SimDef = {
  id: "high-gravity",
  name: "High-Gravity Drop",
  category: "physics",
  hook: "3x Gravity Drop",
  description: "Yüksek yerçekimi ve yüksek sekme ile sert düşüşler; zemin periyodik olarak açılır.",
  accent: "#ff1e1e",
  sound: "soft",
  create(w) {
    const bd = { x0: 80, y0: 380, x1: 1000, y1: 1880, color: "#ff1e1e", visible: true, openBottom: false };
    w.bounds = bd;
    w.gravity.y = 4200;
    w.wallRestitution = 0.9;
    w.ballRestitution = 0.85;
    w.maxSpeed = 4000;
    w.substeps = 6;
    w.addSeg(80, 900, 440, 1010, 14, "#ffb800", { bounce: 0.95 });
    w.addSeg(1000, 1160, 640, 1270, 14, "#ffb800", { bounce: 0.95 });
    w.addSeg(80, 1420, 400, 1520, 14, "#ffb800", { bounce: 0.95 });
    let dropT = 0;
    let drops = 0;
    let floorT = 10;
    let open = 0;
    const pal = PALETTES.fire;
    return {
      update(dt) {
        dropT -= dt;
        if (dropT <= 0 && w.count < 280) {
          dropT = 1.4;
          drops++;
          const x0 = rnd(200, 880);
          for (let i = 0; i < 10; i++) w.spawn(x0 + rnd(-80, 80), 420 + rnd(0, 60), rnd(-100, 100), 0, rnd(10, 18), pick(pal));
          w.sfx("whoosh", 0.6, 20, x0);
        }
        floorT -= dt;
        if (floorT <= 0 && open <= 0) {
          open = 1.6;
          bd.openBottom = true;
          w.text("FLOOR OPEN!", CX, 1750, "#ff1e1e", 70, 1.2);
          w.sfx("boom", 0.8, 30, CX);
        }
        if (open > 0) {
          open -= dt;
          if (open <= 0) {
            bd.openBottom = false;
            floorT = 10;
          }
        }
      },
      onWall(b, imp) {
        if (imp > 2500) w.shake(4);
      },
      onSeg(b, s) {
        s.flash = 0.3;
      },
      pointer(x, y) {
        for (let i = 0; i < 6; i++) w.spawn(x + rnd(-30, 30), y, rnd(-100, 100), 0, rnd(10, 18), pick(pal));
      },
      hud: () => ({
        main: `DROPS: ${drops}`,
        sub: `G 3.0x · BALLS ${w.count} · FLOOR ${open > 0 ? "OPEN" : `IN ${Math.ceil(floorT)}s`}`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 27
const orbit: SimDef = {
  id: "orbit-well",
  name: "Orbit / Gravity Well",
  category: "physics",
  hook: "Caught in the Gravity Well",
  description: "Merkezdeki çekim alanı topları yörüngede tutar ve yutar.",
  accent: "#ffe45c",
  sound: "glass",
  trail: 0.6,
  create(w) {
    w.gravity = { x: 0, y: 0 };
    w.ballCollisions = false;
    w.maxSpeed = 3000;
    w.drag = 0.035;
    let G = 1.0e8;
    const core = w.addPeg(CX, CY, 46, "#ffe45c", { on: false });
    let absorbed = 0;
    const spawnOrbiter = (x?: number, y?: number) => {
      let px = x;
      let py = y;
      if (px === undefined || py === undefined) {
        const a = rnd(0, TAU);
        const d = rnd(170, 470);
        px = CX + Math.cos(a) * d;
        py = CY + Math.sin(a) * d;
      }
      const dx = px - CX;
      const dy = py - CY;
      const d = Math.hypot(dx, dy) || 1;
      const v = Math.sqrt(G / d) * rnd(0.85, 1.08);
      w.spawn(px, py, (-dy / d) * v, (dx / d) * v, rnd(5, 11), hsl(30 + (d / 470) * 200, 95, 62));
    };
    for (let i = 0; i < 130; i++) spawnOrbiter();
    return {
      update(dt) {
        if (w.count < 130 && Math.random() < dt * 12) spawnOrbiter();
        for (const b of w.balls) {
          const d = Math.hypot(b.x - CX, b.y - CY);
          if (d < core.r + b.r * 0.5) {
            w.kill(b);
            absorbed++;
            core.r = Math.min(110, core.r + 0.25);
            G *= 1.002;
            core.flash = 0.3;
            w.burst(b.x, b.y, b.color, 5, 250, 3);
            w.sfx("pop", 0.5, 12 - Math.min(10, absorbed / 20), b.x);
          } else if (d > 1100) w.kill(b);
        }
      },
      force(b, dt) {
        const dx = CX - b.x;
        const dy = CY - b.y;
        const d2 = dx * dx + dy * dy + 900;
        const d = Math.sqrt(d2);
        const f = (G / d2) * dt;
        b.vx += (dx / d) * f;
        b.vy += (dy / d) * f;
      },
      drawBack(ctx) {
        const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, core.r * 3.2);
        g.addColorStop(0, "rgba(255,228,92,0.55)");
        g.addColorStop(0.35, "rgba(255,140,40,0.18)");
        g.addColorStop(1, "rgba(255,140,40,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(CX, CY, core.r * 3.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = core.flash > 0 ? "#fff" : "#000";
        ctx.beginPath();
        ctx.arc(CX, CY, core.r, 0, TAU);
        ctx.fill();
        ctx.strokeStyle = "#ffe45c";
        ctx.lineWidth = 4;
        ctx.stroke();
      },
      pointer(x, y) {
        for (let i = 0; i < 8; i++) spawnOrbiter(x + rnd(-25, 25), y + rnd(-25, 25));
      },
      hud: () => ({
        main: `ABSORBED: ${fmt(absorbed)}`,
        sub: `ORBITING ${w.count} · MASS x${(G / 1e8).toFixed(2)}`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 28
const shockwave: SimDef = {
  id: "click-shockwave",
  name: "Click Shockwave",
  category: "physics",
  hook: "Tap = SHOCKWAVE",
  description: "Ekrana dokununca şok dalgası topları fırlatır (dokunulmazsa otomatik).",
  accent: "#00e5ff",
  sound: "marimba",
  create(w) {
    circleArena(w, "#00e5ff");
    w.gravity.y = 1400;
    w.wallRestitution = 0.6;
    w.ballRestitution = 0.5;
    const pal = PALETTES.neon;
    fillCircle(w, 330, 12, (i) => pal[i % pal.length], 0);
    const waves: { x: number; y: number; t: number }[] = [];
    let count = 0;
    let idle = 0;
    const blast = (x: number, y: number) => {
      count++;
      idle = 0;
      waves.push({ x, y, t: 0 });
      for (const b of w.balls) {
        const dx = b.x - x;
        const dy = b.y - y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 480) {
          const k = 2800 * (1 - d / 480);
          b.vx += (dx / d) * k;
          b.vy += (dy / d) * k;
          if (d < 200) b.flash = 0.3;
        }
      }
      w.sfx("boom", 1, 20, x);
      w.shake(18);
      w.burst(x, y, "#00e5ff", 18, 800, 5);
    };
    return {
      update(dt) {
        idle += dt;
        if (idle > 2.6) {
          const a = rnd(0, TAU);
          const d = rnd(0, R * 0.7);
          blast(CX + Math.cos(a) * d, CY + Math.sin(a) * d * 0.5 + 150);
        }
        for (const wv of waves) wv.t += dt;
        while (waves.length && waves[0].t > 0.7) waves.shift();
      },
      drawFront(ctx) {
        for (const wv of waves) {
          const k = wv.t / 0.7;
          ctx.strokeStyle = `rgba(0,229,255,${1 - k})`;
          ctx.lineWidth = 14 * (1 - k) + 2;
          ctx.beginPath();
          ctx.arc(wv.x, wv.y, 20 + k * 480, 0, TAU);
          ctx.stroke();
        }
      },
      pointer(x, y) {
        blast(x, y);
      },
      hud: () => ({ main: `SHOCKWAVES: ${count}`, sub: `BALLS ${w.count} · TAP ANYWHERE` }),
    };
  },
};

// ---------------------------------------------------------------- 29
const wind: SimDef = {
  id: "wind-stream",
  name: "Wind / Breeze Stream",
  category: "physics",
  hook: "Caught in the Breeze",
  description: "Değişen hava akımları topları savurur.",
  accent: "#90e0ef",
  sound: "soft",
  create(w) {
    w.bounds = { x0: 80, y0: 380, x1: 1000, y1: 1880, color: "#90e0ef", visible: true };
    w.gravity.y = 900;
    w.wallRestitution = 0.7;
    w.ballRestitution = 0.6;
    const pal = PALETTES.ocean;
    for (let i = 0; i < 220; i++) w.spawn(rnd(120, 960), rnd(1300, 1850), 0, 0, rnd(8, 15), pal[i % pal.length]);
    let dir = 1;
    let dirT = 4;
    let strength = 0;
    let ventX = CX;
    const ventW = 230;
    const streaks = Array.from({ length: 70 }, () => ({ x: rnd(80, 1000), y: rnd(380, 1880), l: rnd(30, 90) }));
    const windAt = (y: number) => dir * strength * (0.55 + 0.45 * Math.sin(y * 0.006 + w.t * 1.7));
    return {
      update(dt) {
        dirT -= dt;
        if (dirT <= 0) {
          dirT = 4;
          dir = -dir;
          w.sfx("whoosh", 1, 20, dir > 0 ? 900 : 180);
        }
        // gusty side wind + a wandering updraft vent on the floor
        strength = 1500 + 900 * Math.sin(w.t * 0.9);
        ventX = CX + Math.sin(w.t * 0.55) * 330;
        for (const s of streaks) {
          s.x += windAt(s.y) * dt * 0.4;
          if (s.x > 1000) s.x = 80;
          if (s.x < 80) s.x = 1000;
        }
      },
      force(b, dt) {
        b.vx += (windAt(b.y) / (b.r * 0.1)) * dt;
        const dx = Math.abs(b.x - ventX);
        if (dx < ventW / 2) {
          const k = 1 - dx / (ventW / 2);
          b.vy -= (500 + 1700 * k) * dt;
        }
      },
      drawBack(ctx) {
        ctx.strokeStyle = "rgba(144,224,239,0.25)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (const s of streaks) {
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(s.x - dir * s.l, s.y);
        }
        ctx.stroke();
        const g = ctx.createLinearGradient(0, 1880, 0, 700);
        g.addColorStop(0, "rgba(144,224,239,0.22)");
        g.addColorStop(1, "rgba(144,224,239,0)");
        ctx.fillStyle = g;
        ctx.fillRect(ventX - ventW / 2, 700, ventW, 1180);
        ctx.fillStyle = "#90e0ef";
        ctx.fillRect(ventX - ventW / 2, 1862, ventW, 14);
      },
      pointer(x, y) {
        dir = -dir;
        dirT = 4;
        w.sfx("whoosh", 1, 20, x);
        w.burst(x, y, "#90e0ef", 10, 400, 4);
      },
      hud: () => ({
        main: `WIND ${dir > 0 ? "→" : "←"} ${(strength / 1000).toFixed(1)}`,
        sub: `BALLS ${w.count} · CHANGES IN ${Math.ceil(dirT)}s`,
      }),
    };
  },
};

// ---------------------------------------------------------------- 30
const chaos: SimDef = {
  id: "chaos-mix",
  name: "Chaos Mix (Randomizer)",
  category: "physics",
  hook: "Random Chaos Scenario",
  description: "Rastgele parametre, palet ve engellerle her yeniden başlatmada yeni senaryo (R / New Scenario).",
  accent: "#ff8a2a",
  sound: "marimba",
  create(w) {
    const seed = rndInt(1000, 9999);
    const palName = pick(Object.keys(PALETTES));
    const pal = PALETTES[palName];
    const box = Math.random() < 0.3;
    if (box) w.bounds = { x0: 80, y0: 400, x1: 1000, y1: 1860, color: pal[0], visible: true };
    else circleArena(w, pal[0], { gaps: Math.random() < 0.25 ? [{ a: Math.PI / 2, w: 0.3 }] : [] });
    const g = pick([0, 600, 1200, 1800, 2600]);
    const ga = pick([Math.PI / 2, Math.PI / 2, rnd(0, TAU)]);
    w.gravity = { x: Math.cos(ga) * g, y: Math.sin(ga) * g };
    w.wallRestitution = rnd(0.6, 1);
    w.ballRestitution = rnd(0.5, 1);
    w.ballCollisions = Math.random() < 0.8;
    w.maxBalls = 800;
    const rotors: Rotor[] = [];
    const obstacles: string[] = [];
    if (Math.random() < 0.7) {
      const arms = rndInt(1, 5);
      rotors.push(makeRotor(w, CX, CY, arms, rnd(200, 380), rnd(12, 26), pal[1 % pal.length], rnd(0.8, 3) * (Math.random() < 0.5 ? -1 : 1)));
      obstacles.push(`${arms}-ARM ROTOR`);
    }
    const bumpers: Peg[] = [];
    const nb = rndInt(0, 6);
    for (let i = 0; i < nb; i++) {
      const a = (i * TAU) / nb + rnd(-0.2, 0.2);
      bumpers.push(w.addPeg(CX + Math.cos(a) * rnd(250, 330), CY + Math.sin(a) * rnd(250, 330), rnd(18, 40), pal[2 % pal.length], { bounce: rnd(0.9, 1.3) }));
    }
    if (nb) obstacles.push(`${nb} BUMPERS`);
    const rule = pick(["SPLIT ON WALL", "COLOR CONVERT", "PURE PHYSICS", "CLONE ON ROTOR"] as const);
    const r = rnd(8, 18);
    const n = rule === "SPLIT ON WALL" || rule === "CLONE ON ROTOR" ? rndInt(1, 4) : rndInt(60, 220);
    const teams = Math.min(pal.length, 4);
    fillCircle(w, n, r, (i) => (rule === "COLOR CONVERT" ? TEAM_COLORS[i % teams] : pal[i % pal.length]), rnd(200, 700), box ? 380 : R - 50, (i) => ({
      team: i % teams,
    }));
    const keep = g === 0;
    const inst: SimInstance = {
      update(dt) {
        for (const ro of rotors) ro.update(dt);
        if (keep) for (const b of w.balls) keepSpeed(b, 400, dt, 0.5);
        if (w.count >= w.maxBalls && rule !== "PURE PHYSICS" && rule !== "COLOR CONVERT") w.complete("CHAOS COMPLETE!");
      },
      onWall(b, imp) {
        if (rule === "SPLIT ON WALL" && b.cd <= 0 && imp > 200) {
          b.cd = 0.25;
          if (w.clone(b, rnd(-0.5, 0.5))) w.sfx("split", 0.6, b.r, b.x);
        }
      },
      onSeg(b, s, imp) {
        s.flash = 0.2;
        if (rule === "CLONE ON ROTOR" && b.cd <= 0 && imp > 100) {
          b.cd = 0.3;
          const c = w.clone(b, rnd(-0.6, 0.6));
          if (c) c.color = pick(pal);
        }
      },
      onPeg(b, p) {
        p.flash = 0.3;
      },
      onBall(a, b) {
        if (rule === "COLOR CONVERT" && a.team !== b.team) {
          b.team = a.team;
          b.color = a.color;
          b.flash = 0.3;
        }
      },
      pointer(x, y) {
        tapSpawn(w, x, y, r, pick(pal));
      },
      hud: () => ({
        main: `SEED #${seed}`,
        sub: `${rule} · ${obstacles.join(" + ") || "OPEN ARENA"} · ${palName.toUpperCase()} · BALLS ${w.count}`,
      }),
    };
    return inst;
  },
};

export const physicsSims: SimDef[] = [zeroG, highG, orbit, shockwave, wind, chaos];
