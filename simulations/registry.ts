import { colorSims } from "./color";
import { multiplySims } from "./multiply";
import { obstacleSims } from "./obstacles";
import { physicsSims } from "./physics";
import type { Category, SimDef } from "./types";

/**
 * Central simulation registry. To add a new simulation, create a SimDef in the
 * matching category folder and add it to that category's exported array.
 */
export const SIMULATIONS: SimDef[] = [...multiplySims, ...obstacleSims, ...colorSims, ...physicsSims];

export const CATEGORIES: Category[] = ["multiply", "obstacle", "color", "physics"];

export function simsByCategory(cat: Category): { sim: SimDef; index: number }[] {
  return SIMULATIONS.map((sim, index) => ({ sim, index })).filter((x) => x.sim.category === cat);
}

export function findSimIndex(id: string): number {
  return SIMULATIONS.findIndex((s) => s.id === id);
}
