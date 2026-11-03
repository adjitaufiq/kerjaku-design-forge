import { describe, expect, it } from "vitest";
import { spatialBlueprintSchema, spatialHash } from "./spatial-blueprint";
import { buildSpatialGeometry, type GeometryInput } from "./spatial-geometry";
import { analyzeEditBoundary, compositeProtectedPixels, auditCompositingQuality } from "./spatial-compositor";
import {
  applyInnerFeather, buildEnvelopeZoneMap, buildSwingEnvelope, buildZoneMap, innerFeatherWeights,
  isEditable, pointInPolygon, ZONE,
} from "./spatial-mask";

// Synthetic fixture (not a real project): 3 cells, 1500 × 720 mm, 0.4 px/mm.
const leaf = (id: string, hingeSide: "left" | "right" | "unknown") => ({ leafId: id, panel: "solid", mechanism: { kind: "swing", hingeSide } });
const bp = spatialBlueprintSchema.parse({
  version: 2, shape: "straight", corners: [], render: { openAngleDeg: 70 },
  runs: [{ runId: "R", position: "main", level: "upper", columns: [
    { columnId: "C1", columnIndex: 1, cells: [{ cellId: "A", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [leaf("D1", "unknown")] } }] },
    { columnId: "C2", columnIndex: 2, cells: [{ cellId: "B", tierIndex: 1, compartment: {}, front: { kind: "leaves", leaves: [leaf("D2", "right")] } }] },
    { columnId: "C3", columnIndex: 3, cells: [{ cellId: "C", tierIndex: 1, compartment: {}, front: { kind: "open_niche" } }] },
  ] }],
});
const input: GeometryInput = {
  blueprintHash: spatialHash(bp),
  frames: [{
    ownerId: "R", widthMm: 1500, heightMm: 720, source: "measured", verifiedBy: "fixture", camera: { kind: "orthographic_front" },
    cells: [["A", 0], ["B", 500], ["C", 1000]].map(([id, x]) => ({ cellId: id as string, rect: { x: x as number, y: 60, w: 450, h: 600 }, gapMm: 10 })),
  }],
};
const W = 600, H = 288;
const SPEC = { leafThicknessMm: 18, handleProtrusionMm: 35, hingeMarginMm: 35, shadowToleranceMm: 20, angleToleranceDeg: 15 };
const g = (() => { const r = buildSpatialGeometry(bp, input); if (!r.valid) throw new Error(r.errors.join()); return r.geometry; })();
const frame = input.frames[0] as Parameters<typeof buildZoneMap>[1];
const D2 = g.leaves.find((l) => l.leafId === "D2")!;
const full = { ...SPEC, frameWidthMm: 1500, frameHeightMm: 720 };

/** Synthetic "AI" door: full leaf slab at the calibrated angle + thickness + handle beyond the free edge. */
function drawDoor(orig: Uint8Array, extraMm: number) {
  const ai = orig.slice();
  const q = D2.openPolygon!;
  const xh = (q[0].x + q[3].x) / 2, xf = (q[1].x + q[2].x) / 2;
  const sg = Math.sign(xf - xh);
  const x1 = xf + sg * (extraMm / 1500); // handle beyond the free edge
  const x0 = xh - sg * (18 / 1500); // leaf thickness/knuckle projecting past the hinge line
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, v = (y + 0.5) / H;
      if (u < Math.min(x0, x1) || u > Math.max(x0, x1)) continue;
      const t = Math.max(0, Math.min(1, (u - xh) / (xf - xh)));
      const top = q[0].y + (q[1].y - q[0].y) * t, bot = q[3].y + (q[2].y - q[3].y) * t;
      if (v >= top && v <= bot) ai.set([150, 90, 40, 255], (y * W + x) * 4);
    }
  return ai;
}
const orig = (() => { const d = new Uint8Array(W * H * 4); for (let i = 0; i < W * H; i++) d.set([230, 225, 215, 255], i * 4); return d; })();

describe("swing envelope (Tahap 2.5 koridor ayunan)", () => {
  it("envelope contains the whole calibrated leaf polygon", () => {
    const env = buildSwingEnvelope(D2.openPolygon!, "outward_right", D2.closedBounds.width, full);
    const q = D2.openPolygon!;
    for (let i = 0; i <= 10; i++) for (let j = 0; j <= 10; j++) {
      const a = { x: q[0].x + (q[1].x - q[0].x) * (i / 10), y: q[0].y + (q[1].y - q[0].y) * (i / 10) };
      const b = { x: q[3].x + (q[2].x - q[3].x) * (i / 10), y: q[3].y + (q[2].y - q[3].y) * (i / 10) };
      const p = { x: a.x + (b.x - a.x) * (j / 10) - 1e-6 * (i === 10 ? 1 : 0), y: a.y + (b.y - a.y) * (j / 10) };
      expect(pointInPolygon(p, env)).toBe(true);
    }
  });

  it("envelope covers leaf thickness + handle beyond the free edge, and hinge margin behind it", () => {
    const env = buildSwingEnvelope(D2.openPolygon!, "outward_right", D2.closedBounds.width, full);
    const q = D2.openPolygon!;
    const xf = (q[1].x + q[2].x) / 2, xh = (q[0].x + q[3].x) / 2, ym = (q[0].y + q[3].y) / 2;
    const sg = Math.sign(xf - xh);
    expect(pointInPolygon({ x: xf + sg * 50 / 1500, y: ym }, env)).toBe(true); // thickness 18 + handle 35
    expect(pointInPolygon({ x: xh - sg * 30 / 1500, y: ym }, env)).toBe(true); // knuckle/thickness past hinge line
    expect(pointInPolygon({ x: xh - sg * 120 / 1500, y: ym }, env)).toBe(false); // not an arbitrary blow-up
  });

  it("zone map: envelope overrides carcass, no conflicts; unknown hinge cell and open niche stay protected", () => {
    const old = buildZoneMap(g, frame, W, H);
    const m = buildEnvelopeZoneMap(g, frame, W, H, SPEC);
    expect(m.conflicts).toBe(0);
    const editNew = m.zones.filter(isEditable).length, editOld = old.zones.filter(isEditable).length;
    expect(editNew).toBeGreaterThan(editOld);
    const at = (mmX: number, mmY: number) => m.zones[Math.floor(mmY * 0.4) * W + Math.floor(mmX * 0.4)];
    expect(at(225, 360)).toBe(ZONE.carcass); // cell A (hinge unknown) locked
    expect(at(1225, 360)).toBe(ZONE.carcass); // open niche locked
    expect(m.protectedCells).toContain("A");
  });

  it("full door (thickness + handle) is NOT clipped with the new envelope, but IS clipped with the old corridor", () => {
    const ai = drawDoor(orig, 18 + 35);
    const old = buildZoneMap(g, frame, W, H);
    const neu = buildEnvelopeZoneMap(g, frame, W, H, SPEC);
    expect(analyzeEditBoundary({ width: W, height: H, data: orig }, { width: W, height: H, data: ai }, old.zones, W, H).clippedContentPixels).toBeGreaterThan(0);
    const b = analyzeEditBoundary({ width: W, height: H, data: orig }, { width: W, height: H, data: ai }, neu.zones, W, H);
    expect(b.clippedContentPixels).toBe(0);
    // every door pixel survives restoration
    const fin = compositeProtectedPixels({ width: W, height: H, data: orig }, { width: W, height: H, data: ai }, neu.zones, W, H);
    for (let i = 0; i < ai.length; i++) expect(fin.data[i]).toBe(ai[i]);
  });

  it("inner feather: protected pixels identical 100% (MAE 0); weights 0 outside edit, ramp inside", () => {
    const m = buildEnvelopeZoneMap(g, frame, W, H, SPEC);
    const ai = new Uint8Array(orig.length); for (let i = 0; i < ai.length; i += 4) ai.set([10, 20, 30, 200], i);
    const comp = compositeProtectedPixels({ width: W, height: H, data: orig }, { width: W, height: H, data: ai }, m.zones, W, H);
    const wts = innerFeatherWeights(m.zones, W, H, 4);
    const out = applyInnerFeather(orig, comp.data as Uint8Array, m.zones, wts);
    const a = auditCompositingQuality({ width: W, height: H, data: orig }, { width: W, height: H, data: ai }, { width: W, height: H, data: out }, m.zones, W, H);
    expect(a.protectedVsOriginal.all.identicalPct).toBe(100);
    expect(a.protectedVsOriginal.all.mae).toBe(0);
    for (let i = 0; i < m.zones.length; i++) if (!isEditable(m.zones[i]!)) expect(wts[i]).toBe(0);
    expect(wts.reduce((a, b) => Math.max(a, b), 0)).toBe(1);
  });
});
