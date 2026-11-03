import { describe, expect, it } from "vitest";
import { buildSwingEnvelope, freeEdgeHandleRegion, handleOnFreeSide, pointInPolygon, innerFeatherWeights, applyInnerFeather, ZONE } from "./spatial-mask";

// Synthetic fixture only (same 1024 px canvas as the gateway experiment).
const N = 1024, n = (v: number) => v / N;
const quad: [any, any, any, any] = [{ x: n(620), y: n(150) }, { x: n(673), y: n(130) }, { x: n(673), y: n(500) }, { x: n(620), y: n(481) }];
const spec = { frameWidthMm: 2048, frameHeightMm: 2048, leafThicknessMm: 18, handleProtrusionMm: 35, hingeMarginMm: 35, shadowToleranceMm: 20, angleToleranceDeg: 15, flareTolerance: 2 };
const minY = (poly: { y: number }[]) => Math.min(...poly.map((p) => p.y)) * N;
const maxY = (poly: { y: number }[]) => Math.max(...poly.map((p) => p.y)) * N;

describe("iterasi 3: koridor atas, handle, feather", () => {
  it("toleransi atas +30 px hanya menggeser tepi atas", () => {
    const a = buildSwingEnvelope(quad, "outward_right", n(210), spec);
    const b = buildSwingEnvelope(quad, "outward_right", n(210), { ...spec, topToleranceNorm: n(30) });
    expect(minY(a) - minY(b)).toBeCloseTo(30, 3);
    expect(maxY(b)).toBeCloseTo(maxY(a), 6);
  });
  it("tanpa toleransi atas, envelope identik dengan versi lama", () => {
    const a = buildSwingEnvelope(quad, "outward_right", n(210), spec);
    const b = buildSwingEnvelope(quad, "outward_right", n(210), { ...spec, topToleranceNorm: 0 });
    expect(b).toEqual(a);
  });
  it("handle berada di sisi bebas, bukan sisi engsel", () => {
    const r = freeEdgeHandleRegion(quad, n(8));
    expect(handleOnFreeSide(quad, r)).toBe(true);
    const mirrored: [any, any, any, any] = [quad[1], quad[0], quad[3], quad[2]];
    expect(handleOnFreeSide(mirrored, r)).toBe(false);
  });
  it("zona handle seluruhnya masuk envelope yang diizinkan", () => {
    const env = buildSwingEnvelope(quad, "outward_right", n(210), { ...spec, topToleranceNorm: n(30) });
    for (const p of freeEdgeHandleRegion(quad, n(8))) expect(pointInPolygon(p, env)).toBe(true);
  });
  it("feather hanya di dalam area edit; pixel terlindungi tetap identik", () => {
    const W = 20, H = 1, z = new Uint8Array(W).map((_, i) => (i >= 5 && i < 15 ? ZONE.cavity : ZONE.carcass));
    const o = new Uint8Array(W * 4).fill(10), c = new Uint8Array(W * 4).fill(200);
    const out = applyInnerFeather(o, c, z, innerFeatherWeights(z, W, H, 3));
    for (let i = 0; i < W; i++) if (z[i] !== ZONE.cavity) expect(out[i * 4]).toBe(10);
    expect(out[5 * 4]).toBeGreaterThan(10);
    expect(out[5 * 4]).toBeLessThan(out[9 * 4]!);
  });
});
