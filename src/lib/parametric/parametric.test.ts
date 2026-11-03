import { describe, expect, it } from "vitest";
import { compileCabinet, cuttingList, hingeTally, ParametricError } from "./cabinet-engine";
import { frontElevation, sideSection, topView, viewToSvg } from "./elevation-2d";
import { viewsToDxf } from "./dxf-generator";
import { workingDrawingPdf } from "./pdf-drawing";
import { testCabinetFixture } from "./fixture-test-cabinet";

const cab = () => compileCabinet(testCabinetFixture());

describe("Milestone A — parametric core", () => {
  it("fixture menghasilkan tepat 2 pintu, 2 ambalan, 1 partisi, 10 komponen", () => {
    const c = cab().components;
    expect(c.filter((x) => x.role === "door")).toHaveLength(2);
    expect(c.filter((x) => x.role === "shelf")).toHaveLength(2);
    expect(c.filter((x) => x.role === "divider")).toHaveLength(1);
    expect(c).toHaveLength(10);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
  });

  it("ukuran potong sesuai aturan konstruksi eksplisit", () => {
    const m = Object.fromEntries(cuttingList(cab()).map((r) => [r.id, r]));
    expect(m["CAB-01-SIDE-L"]).toMatchObject({ length: 800, width: 550, thickness: 18 });
    expect(m["CAB-01-TOP"]).toMatchObject({ length: 1164, width: 550, thickness: 18 });
    expect(m["CAB-01-BACK"]).toMatchObject({ length: 1164, width: 764, thickness: 6 });
    expect(m["CAB-01-DIV-1"]).toMatchObject({ length: 764, width: 544 });
    expect(m["CAB-01-C1-SHELF-1"]).toMatchObject({ length: 573, width: 524 });
    expect(m["CAB-01-C1-D1"]).toMatchObject({ length: 796, width: 597, thickness: 18 });
  });

  it("engsel: 2 per daun → 2 set (4 pcs), sisi engsel kiri/kanan", () => {
    const c = cab();
    expect(hingeTally(c).label).toBe("2 set (4 pcs)");
    expect(c.components.find((x) => x.id === "CAB-01-C1-D1")?.hingeSide).toBe("left");
    expect(c.components.find((x) => x.id === "CAB-01-C2-D1")?.hingeSide).toBe("right");
  });

  it("ubah lebar → semua output berubah, ID tetap, jumlah pintu tetap", () => {
    const a = cab();
    const b = compileCabinet(testCabinetFixture({ width: 1400 }));
    expect(b.components.map((x) => x.id)).toEqual(a.components.map((x) => x.id));
    expect(b.components.find((x) => x.id === "CAB-01-C1-D1")?.cut.width).toBe(697);
    expect(frontElevation(b).width).toBe(1400);
    expect(viewsToDxf([{ view: frontElevation(b), ox: 0, oy: 0 }])).toContain("\n1400\n");
    expect(viewToSvg(frontElevation(b))).toContain(">1400<");
  });

  it("provisional tidak siap produksi; verified siap", () => {
    expect(cab().productionReady).toBe(false);
    expect(compileCabinet(testCabinetFixture({ dimensionStatus: "verified" })).productionReady).toBe(true);
  });

  it("negatif: ambalan di luar, kolom ganda, engsel < 2 ditolak", () => {
    expect(() => compileCabinet(testCabinetFixture({ shelfHeights: [[900], [400]] }))).toThrow(ParametricError);
    expect(() => compileCabinet(testCabinetFixture({ doors: [{ columnIndex: 0, hingeSide: "left" }, { columnIndex: 0, hingeSide: "right" }] }))).toThrow(ParametricError);
    const s = testCabinetFixture();
    expect(() => compileCabinet({ ...s, construction: { ...s.construction, hingesPerLeaf: 1 } })).toThrow(ParametricError);
  });

  it("ID pintu konsisten di SVG, DXF dan cutting list", () => {
    const c = cab();
    const svg = viewToSvg(frontElevation(c));
    const dxf = viewsToDxf([{ view: frontElevation(c), ox: 0, oy: 0 }]);
    for (const id of ["CAB-01-C1-D1", "CAB-01-C2-D1"]) {
      expect(svg).toContain(id);
      expect(dxf).toContain(id);
    }
    expect(sideSection(c).prims.length).toBeGreaterThan(0);
    expect(topView(c).prims.length).toBeGreaterThan(0);
  });

  it("DXF struktur valid dengan layer dan EOF", () => {
    const dxf = viewsToDxf([{ view: frontElevation(cab()), ox: 0, oy: 0 }]);
    expect(dxf.startsWith("0\nSECTION")).toBe(true);
    expect(dxf.trimEnd().endsWith("EOF")).toBe(true);
    for (const l of ["CARCASS", "DOOR", "DIMS"]) expect(dxf).toContain(`\n2\n${l}\n`);
  });

  it("PDF A3 dua halaman", () => {
    const pdf = workingDrawingPdf(cab());
    expect(pdf.getNumberOfPages()).toBe(2);
    expect(Math.round(pdf.internal.pageSize.getWidth())).toBe(420);
  });
});
