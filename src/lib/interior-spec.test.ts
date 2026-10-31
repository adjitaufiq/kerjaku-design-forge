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
    hplCodes: { lower: "TH 825 NT", upperSame: true, upper: "", top: "TH 003 AA", hasAccent: false, accent: "", accentNote: "" },
    edge: "edging", handle: "profile_j", glass: "none", lighting: "led", accessoryMode: "plain",
  } as const;
  it("passes when body, glue and every HPL code are filled", () => {
    expect(missingForEstimate(specHintsSchema.parse(full))).toEqual([]);
  });
  it("blocks when a cabinet has no HPL code with a suffix", () => {
    const s = specHintsSchema.parse({ ...full, hplCodes: { ...full.hplCodes, upperSame: false, upper: "HPL putih" } });
    expect(missingForEstimate(s)).toEqual(["Kode HPL kabinet atas"]);
  });
  it("blocks when body or glue is not chosen", () => {
    const { material: _m, glue: _g, ...rest } = full;
    expect(missingForEstimate(specHintsSchema.parse(rest))).toEqual(["Bahan bodi", "Jenis lem (Active / Starmax)"]);
  });
  it("sends SME body/hinge codes", () => {
    const s = _toSme(specHintsSchema.parse({ ...full, material: "blockmin-1s-18", hinge: "slowmo_stainless" }));
    expect(s.body).toBe("blockmin_1s");
    expect(_toSme(specHintsSchema.parse({ ...full, material: "blockmin-2s-18" })).body).toBe("blockmin_2s");
    expect(_toSme(specHintsSchema.parse({ ...full, material: "blockboard-18" })).body).toBe("blockboard");
    expect(_toSme(specHintsSchema.parse({ ...full, material: "multiplek-18" })).body).toBe("ply");
    expect(s.hardware).toBe("ET-02");
    expect(s.glue).toBe("active");
  });
});

import { hplPurchaseList, missingFinalSpec, type SpecHints } from "./interior-spec";
describe("final spec HPL sheets", () => {
  const codes = { lower: "TH 825 NT", upperSame: true, upper: "", top: "TH 003 AA", hasAccent: true, accent: "TH 001 AA", accentNote: "rak putih" };
  it("buys at least 1 full sheet per distinct HPL code", () => {
    const list = hplPurchaseList(codes);
    expect(list.map((x) => x.code)).toEqual(["TH 825 NT", "TH 003 AA", "TH 001 AA"]);
    expect(list.every((x) => x.minSheets === 1)).toBe(true);
  });
  it("blocks generate until top table code, edge, handle, glass, lamp and accessory choice are set", () => {
    const base: SpecHints = { outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [] };
    expect(missingFinalSpec({ ...base, hplCodes: { ...codes, top: "" } })).toContain("Kode HPL top table");
    expect(
      missingFinalSpec({ ...base, hplCodes: codes, edge: "edging", handle: "none", glass: "dark", lighting: "led_spot", accessoryMode: "plain" }),
    ).toEqual([]);
  });
});

import { nextSpecVersion as nsv, specVersionLabel as svl } from "./interior-spec";
describe("spec master versioning", () => {
  it("first save is Spek Final 1", () => {
    expect(nsv(undefined, true)).toBe(1);
    expect(svl(1)).toBe("Spek Final 1");
  });
  it("changed spec becomes Spek Revisi 1, then 2", () => {
    expect(svl(nsv({ version: 1 }, true))).toBe("Spek Revisi 1");
    expect(svl(nsv({ version: 2 }, true))).toBe("Spek Revisi 2");
  });
  it("unchanged save keeps version", () => {
    expect(nsv({ version: 2 }, false)).toBe(2);
  });
});
