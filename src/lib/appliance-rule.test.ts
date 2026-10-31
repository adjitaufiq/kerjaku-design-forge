import { describe, expect, it } from "vitest";
import { applianceRule } from "@/lib/quick-visual.functions";

describe("applianceRule", () => {
  it("follows reference appliances by default (no tag)", () => {
    expect(applianceRule({ items: ["KITCHEN_SET"], note: "" })).toContain("may follow IMAGE 2");
  });
  it("follows reference when upgrade tag chosen", () => {
    const r = applianceRule({ items: ["KITCHEN_SET"], note: "Upgrade alat ikut referensi" });
    expect(r).toContain("follow IMAGE 2");
    expect(r).not.toContain("Do NOT copy");
  });
  it("ignores non-kitchen items", () => {
    expect(applianceRule({ items: ["WARDROBE"], note: "" })).toBe("");
  });
});
