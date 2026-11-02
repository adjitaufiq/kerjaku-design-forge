import { z } from "zod";
import type { FrontLayout } from "./interior-spec";

/**
 * Universal Spatial Blueprint (v2): one object = one physical part.
 * Structure is decided by the app; the image model only renders it.
 * Hardware totals are always derived via calculateSpatialTally(), never stored.
 */

const id = z.string().trim().min(1).max(40);

export const swingMechanismSchema = z.object({
  kind: z.literal("swing"),
  hingeSide: z.enum(["left", "right", "unknown"]),
}).strict();
export const liftMechanismSchema = z.object({
  kind: z.literal("lift_up"),
  hingeAxis: z.enum(["top", "unknown"]),
}).strict();
export const openingMechanismSchema = z.discriminatedUnion("kind", [swingMechanismSchema, liftMechanismSchema]);
export type OpeningMechanism = z.infer<typeof openingMechanismSchema>;

export const leafSchema = z.object({
  leafId: id,
  panel: z.enum(["solid", "glass"]),
  mechanism: openingMechanismSchema,
  pairId: id.optional(),
  /** Optional per-leaf override; otherwise blueprint render default. */
  openAngleDeg: z.number().min(10).max(110).optional(),
}).strict();
export type Leaf = z.infer<typeof leafSchema>;

export const drawerSchema = z.object({ drawerId: id }).strict();

export const compartmentSchema = z.object({
  /** undefined = not verified; the compiler then never states a number. */
  shelves: z.number().int().min(0).max(10).optional(),
  led: z.boolean().optional(),
  notes: z.string().trim().max(200).optional(),
}).strict();

export const frontSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("leaves"), leaves: z.array(leafSchema).min(1).max(2) }).strict(),
  z.object({ kind: z.literal("drawers"), drawers: z.array(drawerSchema).min(1).max(8) }).strict(),
  z.object({ kind: z.literal("open_niche") }).strict(),
]);

export const cellSchema = z.object({
  cellId: id,
  tierIndex: z.number().int().min(1).max(8),
  front: frontSchema,
  compartment: compartmentSchema,
}).strict();
export type Cell = z.infer<typeof cellSchema>;

export const columnSchemaV2 = z.object({
  columnId: id,
  columnIndex: z.number().int().min(1).max(32),
  cells: z.array(cellSchema).min(1).max(8),
}).strict();

export const LEVELS = ["upper", "lower", "tall"] as const;
export const runSchema = z.object({
  runId: id,
  position: z.enum(["main", "left_wing", "right_wing"]),
  level: z.enum(LEVELS),
  columns: z.array(columnSchemaV2).min(1).max(32),
}).strict();
export type Run = z.infer<typeof runSchema>;

/** Corner joins exactly two runs of the same level; may hold several cells/leaves. */
export const cornerSchema = z.object({
  cornerId: id,
  type: z.enum(["blind", "diagonal", "l_corner"]),
  level: z.enum(LEVELS),
  joins: z.tuple([id, id]),
  cells: z.array(cellSchema).min(1).max(8),
}).strict();
export type Corner = z.infer<typeof cornerSchema>;

export const spatialBlueprintSchema = z.object({
  version: z.literal(2),
  shape: z.enum(["straight", "L", "U", "wardrobe"]),
  runs: z.array(runSchema).min(1).max(12),
  corners: z.array(cornerSchema).max(8).default([]),
  render: z.object({ openAngleDeg: z.number().min(10).max(110) }).strict().default({ openAngleDeg: 60 }),
}).strict().superRefine((bp, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  const seen = new Set<string>();
  const unique = (kind: string, v: string) => {
    if (seen.has(v)) issue(`ID ganda (${kind}): ${v}`);
    seen.add(v);
  };
  const pairs = new Map<string, { cellId: string; leaves: Leaf[] }>();
  const checkCells = (cells: Cell[], owner: string) => {
    const tiers = new Set<number>();
    for (const c of cells) {
      unique("cell", c.cellId);
      if (tiers.has(c.tierIndex)) issue(`Tier ganda di ${owner}: ${c.tierIndex}`);
      tiers.add(c.tierIndex);
      if (c.front.kind === "drawers") c.front.drawers.forEach((d) => unique("drawer", d.drawerId));
      if (c.front.kind !== "leaves") continue;
      const leaves = c.front.leaves;
      if (leaves.length === 2 && (!leaves[0]?.pairId || leaves[0]?.pairId !== leaves[1]?.pairId))
        issue(`Dua daun di ${c.cellId} wajib satu pairId`);
      for (const l of leaves) {
        unique("leaf", l.leafId);
        if (!l.pairId) continue;
        const p = pairs.get(l.pairId) ?? { cellId: c.cellId, leaves: [] };
        if (p.cellId !== c.cellId) issue(`Pasangan ${l.pairId} beda kompartemen`);
        p.leaves.push(l);
        pairs.set(l.pairId, p);
      }
    }
  };
  for (const r of bp.runs) {
    unique("run", r.runId);
    const idx = new Set<number>();
    for (const col of r.columns) {
      unique("column", col.columnId);
      if (idx.has(col.columnIndex)) issue(`Urutan kolom ganda di ${r.runId}: ${col.columnIndex}`);
      idx.add(col.columnIndex);
      checkCells(col.cells, col.columnId);
    }
  }
  for (const k of bp.corners) {
    unique("corner", k.cornerId);
    checkCells(k.cells, k.cornerId);
    const [a, b] = k.joins.map((j) => bp.runs.find((r) => r.runId === j));
    if (!a || !b || a === b) issue(`Corner ${k.cornerId} harus menghubungkan dua run yang ada`);
    else if (a.level !== k.level || b.level !== k.level) issue(`Corner ${k.cornerId} beda level dengan run`);
    else if (![a.position, b.position].includes("main") || a.position === b.position)
      issue(`Corner ${k.cornerId} harus menghubungkan run utama dengan sayap`);
  }
  for (const [pid, p] of pairs) {
    if (p.leaves.length !== 2) { issue(`Pasangan ${pid} harus tepat 2 daun`); continue; }
    const sides = p.leaves.map((l) => (l.mechanism.kind === "swing" ? l.mechanism.hingeSide : "x")).sort().join();
    if (sides !== "left,right") issue(`Pasangan ${pid} wajib swing engsel kiri + kanan`);
  }
  // Every wing needs a corner to the main run at the same level.
  for (const w of bp.runs.filter((r) => r.position !== "main"))
    if (!bp.corners.some((k) => k.joins.includes(w.runId))) issue(`Sayap ${w.runId} belum punya corner`);
  const wings = (p: string) => bp.runs.some((r) => r.position === p);
  if (bp.shape === "L" && !(wings("left_wing") || wings("right_wing"))) issue("Bentuk L wajib punya 1 sayap");
  if (bp.shape === "U" && !(wings("left_wing") && wings("right_wing"))) issue("Bentuk U wajib punya 2 sayap");
  if ((bp.shape === "straight" || bp.shape === "wardrobe") && bp.runs.some((r) => r.position !== "main"))
    issue("Bentuk lurus/lemari tidak boleh punya sayap");
});
export type SpatialBlueprint = z.infer<typeof spatialBlueprintSchema>;

export function validateSpatialBlueprint(input: unknown):
  | { valid: true; blueprint: SpatialBlueprint }
  | { valid: false; errors: string[] } {
  const r = spatialBlueprintSchema.safeParse(input);
  return r.success ? { valid: true, blueprint: r.data } : { valid: false, errors: r.error.issues.map((i) => i.message) };
}

const allCells = (bp: SpatialBlueprint) => [
  ...bp.runs.flatMap((r) => r.columns.flatMap((c) => c.cells)),
  ...bp.corners.flatMap((k) => k.cells),
];

/** Hardware derived only from physical objects. Hinge 1 set = 2 pcs per swing leaf; slide 1 set per drawer; gas spring 2 pcs per lift leaf. */
export function calculateSpatialTally(bp: SpatialBlueprint) {
  const leaves = allCells(bp).flatMap((c) => (c.front.kind === "leaves" ? c.front.leaves : []));
  const swingLeaves = leaves.filter((l) => l.mechanism.kind === "swing").length;
  const liftLeaves = leaves.length - swingLeaves;
  const drawers = allCells(bp).reduce((n, c) => n + (c.front.kind === "drawers" ? c.front.drawers.length : 0), 0);
  return {
    swingLeaves, liftLeaves, drawers,
    hingeSets: swingLeaves, hingePcs: swingLeaves * 2,
    slideSets: drawers, gasSpringPcs: liftLeaves * 2,
    unknownHinges: leaves.filter((l) => l.mechanism.kind === "swing" && l.mechanism.hingeSide === "unknown").map((l) => l.leafId),
  };
}

/** v1 FrontLayout → v2 straight blueprint. Never guesses hinge side for single leaves or shelf counts. */
export function fromFrontLayout(layout: FrontLayout): SpatialBlueprint {
  let d = 0, l = 0, dr = 0, p = 0;
  const pad = (n: number) => String(n).padStart(2, "0");
  const swing = (side: "left" | "right" | "unknown", panel: "solid" | "glass" = "solid", pairId?: string): Leaf => ({
    leafId: `D${pad(++d)}`, panel, mechanism: { kind: "swing", hingeSide: side }, ...(pairId ? { pairId } : {}),
  });
  const run = (key: "U" | "L", level: "upper" | "lower", cols: FrontLayout["upper"]): Run => ({
    runId: `RUN-MAIN-${level.toUpperCase()}`, position: "main", level,
    columns: cols.map((col, ci) => {
      const cells: Cell[] = [];
      let tier = 0;
      const cellId = () => `${key}-C${ci + 1}-T${tier}`;
      for (let i = 0; i < col.fronts.length; i++) {
        const f = col.fronts[i];
        tier++;
        if (f === "drawer") {
          // Consecutive drawers form one drawer stack cell.
          const drawers = [];
          while (col.fronts[i] === "drawer") { drawers.push({ drawerId: `DR${pad(++dr)}` }); i++; }
          i--;
          cells.push({ cellId: cellId(), tierIndex: tier, front: { kind: "drawers", drawers }, compartment: {} });
          continue;
        }
        const front: Cell["front"] =
          f === "open" ? { kind: "open_niche" }
          : f === "double" ? (() => { const pid = `PAIR-${pad(++p)}`; return { kind: "leaves" as const, leaves: [swing("left", "solid", pid), swing("right", "solid", pid)] }; })()
          : f === "lift_glass" || f === "lift_wood"
            ? { kind: "leaves", leaves: [{ leafId: `L${pad(++l)}`, panel: f === "lift_glass" ? "glass" : "solid", mechanism: { kind: "lift_up", hingeAxis: "top" } }] }
            : { kind: "leaves", leaves: [swing("unknown", f === "glass_swing" ? "glass" : "solid")] };
        cells.push({ cellId: cellId(), tierIndex: tier, front, compartment: {} });
      }
      return { columnId: `${key}-COL-${pad(ci + 1)}`, columnIndex: ci + 1, cells };
    }),
  });
  const runs = [
    ...(layout.upper.length ? [run("U", "upper", layout.upper)] : []),
    ...(layout.lower.length ? [run("L", "lower", layout.lower)] : []),
  ];
  return spatialBlueprintSchema.parse({ version: 2, shape: "straight", runs, corners: [] });
}

const LEVEL_EN = { upper: "UPPER", lower: "BASE", tall: "TALL" } as const;
const POS_EN = { main: "MAIN RUN", left_wing: "LEFT WING", right_wing: "RIGHT WING" } as const;

function cellText(c: Cell, angle: number): string {
  const comp = [
    c.compartment.shelves !== undefined ? `${c.compartment.shelves} shelves` : "",
    c.compartment.led ? "LED lighting" : "",
    c.compartment.notes ?? "",
  ].filter(Boolean).join(", ");
  const behind = comp ? ` Interior behind it: ${comp}; this interior sits BEHIND the open leaf and never replaces it.` : " Its interior sits BEHIND the open leaf and never replaces it.";
  if (c.front.kind === "open_niche") return `Tier ${c.tierIndex} [${c.cellId}]: open niche with NO door (by design).${comp ? ` Contents: ${comp}.` : ""}`;
  if (c.front.kind === "drawers")
    return `Tier ${c.tierIndex} [${c.cellId}]: stack of exactly ${c.front.drawers.length} drawers (${c.front.drawers.map((d) => d.drawerId).join(", ")}) top to bottom, all pulled out.`;
  const leaves = c.front.leaves.map((l) => {
    const a = l.openAngleDeg ?? angle;
    const glass = l.panel === "glass" ? "glass " : "";
    if (l.mechanism.kind === "lift_up") return `leaf ${l.leafId}: ONE ${glass}lift-up flap, hinged on its ${l.mechanism.hingeAxis === "top" ? "top" : "upper"} edge, raised upward on gas springs`;
    const side = l.mechanism.hingeSide === "unknown" ? "hinged on one vertical edge of its own opening (side not verified)" : `hinged on its ${l.mechanism.hingeSide} edge`;
    return `leaf ${l.leafId}: ONE ${glass}swing door ${side}, physically present and swung open about ${a} degrees`;
  });
  const pair = c.front.leaves.length === 2 ? " These two leaves are a pair meeting at the centre gap of this one opening." : "";
  return `Tier ${c.tierIndex} [${c.cellId}]: ${leaves.join("; ")}.${pair} Never split, merge or remove this leaf.${behind}`;
}

/** Deterministic, blueprint-driven spatial instructions for the interior image prompt. */
export function compileSpatialPrompt(bp: SpatialBlueprint): string {
  const t = calculateSpatialTally(bp);
  const a = bp.render.openAngleDeg;
  const runs = bp.runs.map((r) => {
    const cols = [...r.columns].sort((x, y) => x.columnIndex - y.columnIndex);
    return [
      `[${LEVEL_EN[r.level]} ${POS_EN[r.position]} ${r.runId} — EXACTLY ${cols.length} columns, left to right]`,
      ...cols.map((c) => `Column ${c.columnIndex} ${c.columnId} (${c.cells.length} tier${c.cells.length > 1 ? "s" : ""}, top to bottom): ${[...c.cells].sort((x, y) => x.tierIndex - y.tierIndex).map((x) => cellText(x, a)).join(" ")}`),
    ].join("\n");
  });
  const corners = bp.corners.map((k) =>
    `[CORNER ${k.cornerId} — ${k.type} ${LEVEL_EN[k.level]}, joining ${k.joins[0]} and ${k.joins[1]}] ${k.cells.map((x) => cellText(x, a)).join(" ")}`);
  return [
    "SPATIAL STRUCTURE CONTRACT (verified workshop blueprint; every listed leaf is one physical part):",
    ...runs, ...corners,
    `TOTAL: exactly ${t.swingLeaves} swing leaves, ${t.liftLeaves} lift-up flaps and ${t.drawers} drawers. Shelves, LED and stored items are inside compartments and never replace a door leaf.`,
  ].join("\n");
}
