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
        interiorSideUrl: "https://example.com/side.png",
        specHints: hints,
      }),
    );
    expect(url.searchParams.get("interiorUrl")).toBe("https://example.com/inside.png");
    expect(url.searchParams.get("interiorSideUrl")).toBe("https://example.com/side.png");
    const data = JSON.parse(Buffer.from(url.searchParams.get("data") ?? "", "base64url").toString("utf8"));
    expect(data.interiorSideUrl).toBe("https://example.com/side.png");
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
  it("finishExtras: 2 pintu angkat = 4 pcs gas spring, qty kaca/LED/spot tidak ditebak", () => {
    const s = _toSme({
      outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", glass: "fluted", lighting: "led_spot",
      accessories: [{ id: "hidrolik", position: "atas", doors: 2 }],
    });
    expect(s.finishExtras.gasSprings).toEqual({ doors: 2, qty: 4, unit: "pcs" });
    expect(s.finishExtras.glassDoors).toMatchObject({ type: "fluted", frame: "wood_hpl", qty: null });
    expect(s.finishExtras.ledRun.meters).toBeNull();
    expect(s.finishExtras.spotlights.qty).toBeNull();
  });
  it("HPL motif (termasuk motif marmer) selalu ditandai HPL workshop, bukan batu asli", () => {
    const s = _toSme({
      outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [], topMaterial: "hpl", glass: "fluted",
      hplCodes: { lower: "TH 1205 FC", upperSame: true, upper: "", top: "TH 003 AA", hasAccent: true, accent: "TH 001 AA", accentNote: "" },
    });
    expect(s.topMaterial).toBe("hpl");
    expect(s.hplMotifs.every((m) => m.isWorkshopHpl)).toBe(true);
    expect(s.finishExtras.glassDoors).toMatchObject({ frame: "wood_hpl", hplCode: "TH 001 AA" });
  });
  it("finishExtras: tanpa kaca/lampu/hidrolik = 0", () => {
    const s = _toSme({ outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", glass: "none", lighting: "none", accessories: [] });
    expect(s.finishExtras.glassDoors.qty).toBe(0);
    expect(s.finishExtras.gasSprings.qty).toBe(0);
    expect(s.finishExtras.spotlights.qty).toBe(0);
  });
});

import { missingForEstimate } from "./interior-spec";
describe("estimate gate (spek wajib lengkap sebelum ke SME)", () => {
  const full = {
    material: "pvc-board-18", outside: "hpl", inside: "blockmin", hinge: "slowmo",
    slide: "dt_slowmo", glue: "active", accessories: [],
    modules: defaultModules("single").map((m) => ({ ...m, finish: "TACO TH 825 NT" })),
    hplCodes: { lower: "TH 825 NT", upperSame: true, upper: "", top: "TH 003 AA", hasAccent: false, accent: "", accentNote: "" },
    topLayers: "2", edge: "edging", handle: "profile_j", glass: "none", lighting: "led", ledRunCount: 1, accessoryMode: "plain",
    hplInfo: { "825 NT": { code: "TH 825 NT", name: "Cherry Afromosia", texture: "woodgrain" }, "003 AA": { code: "TH 003 AA", name: "Black", texture: "solid" }, "001 AA": { code: "TH 001 AA", name: "Porcelain White", texture: "solid" } },
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
  it("sends all 3 HPL motifs 1:1 with SME field names", () => {
    const s = _toSme(specHintsSchema.parse({ ...full, hplCodes: { lower: "1205 FC", upperSame: true, upper: "", top: "003 AA", hasAccent: true, accent: "001 AA", accentNote: "" } }));
    expect([s.hplOutside, s.hplTop, s.hplAccent]).toEqual(["1205 FC", "003 AA", "001 AA"]);
    expect(s.hplMotifs.map((m) => m.usage)).toEqual(["kabinet", "top", "aksen"]);
  });
  it("top table 2 lapis = double, 1 lapis = single (bukan none)", () => {
    expect(_toSme(specHintsSchema.parse(full)).top).toBe("double");
    expect(_toSme(specHintsSchema.parse({ ...full, topLayers: "1" })).top).toBe("single");
  });
  it("hidrolik: 2 daun pintu angkat = 4 pcs gas spring", () => {
    const s = _toSme(specHintsSchema.parse({ ...full, accessoryMode: "selected", accessories: [{ id: "hidrolik", position: "kabinet atas", doors: 2 }] }));
    expect(s.accessories[0]).toMatchObject({ id: "gas-spring", qty: 4, unit: "pcs" });
  });
  it("blocks estimate when hidrolik door count is missing", () => {
    const s = specHintsSchema.parse({ ...full, accessoryMode: "selected", accessories: [{ id: "hidrolik", position: "kabinet atas" }] });
    expect(missingForEstimate(s)).toContain("Jumlah daun pintu angkat (hidrolik)");
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
      missingFinalSpec({ ...base, hplInfo: { "825 NT": { code: "TH 825 NT", name: "Cherry Afromosia", texture: "woodgrain" }, "003 AA": { code: "TH 003 AA", name: "Black", texture: "solid" }, "001 AA": { code: "TH 001 AA", name: "Porcelain White", texture: "solid" } }, hplCodes: codes, topLayers: "2", edge: "edging", handle: "none", glass: "dark", lighting: "led_spot", spotlightCount: 2, ledRunCount: 2, accessoryMode: "plain" }),
    ).toEqual([]);
  });
  it("requires choosing 1 or 2 layer top table", () => {
    const base: SpecHints = { outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [] };
    expect(missingFinalSpec(base)).toContain("Top table 1 / 2 lapis");
    expect(missingFinalSpec({ ...base, topLayers: "1" })).not.toContain("Top table 1 / 2 lapis");
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

import { countertopRule as _ct, missingFinalSpec as _mfs } from "./interior-spec";
describe("top table material", () => {
  const base: SpecHints = { outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [] };
  const codes = { lower: "TH 1205 FC", upperSame: true, upper: "", top: "TH 003 AA", hasAccent: false, accent: "", accentNote: "" };
  it("HPL top forbids granite in the render prompt", () => {
    expect(_ct({ ...base, hplCodes: codes })).toContain("NOT granite");
  });
  it("granite top needs no HPL top code and is sent as granite", () => {
    const s = { ...base, topMaterial: "granite" as const, hplCodes: { ...codes, top: "" } };
    expect(_mfs(s)).not.toContain("Kode HPL top table");
    expect(_toSme(specHintsSchema.parse(s))).toMatchObject({ topMaterial: "granite", top: "none" });
  });
});

import { buildExteriorPrompt as _ext, missingFinalSpec as _mf2, normTacoCode as _norm, toSmeSpec as _sme2 } from "./interior-spec";
describe("TACO catalogue validation", () => {
  const base: SpecHints = { outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [] };
  const codes = { lower: "TH 1205 FC", upperSame: true, upper: "", top: "TH 001 AA", hasAccent: false, accent: "", accentNote: "" };
  const info = {
    "1205 FC": { code: "TH 1205 FC", name: "Scandinavia Walnut", texture: "woodgrain" },
    "001 AA": { code: "TH 001 AA", name: "Porcelain White", texture: "solid" },
  };
  it("normalizes codes", () => expect(_norm("th 1205-fc")).toBe("1205 FC"));
  it("blocks generate until each code is checked at TACO", () => {
    expect(_mf2({ ...base, hplCodes: codes })).toContain("Kode kabinet bawah belum dicek di katalog TACO");
    expect(_mf2({ ...base, hplCodes: codes, hplInfo: info }).some((m) => m.includes("TACO"))).toBe(false);
  });
  it("final prompt uses official motif names and overrides IMAGE 1 colours", () => {
    const p = _ext({ ...base, hplCodes: codes, hplInfo: info });
    expect(p).toContain("Scandinavia Walnut");
    expect(p).toContain("Porcelain White");
    expect(p).not.toContain("Keep the colour/motif family");
  });
  it("duco requires a colour sample", () => {
    expect(_mf2({ ...base, outside: "duco" })).toContain("Foto sampel warna Duco");
    expect(_ext({ ...base, outside: "duco", ducoHex: "#a1b2c3" })).toContain("#a1b2c3");
  });
  it("SME gets motif name + texture", () => {
    const s = _sme2(specHintsSchema.parse({ ...base, hplCodes: codes, hplInfo: info }));
    expect(s.hplMotifs[0]).toMatchObject({ code: "TH 1205 FC", name: "Scandinavia Walnut", texture: "woodgrain" });
  });
});

describe("lampu sorot", () => {
  const base: SpecHints = { outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", accessories: [], lighting: "led_spot" };
  it("2 titik dari desainer dikirim ke SME sebagai qty 2", () => {
    expect(_toSme({ ...base, spotlightCount: 2 }).finishExtras.spotlights.qty).toBe(2);
  });
  it("wajib isi jumlah titik bila lampu mencakup sorot", () => {
    expect(missingFinalSpec(base)).toContain("Jumlah titik lampu sorot");
    expect(missingFinalSpec({ ...base, spotlightCount: 2 })).not.toContain("Jumlah titik lampu sorot");
  });
});
import { toSmeSpec as _sme3, missingFinalSpec as _mf3, buildInteriorPrompt as _ip3 } from "./interior-spec";
describe("LED strip jalur eksak", () => {
  const base = { outside: "hpl", inside: "blockmin", hinge: "slowmo", slide: "tandem", lighting: "led_spot", accessories: [] } as never;
  it("mengirim 2 jalur LED ke SME", () => {
    expect(_sme3({ ...(base as object), ledRunCount: 2 } as never).finishExtras.ledRun.qty).toBe(2);
  });
  it("wajib isi jumlah jalur LED bila pakai LED", () => {
    expect(_mf3(base)).toContain("Jumlah jalur LED strip");
  });
  it("tampak dalam mengunci jumlah daun pintu bertingkat", () => {
    expect(_ip3(base)).toContain("never merge fronts");
  });
});

import { slideLook as _sl } from "./interior-spec";
describe("warna rel laci TACO", () => {
  it("BBS double track hitam", () => expect(_sl("dt_slowmo")).toMatch(/MATTE BLACK/));
  it("RLT roller putih", () => expect(_sl("roller")).toMatch(/WHITE/));
  it("tandem tersembunyi di bawah", () => expect(_sl("tandem")).toMatch(/UNDERMOUNT/));
});

import { layoutCounts as _lc, layoutPrompt as _lp } from "./interior-spec";
describe("front layout blueprint (Adji)", () => {
  const adji = {
    upper: [{ fronts: ["swing", "lift_glass"] }, { fronts: ["swing", "swing"] }, { fronts: ["swing", "swing"] }, { fronts: ["swing", "swing"] }, { fronts: ["double", "lift_glass"] }],
    lower: [{ fronts: ["swing"] }, { fronts: ["drawer", "drawer", "drawer"] }, { fronts: ["swing"] }, { fronts: ["swing"] }],
  } as const;
  const l = { upper: adji.upper.map((c) => ({ fronts: [...c.fronts] })), lower: adji.lower.map((c) => ({ fronts: [...c.fronts] })) };
  it("12 pintu swing = engsel 12 set, 3 rel, 4 pcs hidrolik", () => {
    expect(_lc(l)).toMatchObject({ swing: 12, hingeSets: 12, slideSets: 3, gasSpringPcs: 4 });
  });
  it("prompt locks column counts", () => {
    const p = _lp(l);
    expect(p).toContain("UPPER CABINETS: EXACTLY 5 vertical columns");
    expect(p).toContain("BASE CABINETS: EXACTLY 4 vertical columns");
    expect(p).toContain("exactly 12 swing door leaves");
  });
});
