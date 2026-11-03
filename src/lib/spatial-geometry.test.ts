import { describe, expect, it } from "vitest";
import type { FrontLayout } from "./interior-spec";
import { fromFrontLayout, spatialHash, spatialBlueprintSchema, type SpatialBlueprint } from "./spatial-blueprint";
import { buildSpatialGeometry, type GeometryInput } from "./spatial-geometry";

// Test fixture: workshop-style measurements (mm). Real projects supply their own verified numbers.
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
const W = [500, 450, 450, 450, 800];
const LW = [500, 600, 600, 600];

function frames(bp: SpatialBlueprint): GeometryInput {
  const up = bp.runs.find((r) => r.level === "upper")!;
  const lo = bp.runs.find((r) => r.level === "lower")!;
  let x = 0;
  const upCells = up.columns.flatMap((c, i) => {
    const x0 = x;
    x += W[i]!;
    return c.cells.map((cell) => ({
      cellId: cell.cellId,
      rect: { x: x0, y: cell.tierIndex === 1 ? 0 : 500, w: W[i]!, h: cell.tierIndex === 1 ? 500 : 300 },
      ...(cell.front.kind === "leaves" && cell.front.leaves.length === 2 ? { pairSplitMm: x0 + W[i]! / 2 } : {}),
      gapMm: 2,
    }));
  });
  let lx = 0;
  const loCells = lo.columns.flatMap((c, i) => {
    const x0 = lx;
    lx += LW[i]!;
    return c.cells.map((cell) => ({ cellId: cell.cellId, rect: { x: x0, y: 0, w: LW[i]!, h: 720 }, gapMm: 2 }));
  });
  const cam = { kind: "orthographic_front" as const };
  return {
    blueprintHash: spatialHash(bp),
    frames: [
      { ownerId: up.runId, widthMm: 2650, heightMm: 800, source: "measured", verifiedBy: "workshop", camera: cam, cells: upCells },
      { ownerId: lo.runId, widthMm: 2300, heightMm: 720, source: "measured", verifiedBy: "workshop", camera: cam, cells: loCells },
    ],
  };
}
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const errs = (bp: SpatialBlueprint, g: GeometryInput) => {
  const r = buildSpatialGeometry(bp, g);
  return r.valid ? [] : r.errors;
};

describe("geometry engine", () => {
  const bp = fromFrontLayout(adji);

  it("G1. Adji: setiap daun & laci punya tepat satu geometri di sel induknya", () => {
    const r = buildSpatialGeometry(bp, frames(bp));
    expect(r.valid).toBe(true);
    if (!r.valid) return;
    const g = r.geometry;
    expect(g.leaves.filter((l) => l.kind === "swing")).toHaveLength(12);
    expect(g.leaves.filter((l) => l.kind === "lift_up")).toHaveLength(2);
    expect(g.drawers).toHaveLength(3);
    expect(new Set(g.leaves.map((l) => l.leafId)).size).toBe(14);
    for (const l of g.leaves) {
      const c = g.cells.find((x) => x.cellId === l.parentCellId)!;
      expect(l.closedBounds.x).toBeGreaterThanOrEqual(c.bounds.x);
      expect(l.closedBounds.x + l.closedBounds.width).toBeLessThanOrEqual(c.bounds.x + c.bounds.width + 1e-9);
    }
  });

  it("G2. Sisi engsel belum diverifikasi → tidak ada polygon karangan, hanya catatan pending", () => {
    const r = buildSpatialGeometry(bp, frames(bp));
    if (!r.valid) throw new Error(r.errors.join());
    const single = r.geometry.leaves.find((l) => l.kind === "swing" && !l.hingeEdge)!;
    expect(single.openPolygon).toBeNull();
    expect(single.hingeAnchor).toBeNull();
    expect(r.geometry.pending.length).toBe(10); // 10 single swings unknown; the pair is verified
  });

  it("G3. Pasangan: dua daun terpisah di garis temu terukur, engsel kiri di kiri, tanpa tumpang tindih", () => {
    const r = buildSpatialGeometry(bp, frames(bp));
    if (!r.valid) throw new Error(r.errors.join());
    const [a, b] = r.geometry.leaves.filter((l) => l.parentCellId === "U-C5-T1");
    expect(a!.hingeEdge).toBe("left");
    expect(b!.hingeEdge).toBe("right");
    expect(a!.closedRectMm.x + a!.closedRectMm.w).toBeLessThanOrEqual(b!.closedRectMm.x);
  });

  it("G4. Pasangan tanpa garis temu terukur ditolak (tidak dibagi rata otomatis)", () => {
    const g = clone(frames(bp));
    g.frames[0]!.cells.forEach((c) => delete (c as { pairSplitMm?: number }).pairSplitMm);
    expect(errs(bp, g).join()).toContain("pairSplitMm");
  });

  it("G5. Polygon containment: sel keluar dari batas run ditolak", () => {
    const g = clone(frames(bp));
    g.frames[1]!.cells[0]!.rect.w = 5000;
    expect(errs(bp, g).join()).toMatch(/keluar dari batas/);
  });

  it("G6. Sel bertumpuk dengan sel lain ditolak", () => {
    const g = clone(frames(bp));
    g.frames[1]!.cells[1]!.rect.x = 300;
    expect(errs(bp, g).join()).toMatch(/bertumpuk/);
  });

  it("G7. Sel tanpa koordinat terverifikasi ditolak; frame tanpa run ditolak", () => {
    const g = clone(frames(bp));
    g.frames[1]!.cells.pop();
    expect(errs(bp, g).join()).toMatch(/belum punya koordinat/);
    const g2 = clone(frames(bp));
    g2.frames.pop();
    expect(errs(bp, g2).join()).toMatch(/belum diverifikasi/);
  });

  it("G8. Geometri untuk blueprint lain (hash beda) ditolak", () => {
    const g = { ...frames(bp), blueprintHash: "deadbeef" };
    expect(errs(bp, g).join()).toMatch(/hash tidak cocok/);
  });

  it("G9. Ortografis vs perspektif: cos hanya untuk tampak elevasi, pinhole memakai kalibrasi", () => {
    const one: SpatialBlueprint = spatialBlueprintSchema.parse({
      version: 2, shape: "straight", corners: [], render: { openAngleDeg: 60 },
      runs: [{ runId: "R", position: "main", level: "lower", columns: [{ columnId: "C1", columnIndex: 1, cells: [
        { cellId: "R-C1", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [{ leafId: "D1", panel: "solid", mechanism: { kind: "swing", hingeSide: "left" } }] } },
      ] }] }],
    });
    const mk = (camera: GeometryInput["frames"][number]["camera"]): GeometryInput => ({
      blueprintHash: spatialHash(one),
      frames: [{ ownerId: "R", widthMm: 600, heightMm: 720, source: "measured", verifiedBy: "w", camera, cells: [{ cellId: "R-C1", rect: { x: 0, y: 0, w: 600, h: 720 } }] }],
    });
    const o = buildSpatialGeometry(one, mk({ kind: "orthographic_front" }));
    if (!o.valid) throw new Error(o.errors.join());
    expect(o.geometry.leaves[0]!.openPolygon![1].x).toBeCloseTo(0.5, 6); // 600·cos60 / 600
    // Camera 2000 mm in front, focal 1000 px, principal point (300,360).
    const P = [[1000, 0, -300, 300 * 2000], [0, 1000, -360, 360 * 2000], [0, 0, -1, 2000]];
    const p = buildSpatialGeometry(one, mk({ kind: "pinhole", matrix: P, imageWidth: 1000, imageHeight: 1000 }));
    if (!p.valid) throw new Error(p.errors.join());
    const free = p.geometry.leaves[0]!.openPolygon![1];
    // x=300, z=519.6: u = (1000·300 − 300·519.6 + 600000)/(2000 − 519.6)
    expect(free.x).toBeCloseTo((300000 - 300 * 519.615 + 600000) / (2000 - 519.615) / 1000, 4);
    expect(free.x).not.toBeCloseTo(0.5 * 0.6, 2);
  });

  it("G10. Open door projection: dua daun yang saling menabrak saat dibuka terdeteksi", () => {
    const two: SpatialBlueprint = spatialBlueprintSchema.parse({
      version: 2, shape: "straight", corners: [], render: { openAngleDeg: 110 },
      runs: [{ runId: "R", position: "main", level: "lower", columns: [
        { columnId: "C1", columnIndex: 1, cells: [{ cellId: "A", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [{ leafId: "D1", panel: "solid", mechanism: { kind: "swing", hingeSide: "right" } }] } }] },
        { columnId: "C2", columnIndex: 2, cells: [{ cellId: "B", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [{ leafId: "D2", panel: "solid", mechanism: { kind: "swing", hingeSide: "left" } }] } }] },
      ] }],
    });
    const g: GeometryInput = {
      blueprintHash: spatialHash(two),
      frames: [{ ownerId: "R", widthMm: 1206, heightMm: 720, source: "measured", verifiedBy: "w", camera: { kind: "orthographic_front" }, cells: [
        { cellId: "A", rect: { x: 0, y: 0, w: 600, h: 720 } },
        { cellId: "B", rect: { x: 606, y: 0, w: 600, h: 720 } },
      ] }],
    };
    expect(errs(two, g).join()).toMatch(/bertabrakan/);
    expect(errs({ ...two, render: { openAngleDeg: 60 } }, { ...g, blueprintHash: spatialHash({ ...two, render: { openAngleDeg: 60 } }) })).toEqual([]);
  });

  it("G11. Kitchen L: tiap run & corner pakai frame lokal sendiri", () => {
    const L: SpatialBlueprint = spatialBlueprintSchema.parse({
      version: 2, shape: "L", render: { openAngleDeg: 60 },
      runs: [
        { runId: "M", position: "main", level: "lower", columns: [{ columnId: "M1", columnIndex: 1, cells: [{ cellId: "M1-T1", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [{ leafId: "D1", panel: "solid", mechanism: { kind: "swing", hingeSide: "left" } }] } }] }] },
        { runId: "W", position: "left_wing", level: "lower", columns: [{ columnId: "W1", columnIndex: 1, cells: [{ cellId: "W1-T1", tierIndex: 1, compartment: {}, front: { kind: "drawers", drawers: [{ drawerId: "DR1" }] } }] }] },
      ],
      corners: [{ cornerId: "K", type: "blind", level: "lower", joins: ["M", "W"], cells: [{ cellId: "K-T1", tierIndex: 1, compartment: {}, front: { kind: "open_niche" } }] }],
    });
    const f = (ownerId: string, cellId: string) => ({ ownerId, widthMm: 600, heightMm: 720, source: "photo_annotation" as const, verifiedBy: "desainer", camera: { kind: "orthographic_front" as const }, cells: [{ cellId, rect: { x: 0, y: 0, w: 600, h: 720 } }] });
    const r = buildSpatialGeometry(L, { blueprintHash: spatialHash(L), frames: [f("M", "M1-T1"), f("W", "W1-T1"), f("K", "K-T1")] });
    expect(r.valid).toBe(true);
    // Same local coordinates in different runs are not a collision.
    if (r.valid) expect(r.geometry.cells.map((c) => c.ownerId)).toEqual(["M", "W", "K"]);
  });
});
