import type { Hud, WorldHooks } from "@/lib/engine/types";
import type { World } from "@/lib/engine/world";
import type { SoundProfile } from "@/lib/audio/AudioEngine";

export type Category = "multiply" | "obstacle" | "color" | "physics";

export const CATEGORY_LABELS: Record<Category, string> = {
  multiply: "A · Çoğalma & Katlanma",
  obstacle: "B · Pervane & Engeller",
  color: "C · Renk Yarışı & Taşma",
  physics: "D · Fizik & Etkileşim",
};

export interface SimInstance extends WorldHooks {
  /** called once per frame before physics */
  update?(dt: number): void;
  /** click / tap in world coordinates */
  pointer?(x: number, y: number): void;
  drawBack?(ctx: CanvasRenderingContext2D): void;
  drawFront?(ctx: CanvasRenderingContext2D): void;
  hud(): Hud;
}

export interface SimDef {
  id: string;
  name: string;
  category: Category;
  /** short hook title drawn at the top of the scene */
  hook: string;
  description: string;
  accent: string;
  sound: SoundProfile;
  /** 0 = clear every frame, >0 = motion trail strength (0..0.9) */
  trail?: number;
  /** footer text at the bottom of the frame */
  footer?: string;
  create(w: World): SimInstance;
}
