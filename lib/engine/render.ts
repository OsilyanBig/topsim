import type { SimDef, SimInstance } from "@/simulations/types";
import type { Hud } from "./types";
import { H, W, type World } from "./world";

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

let bgCache: HTMLCanvasElement | null = null;

function background(): HTMLCanvasElement {
  if (bgCache) return bgCache;
  const c = document.createElement("canvas");
  c.width = W / 2;
  c.height = H / 2;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(W / 4, H / 4 + 60, 40, W / 4, H / 4, H / 2);
  grad.addColorStop(0, "#14131f");
  grad.addColorStop(0.6, "#0a0a12");
  grad.addColorStop(1, "#040406");
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  bgCache = c;
  return c;
}

export function withAlpha(color: string, a: number): string {
  if (color.startsWith("#") && color.length === 7) {
    const v = Math.round(Math.max(0, Math.min(1, a)) * 255)
      .toString(16)
      .padStart(2, "0");
    return color + v;
  }
  if (color.startsWith("hsl(")) return color.replace("hsl(", "hsla(").replace(")", `,${a})`);
  return color;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number): number {
  ctx.font = `${weight} ${size}px ${FONT}`;
  let w = ctx.measureText(text).width;
  while (w > maxW && size > 20) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${FONT}`;
    w = ctx.measureText(text).width;
  }
  return size;
}

export function drawHud(ctx: CanvasRenderingContext2D, def: SimDef, hud: Hud): void {
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  // hook title
  const title = def.hook.toUpperCase();
  fitText(ctx, title, 900, 64, W - 120);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, W / 2, 140);

  // main counter
  fitText(ctx, hud.main, 900, 96, W - 120);
  ctx.fillStyle = def.accent;
  ctx.fillText(hud.main, W / 2, 255);

  let y = 255;
  if (hud.sub) {
    fitText(ctx, hud.sub, 700, 40, W - 140);
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.fillText(hud.sub, W / 2, 312);
    y = 312;
  }
  const barY = y + 30;
  if (hud.bars && hud.bars.length) {
    const total = hud.bars.reduce((s, b) => s + b.value, 0) || 1;
    const bw = W - 240;
    let x = 120;
    roundRect(ctx, 120, barY, bw, 22, 11);
    ctx.save();
    ctx.clip();
    for (const b of hud.bars) {
      const w = (b.value / total) * bw;
      ctx.fillStyle = b.color;
      ctx.fillRect(x, barY, w + 0.5, 22);
      x += w;
    }
    ctx.restore();
  } else if (hud.progress !== undefined) {
    const p = Math.max(0, Math.min(1, hud.progress));
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    roundRect(ctx, 180, barY, W - 360, 14, 7);
    ctx.fill();
    if (p > 0) {
      ctx.fillStyle = def.accent;
      roundRect(ctx, 180, barY, Math.max(14, (W - 360) * p), 14, 7);
      ctx.fill();
    }
  }
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function drawWorld(
  ctx: CanvasRenderingContext2D,
  world: World,
  def: SimDef,
  inst: SimInstance,
  opts: { trails: boolean },
): void {
  const trail = opts.trails ? def.trail ?? 0 : 0;
  ctx.save();
  if (trail > 0) {
    ctx.globalAlpha = 1 - trail;
    ctx.drawImage(background(), 0, 0, W, H);
    ctx.globalAlpha = 1;
  } else {
    ctx.drawImage(background(), 0, 0, W, H);
  }

  if (world.shakeAmt > 0) {
    ctx.translate((Math.random() - 0.5) * world.shakeAmt, (Math.random() - 0.5) * world.shakeAmt);
  }

  inst.drawBack?.(ctx);

  // bounds
  const bd = world.bounds;
  if (bd && bd.visible) {
    ctx.strokeStyle = withAlpha(bd.color, 0.25);
    ctx.lineWidth = 18;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    boundsPath(ctx, bd);
    ctx.stroke();
    ctx.strokeStyle = bd.color;
    ctx.lineWidth = 6;
    boundsPath(ctx, bd);
    ctx.stroke();
  }

  // rings
  for (const r of world.rings) {
    if (!r.visible) continue;
    const col = r.flash > 0 ? "#ffffff" : r.color;
    ctx.lineCap = "round";
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass === 0 ? withAlpha(r.color, 0.22) : col;
      ctx.lineWidth = pass === 0 ? r.w + 14 : r.w;
      if (!r.gaps.length) {
        ctx.beginPath();
        ctx.arc(r.cx, r.cy, r.r, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        const gaps = r.gaps
          .map((g) => ({ s: g.a + r.rot - g.w / 2, e: g.a + r.rot + g.w / 2 }))
          .sort((a, b) => a.s - b.s);
        for (let i = 0; i < gaps.length; i++) {
          const from = gaps[i].e;
          let to = i + 1 < gaps.length ? gaps[i + 1].s : gaps[0].s + Math.PI * 2;
          if (to < from) to += Math.PI * 2;
          ctx.beginPath();
          ctx.arc(r.cx, r.cy, r.r, from, to);
          ctx.stroke();
        }
      }
    }
  }

  // segments
  ctx.lineCap = "round";
  for (const s of world.segs) {
    if (!s.visible || !s.on) continue;
    ctx.strokeStyle = withAlpha(s.color, 0.22);
    ctx.lineWidth = s.w + 12;
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.bx, s.by);
    ctx.stroke();
    ctx.strokeStyle = s.flash > 0 ? "#ffffff" : s.color;
    ctx.lineWidth = s.w;
    ctx.beginPath();
    ctx.moveTo(s.ax, s.ay);
    ctx.lineTo(s.bx, s.by);
    ctx.stroke();
  }

  // pegs
  for (const p of world.pegs) {
    if (!p.visible || !p.on) continue;
    ctx.fillStyle = withAlpha(p.color, 0.2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.flash > 0 ? "#ffffff" : p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBalls(ctx, world);

  // particles
  for (const p of world.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.max);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  inst.drawFront?.(ctx);

  // floating texts
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const t of world.texts) {
    const a = Math.min(1, t.life / (t.max * 0.5));
    ctx.globalAlpha = a;
    ctx.font = `900 ${t.size}px ${FONT}`;
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  drawHud(ctx, def, inst.hud());

  if (def.footer) {
    ctx.textAlign = "center";
    ctx.font = `700 34px ${FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText(def.footer, W / 2, H - 90);
  }

  if (world.completed) {
    const k = Math.min(1, (world.t - world.completeAt) * 3);
    ctx.globalAlpha = k;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = fitText(ctx, world.completeMsg, 900, 110, W - 100);
    ctx.font = `900 ${size}px ${FONT}`;
    ctx.lineWidth = 14;
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.strokeText(world.completeMsg, W / 2, H * 0.52);
    ctx.fillStyle = def.accent;
    ctx.fillText(world.completeMsg, W / 2, H * 0.52);
    ctx.globalAlpha = 1;
  }
}

function boundsPath(ctx: CanvasRenderingContext2D, bd: NonNullable<World["bounds"]>): void {
  ctx.beginPath();
  if (bd.openTop) ctx.moveTo(bd.x0, bd.y0);
  else {
    ctx.moveTo(bd.x1, bd.y0);
    ctx.lineTo(bd.x0, bd.y0);
  }
  ctx.lineTo(bd.x0, bd.y1);
  if (bd.openBottom) {
    ctx.moveTo(bd.x1, bd.y1);
  } else {
    ctx.lineTo(bd.x1, bd.y1);
  }
  ctx.lineTo(bd.x1, bd.y0);
}

function drawBalls(ctx: CanvasRenderingContext2D, world: World): void {
  const balls = world.balls;
  const n = balls.length;
  if (!n) return;
  // batch fills by color
  let cur = "";
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const b = balls[i];
    const col = b.flash > 0 ? "#ffffff" : b.color;
    if (col !== cur) {
      if (cur) ctx.fill();
      ctx.fillStyle = col;
      cur = col;
      ctx.beginPath();
    }
    ctx.moveTo(b.x + b.r, b.y);
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  }
  ctx.fill();
  // glossy highlight in one pass
  ctx.fillStyle = "rgba(255,255,255,0.33)";
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const b = balls[i];
    if (b.r < 4) continue;
    const hr = b.r * 0.32;
    const hx = b.x - b.r * 0.33;
    const hy = b.y - b.r * 0.33;
    ctx.moveTo(hx + hr, hy);
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
  }
  ctx.fill();
}
