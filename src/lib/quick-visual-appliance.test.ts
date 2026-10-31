import { describe, expect, it } from "vitest";
import { applianceRule } from "@/lib/quick-visual.functions";

const k = (note: string) => applianceRule({ items: ["KITCHEN_SET"], note });

describe("applianceRule", () => {
  it("keep Before forbids adding a cooker hood", () => {
    expect(k("Pakai peralatan asli Before, Kabinet atas full plafon / atap")).toContain("no cooker hood");
  });
  it("clean mode removes all appliances", () => {
    expect(k("Kitchen set bersih (tanpa alat)")).toContain("NO stove");
  });
  it("default lets appliances follow the reference", () => {
    expect(k("")).toContain("may follow IMAGE 2");
  });
});
