// KERJAKU Interior Studio — Milestone B: Parametric Kitchen Assembly.
// Isolated module (see AGENTS.md / project knowledge): no production generator imports this.
// Every component is derived from ONE KitchenBlueprint; geometry is deterministic, mm units.
// Axes: x left→right, y floor→up, z wall(0)→front.

import type { Box, DimensionStatus } from "./types";

export type MechKind = "swing" | "lift-up" | "drawer";

export interface ColumnSpec {
  id: string; // visual opening column
  width: number;
  /** Fronts from TOP to BOTTOM; each slot height share is explicit (mm, incl. gaps). */
  slots: SlotSpec[];
}
export type SlotSpec =
  | { kind: "swing"; height: number; leaves: { id: string; hingeSide: "left" | "right" }[] }
  | { kind: "lift-up"; height: number; id: string; glass: boolean }
  | { kind: "drawers"; height: number; ids: string[] };

export interface RunSpec {
  id: "UPPER" | "LOWER";
  width: number;
  height: number;
  depth: number;
  /** Bottom of carcass above floor. */
  elevation: number;
  /** Carcass modules (independent boxes). Widths must sum to run width. */
  modules: { id: string; width: number; columns: string[] }[];
  columns: ColumnSpec[];
  /** Verified against SME survey? false = PROVISIONAL. */
  moduleWidthStatus: DimensionStatus;
  moduleCountVerifiedBySme: boolean;
}

export interface KitchenBlueprint {
  projectId: string;
  name: string;
  runs: RunSpec[];
  plinthHeight: number;
  plinthSetback: number;
  construction: { panel: number; back: number; door: number; gap: number; drawerSide: number; drawerBottom: number };
  materials: { body: string; door: string; glass: string; back: string; plinth: string };
  hardware: { hingeRef: string; railRef: string; gasSpringRef: string; railLength: number };
  overallStatus: DimensionStatus;
}

export type Role =
  | "side" | "top" | "bottom" | "back" | "shelf" | "divider"
  | "door" | "lift-door" | "drawer-front" | "drawer-side" | "drawer-back" | "drawer-bottom"
  | "plinth" | "filler";

export interface Mechanism {
  kind: MechKind;
  /** swing: vertical axis (x,z); lift-up: horizontal axis along x at (y,z); drawer: travel along +z. */
  pivot: { x: number; y: number; z: number };
  axis: "y" | "x" | "z";
  /** +1/-1 rotation direction so that the leaf opens outward (+z). */
  sign: 1 | -1;
  maxOpen: number; // degrees, or mm for drawer
}

export interface KComponent {
  id: string;
  role: Role;
  runId: RunSpec["id"];
  moduleId: string | null; // null for plinth/filler (separate components)
  columnId: string | null;
  /** Front/leaf group this panel moves with (drawer box parts share their front's id). */
  movesWith: string | null;
  box: Box;
  thickness: number;
  material: string;
  status: DimensionStatus;
  mechanism?: Mechanism;
  hingeSide?: "left" | "right";
  connects: string[]; // ids of components it is fixed to
}

export interface KitchenAssembly {
  blueprint: KitchenBlueprint;
  components: KComponent[];
  productionReady: boolean;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Adji fixture — structure from photo reconciliation; ALL widths PROVISIONAL.
// ---------------------------------------------------------------------------
export function adjiBlueprint(): KitchenBlueprint {
  return {
    projectId: "ADJI-KITCHEN",
    name: "Kitchen Set Adji",
    plinthHeight: 100,
    plinthSetback: 50,
    construction: { panel: 18, back: 6, door: 18, gap: 3, drawerSide: 15, drawerBottom: 6 },
    materials: { body: "Multiplek 18 mm + HPL putih", door: "Multiplek 18 mm + HPL kayu", glass: "Kaca 5 mm frame alu", back: "Multiplek 6 mm", plinth: "Multiplek 18 mm + HPL hitam" },
    hardware: { hingeRef: "TACO ET-01", railRef: "TACO BBS 006 FE", gasSpringRef: "Gas spring lift-up", railLength: 450 },
    overallStatus: "provisional",
    runs: [
      {
        id: "UPPER", width: 2400, height: 800, depth: 350, elevation: 1500,
        moduleWidthStatus: "provisional", moduleCountVerifiedBySme: false,
        // 4 carcasses; boundaries align with opening columns so no leaf straddles a divider.
        modules: [
          { id: "UA1", width: 450, columns: ["UC1"] },
          { id: "UA2", width: 500, columns: ["UC2"] },
          { id: "UA3", width: 1000, columns: ["UC3", "UC4"] },
          { id: "UA4", width: 450, columns: ["UC5"] },
        ],
        columns: [
          { id: "UC1", width: 450, slots: [
            { kind: "swing", height: 500, leaves: [{ id: "D01", hingeSide: "left" }] },
            { kind: "lift-up", height: 300, id: "L01", glass: true } ] },
          { id: "UC2", width: 500, slots: [
            { kind: "swing", height: 400, leaves: [{ id: "D02", hingeSide: "left" }] },
            { kind: "swing", height: 400, leaves: [{ id: "D03", hingeSide: "left" }] } ] },
          { id: "UC3", width: 500, slots: [
            { kind: "swing", height: 400, leaves: [{ id: "D04", hingeSide: "left" }, { id: "D05", hingeSide: "right" }] },
            { kind: "swing", height: 400, leaves: [{ id: "D06", hingeSide: "left" }] } ] },
          { id: "UC4", width: 500, slots: [
            { kind: "swing", height: 400, leaves: [{ id: "D07", hingeSide: "right" }] },
            { kind: "swing", height: 400, leaves: [{ id: "D08", hingeSide: "right" }] } ] },
          { id: "UC5", width: 450, slots: [
            { kind: "swing", height: 500, leaves: [{ id: "D09", hingeSide: "right" }] },
            { kind: "lift-up", height: 300, id: "L02", glass: true } ] },
        ],
      },
      {
        id: "LOWER", width: 2400, height: 750, depth: 600, elevation: 100,
        moduleWidthStatus: "provisional", moduleCountVerifiedBySme: false,
        modules: [
          { id: "LB1", width: 600, columns: ["LC1"] },
          { id: "LB2", width: 500, columns: ["LC2"] },
          { id: "LB3", width: 700, columns: ["LC3"] },
          { id: "LB4", width: 600, columns: ["LC4"] },
        ],
        columns: [
          { id: "LC1", width: 600, slots: [{ kind: "swing", height: 750, leaves: [{ id: "D10", hingeSide: "left" }] }] },
          { id: "LC2", width: 500, slots: [{ kind: "drawers", height: 750, ids: ["DR01", "DR02", "DR03"] }] },
          { id: "LC3", width: 700, slots: [{ kind: "swing", height: 750, leaves: [{ id: "D11", hingeSide: "left" }] }] },
          { id: "LC4", width: 600, slots: [{ kind: "swing", height: 750, leaves: [{ id: "D12", hingeSide: "right" }] }] },
        ],
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
export function validateBlueprint(bp: KitchenBlueprint): string[] {
  const e: string[] = [];
  const ids = new Set<string>();
  const add = (id: string) => { if (ids.has(id)) e.push(`ID ganda: ${id}`); ids.add(id); };
  for (const r of bp.runs) {
    const mw = r.modules.reduce((s, m) => s + m.width, 0);
    if (mw !== r.width) e.push(`${r.id}: total lebar modul ${mw} ≠ ${r.width}`);
    const cw = r.columns.reduce((s, c) => s + c.width, 0);
    if (cw !== r.width) e.push(`${r.id}: total lebar kolom ${cw} ≠ ${r.width}`);
    const colIds = r.columns.map((c) => c.id);
    const used = r.modules.flatMap((m) => m.columns);
    if (used.join() !== colIds.join()) e.push(`${r.id}: kolom tidak terpetakan 1:1 ke modul`);
    for (const m of r.modules) {
      add(m.id);
      const w = m.columns.reduce((s, id) => s + (r.columns.find((c) => c.id === id)?.width ?? 0), 0);
      if (w !== m.width) e.push(`${m.id}: kolom ${w} ≠ modul ${m.width} (daun akan melintasi sekat)`);
    }
    for (const c of r.columns) {
      add(c.id);
      const h = c.slots.reduce((s, sl) => s + sl.height, 0);
      if (h !== r.height) e.push(`${c.id}: total tinggi slot ${h} ≠ ${r.height}`);
      for (const s of c.slots) {
        if (s.kind === "swing") {
          if (s.leaves.length < 1 || s.leaves.length > 2) e.push(`${c.id}: slot swing harus 1–2 daun`);
          if (s.leaves.length === 2 && !(s.leaves[0]!.hingeSide === "left" && s.leaves[1]!.hingeSide === "right"))
            e.push(`${c.id}: pasangan daun harus engsel kiri+kanan`);
          s.leaves.forEach((l) => add(l.id));
        } else if (s.kind === "lift-up") add(s.id);
        else s.ids.forEach(add);
      }
    }
  }
  return e;
}

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------
export function hingesPerLeaf(heightMm: number): number {
  // Common manufacturer guidance for concealed hinges (per leaf height); final check vs weight required.
  if (heightMm <= 900) return 2;
  if (heightMm <= 1600) return 3;
  if (heightMm <= 2000) return 4;
  return 5;
}

export function compileKitchen(bp: KitchenBlueprint): KitchenAssembly {
  const errs = validateBlueprint(bp);
  if (errs.length) throw new Error(`Blueprint tidak valid: ${errs.join("; ")}`);
  const T = bp.construction.panel, BT = bp.construction.back, DT = bp.construction.door, G = bp.construction.gap;
  const M = bp.materials;
  const out: KComponent[] = [];
  const warnings: string[] = [];
  const st = (r: RunSpec): DimensionStatus => (r.moduleWidthStatus === "verified" && r.moduleCountVerifiedBySme ? "verified" : "provisional");
  for (const r of bp.runs) {
    if (!r.moduleCountVerifiedBySme) warnings.push(`${r.id}: jumlah karkas (${r.modules.length}) belum diverifikasi data SME`);
    if (r.moduleWidthStatus !== "verified") warnings.push(`${r.id}: lebar modul PROVISIONAL`);
    const s = st(r);
    const y0 = r.elevation, H = r.height, D = r.depth;
    let mx = 0;
    for (const m of r.modules) {
      const p = (id: string, role: Role, box: Box, th: number, material = M.body, connects: string[] = []): KComponent =>
        ({ id, role, runId: r.id, moduleId: m.id, columnId: null, movesWith: null, box, thickness: th, material, status: s, connects });
      const sideL = p(`${m.id}-SL`, "side", { x: mx, y: y0, z: 0, w: T, h: H, d: D }, T);
      const sideR = p(`${m.id}-SR`, "side", { x: mx + m.width - T, y: y0, z: 0, w: T, h: H, d: D }, T);
      const inner = m.width - 2 * T;
      const top = p(`${m.id}-TP`, "top", { x: mx + T, y: y0 + H - T, z: 0, w: inner, h: T, d: D }, T, M.body, [sideL.id, sideR.id]);
      const bot = p(`${m.id}-BT`, "bottom", { x: mx + T, y: y0, z: 0, w: inner, h: T, d: D }, T, M.body, [sideL.id, sideR.id]);
      // back sits inside, behind a 0 setback (flush to wall face), between top & bottom
      const back = p(`${m.id}-BK`, "back", { x: mx + T, y: y0 + T, z: 0, w: inner, h: H - 2 * T, d: BT }, BT, M.back, [sideL.id, sideR.id, top.id, bot.id]);
      out.push(sideL, sideR, top, bot, back);
      // dividers between columns inside the same module
      let cx = mx;
      m.columns.forEach((cid, i) => {
        const col = r.columns.find((c) => c.id === cid)!;
        if (i > 0) out.push({ ...p(`${m.id}-DV${i}`, "divider", { x: cx - T / 2, y: y0 + T, z: BT, w: T, h: H - 2 * T, d: D - BT }, T, M.body, [top.id, bot.id]), columnId: cid });
        // fixed shelf at each slot boundary (structural; separates stacked fronts)
        let sy = y0 + H;
        col.slots.forEach((sl, k) => {
          sy -= sl.height;
          if (k < col.slots.length - 1 && sl.kind !== "drawers") {
            const xl = cx + (i === 0 ? T : T / 2), xr = cx + col.width - (i === m.columns.length - 1 ? T : T / 2);
            out.push({ ...p(`${cid}-SH${k + 1}`, "shelf", { x: xl, y: sy - T / 2, z: BT, w: xr - xl, h: T, d: D - BT }, T), columnId: cid });
          }
        });
        cx += col.width;
      });
      mx += m.width;
    }
    // Fronts (overlay), per column, top→bottom
    let cx = 0;
    for (const col of r.columns) {
      const moduleId = r.modules.find((m) => m.columns.includes(col.id))!.id;
      let top = y0 + H;
      for (const sl of col.slots) {
        const yb = top - sl.height;
        const fz = D; // fronts sit in front of carcass
        const f = (id: string, role: Role, box: Box, th: number, material: string, extra: Partial<KComponent>): KComponent =>
          ({ id, role, runId: r.id, moduleId, columnId: col.id, movesWith: id, box, thickness: th, material, status: s, connects: [], ...extra });
        if (sl.kind === "swing") {
          const n = sl.leaves.length;
          const lw = (col.width - G * (n + 1)) / n;
          sl.leaves.forEach((l, i) => {
            const x = cx + G + i * (lw + G);
            const box = { x, y: yb + G / 2, z: fz, w: lw, h: sl.height - G, d: DT };
            const hx = l.hingeSide === "left" ? x : x + lw;
            out.push(f(l.id, "door", box, DT, M.door, {
              hingeSide: l.hingeSide,
              connects: [l.hingeSide === "left" ? `${moduleId}-SL` : `${moduleId}-SR`],
              mechanism: { kind: "swing", pivot: { x: hx, y: 0, z: fz + DT }, axis: "y", sign: l.hingeSide === "left" ? -1 : 1, maxOpen: 105 },
            }));
          });
        } else if (sl.kind === "lift-up") {
          const box = { x: cx + G, y: yb + G / 2, z: fz, w: col.width - 2 * G, h: sl.height - G, d: 20 };
          out.push(f(sl.id, "lift-door", box, 20, M.glass, {
            connects: [`${moduleId}-SL`, `${moduleId}-SR`],
            mechanism: { kind: "lift-up", pivot: { x: 0, y: box.y + box.h, z: fz + 20 }, axis: "x", sign: -1, maxOpen: 85 },
          }));
        } else {
          const n = sl.ids.length;
          const fh = (sl.height - G * n) / n;
          const innerW = col.width - 2 * T;
          const boxW = innerW - 2 * 13; // 13 mm rail clearance each side (BBS side-mount)
          sl.ids.forEach((id, i) => {
            const y = top - G / 2 - (i + 1) * fh - i * G;
            out.push(f(id, "drawer-front", { x: cx + G, y, z: fz, w: col.width - 2 * G, h: fh, d: DT }, DT, M.door, {
              mechanism: { kind: "drawer", pivot: { x: 0, y: 0, z: fz }, axis: "z", sign: 1, maxOpen: bp.hardware.railLength },
            }));
            const bx = cx + T + 13, by = y + 20, bh = Math.min(fh - 60, 180), bd = bp.hardware.railLength;
            const bz = fz - bd;
            const DS = bp.construction.drawerSide;
            const part = (pid: string, role: Role, box: Box, th: number, mat = M.body) =>
              out.push({ id: pid, role, runId: r.id, moduleId, columnId: col.id, movesWith: id, box, thickness: th, material: mat, status: s, connects: [id] });
            part(`${id}-SL`, "drawer-side", { x: bx, y: by, z: bz, w: DS, h: bh, d: bd }, DS);
            part(`${id}-SR`, "drawer-side", { x: bx + boxW - DS, y: by, z: bz, w: DS, h: bh, d: bd }, DS);
            part(`${id}-BK`, "drawer-back", { x: bx + DS, y: by, z: bz, w: boxW - 2 * DS, h: bh, d: DS }, DS);
            part(`${id}-BT`, "drawer-bottom", { x: bx + DS, y: by, z: bz + DS, w: boxW - 2 * DS, h: bp.construction.drawerBottom, d: bd - DS }, bp.construction.drawerBottom, M.back);
          });
        }
        top = yb;
      }
      cx += col.width;
    }
    if (r.id === "LOWER") {
      // separate components — not cabinet modules
      out.push({ id: "PL-01", role: "plinth", runId: r.id, moduleId: null, columnId: null, movesWith: null,
        box: { x: 0, y: 0, z: D - bp.plinthSetback - T, w: r.width, h: bp.plinthHeight, d: T }, thickness: T, material: M.plinth, status: s, connects: r.modules.map((m) => `${m.id}-BT`) });
    }
    if (r.id === "UPPER") {
      out.push({ id: "FL-U-R", role: "filler", runId: r.id, moduleId: null, columnId: null, movesWith: null,
        box: { x: r.width, y: y0, z: 0, w: T, h: H, d: D + DT }, thickness: T, material: M.door, status: s, connects: [`${r.modules.at(-1)!.id}-SR`] });
    }
  }
  const ready = bp.overallStatus === "verified" && bp.runs.every((r) => st(r) === "verified");
  return { blueprint: bp, components: out, productionReady: ready, warnings };
}

// ---------------------------------------------------------------------------
// Mechanism poses + collision
// ---------------------------------------------------------------------------
export type Pose = Record<string, number>; // id → degrees (swing/lift) or mm (drawer)

/** Axis-aligned bounds of a component under a pose (rotated leaves → swept AABB of final pose). */
export function posedBox(c: KComponent, all: Map<string, KComponent>, pose: Pose): Box {
  const leadId = c.movesWith;
  const lead = leadId ? all.get(leadId) : undefined;
  const mech = lead?.mechanism;
  const v = leadId ? pose[leadId] ?? 0 : 0;
  if (!mech || v === 0) return c.box;
  const b = c.box;
  if (mech.kind === "drawer") return { ...b, z: b.z + Math.min(v, mech.maxOpen) };
  const a = (Math.min(v, mech.maxOpen) * Math.PI) / 180;
  if (mech.kind === "swing") {
    // rotate rectangle footprint (x,z) about pivot around Y
    const pts = [[b.x, b.z], [b.x + b.w, b.z], [b.x, b.z + b.d], [b.x + b.w, b.z + b.d]].map(([x, z]) => {
      const dx = x! - mech.pivot.x, dz = z! - mech.pivot.z;
      const ang = mech.sign * a; // sign chosen so the free edge moves to +z
      const s = Math.sin(ang), co = Math.cos(ang);
      return [mech.pivot.x + dx * co + dz * s, mech.pivot.z - dx * s + dz * co];
    });
    const xs = pts.map((p) => p[0]!), zs = pts.map((p) => p[1]!);
    return { x: Math.min(...xs), y: b.y, z: Math.min(...zs), w: Math.max(...xs) - Math.min(...xs), h: b.h, d: Math.max(...zs) - Math.min(...zs) };
  }
  // lift-up: rotate (y,z) about horizontal axis at pivot.y/pivot.z
  const pts = [[b.y, b.z], [b.y + b.h, b.z], [b.y, b.z + b.d], [b.y + b.h, b.z + b.d]].map(([y, z]) => {
    const dy = y! - mech.pivot.y, dz = z! - mech.pivot.z;
    const s = Math.sin(a), co = Math.cos(a);
    return [mech.pivot.y + dy * co + dz * s, mech.pivot.z - dy * s + dz * co];
  });
  const ys = pts.map((p) => p[0]!), zs = pts.map((p) => p[1]!);
  return { x: b.x, y: Math.min(...ys), z: Math.min(...zs), w: b.w, h: Math.max(...ys) - Math.min(...ys), d: Math.max(...zs) - Math.min(...zs) };
}

const EPS = 0.01;
export function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.h - EPS && b.y < a.y + a.h - EPS && a.z < b.z + b.d - EPS && b.z < a.z + a.d - EPS;
}

export interface Collision { a: string; b: string; pose: string }

/** Checks closed state, every mechanism fully open alone, and all opened together. */
export function detectCollisions(asm: KitchenAssembly): Collision[] {
  const all = new Map(asm.components.map((c) => [c.id, c]));
  const leads = asm.components.filter((c) => c.mechanism);
  const poses: [string, Pose][] = [["closed", {}]];
  for (const l of leads) poses.push([`open:${l.id}`, { [l.id]: l.mechanism!.maxOpen }]);
  // "all swing+drawer open" (lift-ups operated alone: they rise in front of the leaf above by design)
  poses.push(["all-open", Object.fromEntries(leads.filter((l) => l.mechanism!.kind !== "lift-up").map((l) => [l.id, l.mechanism!.maxOpen]))]);
  const res: Collision[] = [];
  for (const [name, pose] of poses) {
    const boxes = asm.components.map((c) => ({ c, b: posedBox(c, all, pose) }));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i]!, B = boxes[j]!;
        if (A.c.movesWith && A.c.movesWith === B.c.movesWith) continue; // same rigid group
        if (overlaps(A.b, B.b)) res.push({ a: A.c.id, b: B.c.id, pose: name });
      }
  }
  return res;
}

// ---------------------------------------------------------------------------
// Tallies, cutting list, BOM
// ---------------------------------------------------------------------------
export function hardwareTally(asm: KitchenAssembly) {
  const swings = asm.components.filter((c) => c.role === "door");
  const lifts = asm.components.filter((c) => c.role === "lift-door");
  const drawers = asm.components.filter((c) => c.role === "drawer-front");
  const hingePcs = swings.reduce((s, d) => s + hingesPerLeaf(d.box.h), 0);
  const hingeSets = Math.ceil(hingePcs / 2);
  const gasPcs = lifts.length * 2;
  return {
    swingLeaves: swings.length, liftUps: lifts.length, drawers: drawers.length,
    hingePcs, hingeSets, hingeLabel: `${hingeSets} set (${hingePcs} pcs)`,
    gasSpringPcs: gasPcs, railSets: drawers.length,
  };
}

export interface CutRow { id: string; role: Role; module: string; material: string; length: number; width: number; thickness: number; qty: number; status: DimensionStatus }

export function kitchenCuttingList(asm: KitchenAssembly): CutRow[] {
  return asm.components.map((c) => {
    const dims = [c.box.w, c.box.h, c.box.d].sort((a, b) => b - a);
    return { id: c.id, role: c.role, module: c.moduleId ?? "-", material: c.material, length: round(dims[0]!), width: round(dims[1]!), thickness: c.thickness, qty: 1, status: c.status };
  });
}
const round = (n: number) => Math.round(n * 10) / 10;

export const SHEET = { w: 1220, h: 2440 };
export function kitchenBom(asm: KitchenAssembly) {
  const rows = kitchenCuttingList(asm);
  const byMat = new Map<string, number>();
  for (const r of rows) byMat.set(r.material, (byMat.get(r.material) ?? 0) + (r.length * r.width) / 1e6);
  const sheetArea = (SHEET.w * SHEET.h) / 1e6;
  const panels = [...byMat].map(([material, area]) => {
    const isGlass = material.startsWith("Kaca");
    // whole units for sheets (+10% saw waste), glass bought per m²
    return { material, areaM2: round(area * 100) / 100, unit: isGlass ? "m²" : "lembar", qty: isGlass ? Math.ceil(area * 100) / 100 : Math.ceil((area * 1.1) / sheetArea) };
  });
  const hw = hardwareTally(asm);
  const bp = asm.blueprint;
  const hardware = [
    { item: `Engsel ${bp.hardware.hingeRef}`, qty: hw.hingeLabel, note: "provisional — cek berat/ukuran daun vs rekomendasi produsen" },
    { item: bp.hardware.gasSpringRef, qty: `${hw.gasSpringPcs} pcs`, note: "provisional — cek gaya (N) vs berat pintu kaca" },
    { item: `Rel laci ${bp.hardware.railRef} ${bp.hardware.railLength} mm`, qty: `${hw.railSets} set`, note: "" },
  ];
  return { panels, hardware, productionReady: asm.productionReady };
}
