import { describe, expect, it } from "vitest";
import { specHintsSchema, parseInteriorRecord } from "./interior-spec";
import { buildEstimatorUrl } from "./material-estimator";

const spec = {
  outside: "hpl_premium",
  inside: "blockmin",
  hinge: "slowmo",
  slide: "tandem",
  accessories: [{ id: "rak-sayur", position: "kabinet bawah ke-2 dari kiri — bawah kompor" }],
} as const;
const hints = specHintsSchema.parse(spec);
describe("SME interior contract", () => {
  it("requires the workshop's position for every selected accessory", () => {
    expect(
      specHintsSchema.safeParse({ ...hints, accessories: [{ id: "rak-sayur", position: "" }] })
        .success,
    ).toBe(false);
  });
  it("allows only the agreed material and hardware selections", () => {
    expect(hints).toEqual(spec);
    expect(specHintsSchema.safeParse({ ...hints, outside: "guessed-from-render" }).success).toBe(
      false,
    );
  });
  it("passes an additional interiorUrl while preserving After and Unicode positions in base64url", () => {
    const url = new URL(
      buildEstimatorUrl({
        projectId: "p",
        leadId: "l",
        workspaceId: "w",
        clientName: "Ibu Malla",
        projectName: "Kitchen",
        projectType: "KITCHEN_SET",
        origin: "https://kerjaku-design-forge.lovable.app",
        renderUrl: "https://example.com/after.png",
        interiorUrl: "https://example.com/inside.png",
        specHints: hints,
      }),
    );
    expect(url.searchParams.get("interiorUrl")).toBe("https://example.com/inside.png");
    expect(url.searchParams.get("renderUrl")).toBe("https://example.com/after.png");
    const encoded = url.searchParams.get("specHints") ?? "";
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"))).toMatchObject({ ...spec, brand: "TACO", material: "pvc-board-18" });
    expect(url.searchParams.has("dimensions")).toBe(false);
  });
  it("links the interior image to its exact After rather than replacing it", () => {
    const record = parseInteriorRecord(
      JSON.stringify({
        projectId: "p",
        baseAssetId: "after-1",
        interiorAssetId: "inside-1",
        specHints: hints,
      }),
    );
    expect(record?.baseAssetId).toBe("after-1");
    expect(record?.interiorAssetId).toBe("inside-1");
    expect(parseInteriorRecord('{"projectId":"p"}')).toBeNull();
  });
});

describe("layout handoff", () => {
  it("splits an L-shape into 4 cabinet modules and sends shape=L to SME", async () => {
    const { defaultModules } = await import("./interior-spec");
    expect(defaultModules("L")).toHaveLength(4);
    expect(defaultModules("single")).toHaveLength(2);
    const url = new URL(
      buildEstimatorUrl({
        projectId: "p", workspaceId: "w", leadId: "l", clientName: "c", projectName: "n",
        projectType: "KITCHEN_SET", origin: "https://x",
        specHints: { ...hints, shape: "L", modules: defaultModules("L") },
      }),
    );
    expect(url.searchParams.get("shape")).toBe("L");
  });
});

import { toSmeSpec as _toSme, defaultModules } from "./interior-spec";
describe("toSmeSpec", () => {
  it("maps modules to SME categories with TACO defaults", () => {
    const s = _toSme({ outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [], modules: defaultModules("single") });
    expect(s.material).toBe("pvc-board-18");
    expect(s.brand).toBe("TACO");
    expect(s.modules.map((m) => m.category)).toEqual(["kitchen-base", "kitchen-upper"]);
  });
});

import { missingForEstimate } from "./interior-spec";
describe("estimate gate (spek wajib lengkap sebelum ke SME)", () => {
  const full = {
    material: "pvc-board-18", outside: "hpl", inside: "blockmin", hinge: "slowmo",
    slide: "dt_slowmo", glue: "active", accessories: [],
    modules: defaultModules("single").map((m) => ({ ...m, finish: "TACO TH 825 NT" })),
  } as const;
  it("passes when body, glue and every HPL code are filled", () => {
    expect(missingForEstimate(specHintsSchema.parse(full))).toEqual([]);
  });
  it("blocks when a cabinet has no HPL code with a suffix", () => {
    const s = specHintsSchema.parse({ ...full, modules: [full.modules[0], { ...full.modules[1], finish: "HPL putih" }] });
    expect(missingForEstimate(s)).toEqual(["Kode HPL Kabinet atas"]);
  });
  it("blocks when body or glue is not chosen", () => {
    const { material: _m, glue: _g, ...rest } = full;
    expect(missingForEstimate(specHintsSchema.parse(rest))).toEqual(["Bahan bodi", "Jenis lem (Active / Starmax)"]);
  });
  it("sends SME body/hinge codes", () => {
    const s = _toSme(specHintsSchema.parse({ ...full, material: "blockmin-1s-18", hinge: "slowmo_stainless" }));
    expect(s.body).toBe("ply");
    expect(s.hardware).toBe("ET-02");
    expect(s.glue).toBe("active");
  });
});
