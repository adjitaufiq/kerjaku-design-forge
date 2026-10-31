import { describe, expect, it } from "vitest";
import { addOnRule } from "./quick-visual.functions";

describe("addOnRule", () => {
  it("adds nothing when no add-on is ticked", () => {
    const r = addOnRule("Bentuk letter L");
    expect(r).toContain("NO INVENTED EXTRAS");
    expect(r).not.toContain("ADD ONLY");
  });
  it("adds only the ticked item with its placement", () => {
    const r = addOnRule("+ List gold di pintu");
    expect(r).toContain("brushed-gold");
    expect(r).not.toContain("smoked tinted glass");
  });
});
