import { describe, expect, it } from "vitest";
import type { LeafPhysicalGeometry, Quad } from "./spatial-geometry";
import { checkPromptMatchesGeometry, compileLeafOpeningPrompt, leafPromptFacts, LeafPromptError } from "./spatial-leaf-prompt";

const N = 1024, n = (v: number) => v / N;
// Synthetic fixture quad (iter3): [hingeStart, freeStart, freeEnd, hingeEnd]; hinge at x=620, free at x=673.
const quadL: Quad = [{ x: n(620), y: n(150) }, { x: n(673), y: n(130) }, { x: n(673), y: n(500) }, { x: n(620), y: n(481) }];
const mirror = (q: Quad): Quad => q.map((p) => ({ x: 1 - p.x, y: p.y })) as Quad;
const leaf = (over: Partial<LeafPhysicalGeometry>): LeafPhysicalGeometry => ({
  leafId: "L-TEST", parentCellId: "C1", ownerId: "R1", kind: "swing",
  closedRectMm: { x: 0, y: 0, w: 400, h: 700 }, closedBounds: { x: 0.4, y: 0.15, width: 0.2, height: 0.33 },
  hingeEdge: "left", swingDirection: "outward_left", openingAngleDeg: 75,
  hingeAnchor: { x: n(620), y: n(315) }, openPolygon: quadL, ...over,
});

describe("prompt compiler mengikuti geometri daun", () => {
  it("engsel kiri → handle kanan, 2 engsel di sisi kiri, satu daun", () => {
    const f = leafPromptFacts(leaf({}), N, N);
    expect(f.handlePosition).toBe("right");
    expect(f.hingeAnchorPx).toEqual({ x: 620, y: 315 });
    const p = compileLeafOpeningPrompt(f);
    expect(p).toContain("hinged on its left vertical edge");
    expect(p).toContain("on the right free edge");
    expect(checkPromptMatchesGeometry(p, f)).toEqual([]);
  });
  it("engsel kanan (cermin) → handle kiri", () => {
    const l = leaf({ hingeEdge: "right", swingDirection: "outward_right", openPolygon: mirror(quadL), hingeAnchor: { x: 1 - n(620), y: n(315) } });
    const f = leafPromptFacts(l, N, N);
    expect(f.handlePosition).toBe("left");
    expect(checkPromptMatchesGeometry(compileLeafOpeningPrompt(f), f)).toEqual([]);
  });
  it("lift-up engsel atas → handle bawah", () => {
    const f = leafPromptFacts(leaf({ kind: "lift_up", hingeEdge: "top", swingDirection: "upward" }), N, N);
    expect(f.handlePosition).toBe("bottom");
  });
  it("negatif: engsel belum diverifikasi → tidak ada prompt", () => {
    expect(() => leafPromptFacts(leaf({ hingeEdge: null, swingDirection: null, hingeAnchor: null, openPolygon: null }), N, N)).toThrow(LeafPromptError);
  });
  it("negatif: arah buka bertentangan dengan engsel ditolak", () => {
    expect(() => leafPromptFacts(leaf({ swingDirection: "outward_right" }), N, N)).toThrow(/bertentangan/);
  });
  it("negatif: polygon cermin dengan engsel kiri ditolak (handle akan di sisi engsel)", () => {
    expect(() => leafPromptFacts(leaf({ openPolygon: mirror(quadL) }), N, N)).toThrow(LeafPromptError);
  });
  it("negatif: prompt manual dengan sisi handle terbalik terdeteksi", () => {
    const f = leafPromptFacts(leaf({}), N, N);
    const bad = compileLeafOpeningPrompt(f).replace("on the right free edge", "on the left free edge");
    expect(checkPromptMatchesGeometry(bad, f)).toContain("sisi handle tidak sesuai geometri");
  });
});
