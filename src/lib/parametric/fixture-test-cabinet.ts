import type { ParametricCabinetSpec } from "./types";

/** Synthetic test fixture — NOT a real project size (not Adji). */
export function testCabinetFixture(over: Partial<ParametricCabinetSpec> = {}): ParametricCabinetSpec {
  return {
    id: "CAB-01",
    name: "Fixture Uji 2 Pintu",
    width: 1200,
    height: 800,
    depth: 550,
    dimensionStatus: "provisional",
    columns: 2,
    shelfHeights: [[400], [400]],
    doors: [
      { columnIndex: 0, hingeSide: "left" },
      { columnIndex: 1, hingeSide: "right" },
    ],
    construction: {
      panelThickness: 18,
      backThickness: 6,
      backInset: "inside-flush",
      doorGap: 2,
      shelfFrontSetback: 20,
      hingeOffsetFromEdge: 100,
      hingesPerLeaf: 2,
    },
    material: { body: "Multiplek 18 mm", door: "Multiplek 18 mm + HPL", finish: "HPL" },
    hingeRef: "Engsel sendok TACO",
    ...over,
  };
}
