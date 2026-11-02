import { describe, expect, it } from "vitest";
import type { FrontLayout } from "./interior-spec";
import { buildExteriorPrompt } from "./interior-spec";
import {
  calculateSpatialTally, compileSpatialPrompt, fromFrontLayout, validateSpatialBlueprint, type Cell,
} from "./spatial-blueprint";

const adji: FrontLayout = {
  upper: [
    { fronts: ["swing", "lift_glass"] },
    { fronts: ["swing", "swing"] },
    { fronts: ["swing", "swing"] },
    { fronts: ["swing", "swing"] },
    { fronts: ["double", "lift_glass"] },
  ],
  lower: [{ fronts: ["swing"] }, { fronts: ["drawer", "drawer", "drawer"] }, { fronts: ["swing"] }, { fronts: ["swing"] }],
};

const swingCell = (cellId: string, leafId: string, tierIndex = 1, side: "left" | "right" | "unknown" = "unknown"): Cell => ({
  cellId, tierIndex, compartment: {},
  front: { kind: "leaves", leaves: [{ leafId, panel: "solid", mechanism: { kind: "swing", hingeSide: side } }] },
});
const col = (columnId: string, columnIndex: number, cells: Cell[]) => ({ columnId, columnIndex, cells });
const run = (runId: string, position: "main" | "left_wing" | "right_wing", n: number, level: "upper" | "lower" | "tall" = "lower") => ({
  runId, position, level, columns: Array.from({ length: n }, (_, i) => col(`${runId}-C${i + 1}`, i + 1, [swingCell(`${runId}-C${i + 1}-T1`, `${runId}-D${i + 1}`)])),
});
const corner = (cornerId: string, joins: [string, string]) => ({
  cornerId, type: "blind" as const, level: "lower" as const, joins,
  cells: [swingCell(`${cornerId}-T1`, `${cornerId}-D1`)],
});
const base = () => JSON.parse(JSON.stringify(fromFrontLayout(adji)));
const errs = (x: unknown) => { const r = validateSpatialBlueprint(x); return r.valid ? [] : r.errors; };

describe("spatial blueprint — positive", () => {
  it("1. Adji lurus: 12 swing, 2 lift-up, 3 laci → engsel 12 set (24 pcs), rel 3 set, hidrolik 4 pcs", () => {
    const t = calculateSpatialTally(fromFrontLayout(adji));
    expect([t.swingLeaves, t.liftLeaves, t.drawers]).toEqual([12, 2, 3]);
    expect([t.hingeSets, t.hingePcs, t.slideSets, t.gasSpringPcs]).toEqual([12, 24, 3, 4]);
  });
  it("2. double → 2 daun independen dengan pairId sama, kiri + kanan", () => {
    const c = fromFrontLayout(adji).runs[0].columns[4].cells[0];
    expect(c.front.kind).toBe("leaves");
    if (c.front.kind !== "leaves") return;
    expect(c.front.leaves).toHaveLength(2);
    expect(c.front.leaves[0].pairId).toBe(c.front.leaves[1].pairId);
    expect(c.front.leaves.map((l) => l.mechanism.kind === "swing" && l.mechanism.hingeSide)).toEqual(["left", "right"]);
  });
  it("3. pintu tunggal: engsel tidak ditebak (unknown)", () => {
    const t = calculateSpatialTally(fromFrontLayout(adji));
    expect(t.unknownHinges).toHaveLength(10);
  });
  it("4. LED/ambalan di kompartemen tidak menghapus daun pintu", () => {
    const bp = base();
    bp.runs[0].columns[1].cells[1].compartment = { shelves: 2, led: true };
    const r = validateSpatialBlueprint(bp);
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    expect(r.blueprint.runs[0].columns[1].cells[1].front.kind).toBe("leaves");
    expect(compileSpatialPrompt(r.blueprint)).toMatch(/BEHIND the open leaf and never replaces it/);
  });
  it("5. kitchen L: main + wing + corner", () => {
    const bp = { version: 2, shape: "L", runs: [run("MAIN", "main", 3), run("WL", "left_wing", 2)], corners: [corner("K1", ["MAIN", "WL"])] };
    expect(errs(bp)).toEqual([]);
  });
  it("6. kitchen U: main + 2 wing + 2 corner", () => {
    const bp = {
      version: 2, shape: "U",
      runs: [run("MAIN", "main", 3), run("WL", "left_wing", 2), run("WR", "right_wing", 2)],
      corners: [corner("K1", ["MAIN", "WL"]), corner("K2", ["MAIN", "WR"])],
    };
    expect(errs(bp)).toEqual([]);
  });
  it("7. wardrobe 4 kolom × 2 tier: 8 swing, tanpa laci", () => {
    const r = validateSpatialBlueprint({
      version: 2, shape: "wardrobe",
      runs: [{ runId: "W", position: "main", level: "tall", columns: [1, 2, 3, 4].map((i) => col(`W-C${i}`, i, [swingCell(`W-C${i}-T1`, `W-D${i}a`, 1), swingCell(`W-C${i}-T2`, `W-D${i}b`, 2)])) }],
    });
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    const t = calculateSpatialTally(r.blueprint);
    expect([t.swingLeaves, t.drawers, t.liftLeaves]).toEqual([8, 0, 0]);
  });
  it("8. prompt deterministik memuat setiap ID daun", () => {
    const bp = fromFrontLayout(adji);
    const p = compileSpatialPrompt(bp);
    expect(p).toBe(compileSpatialPrompt(fromFrontLayout(adji)));
    for (let i = 1; i <= 12; i++) expect(p).toContain(`D${String(i).padStart(2, "0")}`);
    expect(p).toContain("L02");
    expect(p).toContain("exactly 12 swing leaves, 2 lift-up flaps and 3 drawers");
  });
  it("sudut bukaan bisa diatur, bukan dikunci 60", () => {
    const bp = base(); bp.render = { openAngleDeg: 90 };
    const r = validateSpatialBlueprint(bp);
    expect(r.valid && compileSpatialPrompt(r.blueprint)).toContain("about 90 degrees");
  });
});

describe("spatial blueprint — negative", () => {
  it("leaf ID ganda ditolak", () => {
    const bp = base();
    bp.runs[1].columns[0].cells[0].front.leaves[0].leafId = "D01";
    expect(errs(bp).join()).toMatch(/ID ganda \(leaf\)/);
  });
  it("drawer ID ganda ditolak", () => {
    const bp = base();
    bp.runs[1].columns[1].cells[0].front.drawers[1].drawerId = "DR01";
    expect(errs(bp).join()).toMatch(/ID ganda \(drawer\)/);
  });
  it("cell ID ganda ditolak", () => {
    const bp = base();
    bp.runs[0].columns[1].cells[0].cellId = "U-C1-T1";
    expect(errs(bp).join()).toMatch(/ID ganda \(cell\)/);
  });
  it("tier ganda dalam satu kolom ditolak", () => {
    const bp = base();
    bp.runs[0].columns[1].cells[1].tierIndex = 1;
    expect(errs(bp).join()).toMatch(/Tier ganda/);
  });
  it("pairId hanya satu daun ditolak", () => {
    const bp = base();
    bp.runs[0].columns[0].cells[0].front.leaves[0].pairId = "SOLO";
    expect(errs(bp).join()).toMatch(/SOLO harus tepat 2 daun/);
  });
  it("pairId tiga daun ditolak", () => {
    const bp = base();
    bp.runs[0].columns[4].cells[0].front.leaves.push({ leafId: "DX", panel: "solid", mechanism: { kind: "swing", hingeSide: "left" }, pairId: "PAIR-01" });
    expect(errs(bp).length).toBeGreaterThan(0);
    const leaf = bp.runs[0].columns[4].cells[0].front.leaves.pop();
    bp.runs[0].columns[3].cells[0].front.leaves[0].pairId = "PAIR-01";
    expect(leaf).toBeTruthy();
    expect(errs(bp).join()).toMatch(/PAIR-01/);
  });
  it("pasangan dengan arah engsel sama ditolak", () => {
    const bp = base();
    bp.runs[0].columns[4].cells[0].front.leaves[1].mechanism.hingeSide = "left";
    expect(errs(bp).join()).toMatch(/kiri \+ kanan/);
  });
  it("tally tidak bisa disuntik dari luar", () => {
    const bp = base(); bp.totalTally = { swingLeaves: 10 };
    expect(validateSpatialBlueprint(bp).valid).toBe(false);
  });
  it("lift-up dengan hingeSide ditolak", () => {
    const bp = base();
    bp.runs[0].columns[0].cells[1].front.leaves[0].mechanism = { kind: "lift_up", hingeSide: "left" };
    expect(validateSpatialBlueprint(bp).valid).toBe(false);
  });
  it("run kosong ditolak", () => {
    expect(validateSpatialBlueprint({ version: 2, shape: "straight", runs: [{ runId: "R", position: "main", level: "lower", columns: [] }] }).valid).toBe(false);
    expect(validateSpatialBlueprint({ version: 2, shape: "straight", runs: [] }).valid).toBe(false);
  });
  it("corner tanpa run valid ditolak", () => {
    const bp = { version: 2, shape: "L", runs: [run("MAIN", "main", 3), run("WL", "left_wing", 2)], corners: [corner("K1", ["MAIN", "NOPE"])] };
    expect(errs(bp).join()).toMatch(/dua run yang ada/);
  });
  it("sayap tanpa corner & U dengan 1 sayap ditolak", () => {
    expect(errs({ version: 2, shape: "U", runs: [run("MAIN", "main", 3), run("WL", "left_wing", 2)], corners: [] }).join())
      .toMatch(/belum punya corner.*2 sayap|2 sayap.*belum punya corner/);
  });
  it("exterior tetap berfungsi tanpa blueprint", () => {
    const p = buildExteriorPrompt({ outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "dt_biasa", accessories: [] });
    expect(p).toContain("FINAL EXTERIOR");
  });
});
