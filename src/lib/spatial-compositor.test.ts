import { describe, expect, it } from "vitest";
import {
  analyzeEditBoundary,
  auditCompositingQuality,
  compositeProtectedPixels,
  CompositorError,
  zonesFromBinaryMask,
  type RgbaImage,
} from "./spatial-compositor";
import { ZONE } from "./spatial-mask";

const W = 32, H = 32;
const img = (fill: (x: number, y: number) => [number, number, number, number]): RgbaImage => {
  const d = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.set(fill(x, y), (y * W + x) * 4);
  return { width: W, height: H, data: d };
};
// zones: outside border, carcass ring, cavity x 10..19, corridor x 20..25 (y 8..23)
const zones = (() => {
  const z = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (y < 4 || y >= 28 || x < 4 || x >= 28) z[i] = ZONE.outside;
      else if (y >= 8 && y < 24 && x >= 10 && x < 20) z[i] = ZONE.cavity;
      else if (y >= 8 && y < 24 && x >= 20 && x < 26) z[i] = ZONE.corridor;
      else z[i] = ZONE.carcass;
    }
  return z;
})();
const original = img((x, y) => [x * 7, y * 7, 100, 255]);
const aiDrifted = img((x, y) => [255 - x, 30, (x + y) % 256, 250]); // AI changes everything incl. alpha

describe("spatial-compositor", () => {
  it("protected pixels identical 100%, MAE 0, all RGBA channels", () => {
    const final = compositeProtectedPixels(original, aiDrifted, zones, W, H);
    const a = auditCompositingQuality(original, aiDrifted, final, zones, W, H);
    expect(a.aiDriftProtected.changedPixels).toBeGreaterThan(0);
    expect(a.protectedVsOriginal.all.identicalPct).toBe(100);
    expect(a.protectedVsOriginal.all.mae).toBe(0);
    expect(a.protectedVsOriginal.all.maxDiffByChannel).toEqual({ r: 0, g: 0, b: 0, a: 0 });
    expect(a.protectedVsOriginal.carcass.changedPixels).toBe(0);
    expect(a.protectedVsOriginal.outside.changedPixels).toBe(0);
    expect(a.pass).toBe(true);
  });

  it("cavity and corridor take AI pixels exactly (compositor never clips the edit zone)", () => {
    const final = compositeProtectedPixels(original, aiDrifted, zones, W, H);
    const a = auditCompositingQuality(original, aiDrifted, final, zones, W, H);
    expect(a.editableVsAi.pixels).toBe(16 * 16);
    expect(a.editableVsAi.changedPixels).toBe(0);
  });

  it("rejects mismatched dimensions, buffer length, mask size, undefined zones, invalid buffers", () => {
    const small: RgbaImage = { width: 16, height: 16, data: new Uint8Array(16 * 16 * 4) };
    expect(() => compositeProtectedPixels(original, small, zones, W, H)).toThrow(CompositorError);
    expect(() => compositeProtectedPixels(original, { width: W, height: H, data: new Uint8Array(10) }, zones, W, H)).toThrow(/panjang buffer/);
    expect(() => compositeProtectedPixels(original, aiDrifted, new Uint8Array(5), W, H)).toThrow(/mask/);
    const bad = zones.slice(); bad[0] = 7;
    expect(() => compositeProtectedPixels(original, aiDrifted, bad, W, H)).toThrow(/tidak terdefinisi/);
    expect(() => compositeProtectedPixels(original, { width: W, height: H, data: [] as unknown as Uint8Array }, zones, W, H)).toThrow(/tidak valid/);
  });

  it("boundary analysis: door drawn inside the edit zone → no clipping signal", () => {
    const ai = img((x, y) => {
      const i = y * W + x;
      return zones[i] === ZONE.cavity || zones[i] === ZONE.corridor ? [10, 200, 10, 255] : [...original.data.slice(i * 4, i * 4 + 4)] as [number, number, number, number];
    });
    expect(analyzeEditBoundary(original, ai, zones, W, H).verdict).toBe("NO_CLIPPING_SIGNAL");
  });

  it("boundary analysis: door leaf extending past the corridor → CLIPPING_RISK", () => {
    const ai = img((x, y) => (y >= 8 && y < 24 && x >= 10 && x < 28 ? [10, 200, 10, 255] : [...original.data.slice((y * W + x) * 4, (y * W + x) * 4 + 4)] as [number, number, number, number]));
    const r = analyzeEditBoundary(original, ai, zones, W, H);
    expect(r.clippedContentPixels).toBeGreaterThan(0);
    expect(r.verdict).toBe("CLIPPING_RISK");
  });

  it("binary white-is-edit mask maps to editable/protected zones", () => {
    const z = zonesFromBinaryMask(new Uint8Array([0, 255, 127, 128]));
    expect([...z]).toEqual([ZONE.outside, ZONE.cavity, ZONE.outside, ZONE.cavity]);
  });
});
