import { describe, expect, it } from "vitest";
import { buildInteriorPrompt, specHintsSchema, type FrontLayout } from "./interior-spec";
import { calculateSpatialTally, fromFrontLayout, spatialHash } from "./spatial-blueprint";

const adji: FrontLayout = {
  upper: [
    { fronts: ["swing", "lift_glass"] },
    { fronts: ["swing", "swing"] },
    { fronts: ["swing", "swing"] },
    { fronts: ["swing", "swing"] },
    { fronts: ["double", "lift_glass"] },
  ],
  lower: [
    { fronts: ["swing"] },
    { fronts: ["drawer", "drawer", "drawer"] },
    { fronts: ["swing"] },
    { fronts: ["swing"] },
  ],
};

describe("spatial integration (front interior)", () => {
  it("Adji normalizes to 12 swing, 2 lift, 3 drawers; 12 hinge sets, 3 slide sets, 4 gas springs", () => {
    const t = calculateSpatialTally(fromFrontLayout(adji));
    expect([t.swingLeaves, t.liftLeaves, t.drawers]).toEqual([12, 2, 3]);
    expect([t.hingeSets, t.slideSets, t.gasSpringPcs]).toEqual([12, 3, 4]);
  });
  it("spatial hash is deterministic and changes when structure changes", () => {
    expect(spatialHash(fromFrontLayout(adji))).toBe(
      spatialHash(fromFrontLayout(structuredClone(adji))),
    );
    const other = structuredClone(adji);
    other.lower[0] = { fronts: ["double"] };
    expect(spatialHash(fromFrontLayout(other))).not.toBe(spatialHash(fromFrontLayout(adji)));
  });
  it("front prompt carries the spatial contract with every leaf/drawer ID and no v1 FRONT BLUEPRINT", () => {
    const spec = specHintsSchema.parse({
      frontLayout: adji,
      outside: "hpl",
      inside: "blockmin",
      hinge: "slowmo",
      slide: "dt_slowmo",
      accessories: [],
    });
    const p = buildInteriorPrompt(spec, "", "front", fromFrontLayout(adji));
    expect(p).toContain("SPATIAL STRUCTURE CONTRACT");
    expect(p).not.toContain("FRONT BLUEPRINT");
    for (let i = 1; i <= 12; i++) expect(p).toContain(`D${String(i).padStart(2, "0")}`);
    for (const id of ["L01", "L02", "DR01", "DR02", "DR03"]) expect(p).toContain(id);
    expect(p).toContain("exactly 12 swing leaves, 2 lift-up flaps and 3 drawers");
  });
});
