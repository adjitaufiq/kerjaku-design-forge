// Milestone B — 2D views of the Kitchen Assembly. All derived from compiled components (mm).
import { jsPDF } from "jspdf";
import { dimGeom, type Layer, type Prim, type View } from "./elevation-2d";
import { hardwareTally, kitchenBom, kitchenCuttingList, type KComponent, type KitchenAssembly } from "./kitchen-assembly";

const FRONTS = new Set(["door", "lift-door", "drawer-front"]);
const layerOf = (c: KComponent): Layer =>
  FRONTS.has(c.role) ? "DOOR" : c.role === "shelf" ? "SHELF" : "CARCASS";

function frontMarks(c: KComponent, p: Prim[]) {
  const b = c.box;
  p.push({ kind: "text", layer: "TEXT", x: b.x + b.w / 2 - 30, y: b.y + b.h / 2, text: c.id, size: 28 });
  const m = c.mechanism;
  if (m?.kind === "swing") {
    const hx = c.hingeSide === "left" ? b.x : b.x + b.w, fx = c.hingeSide === "left" ? b.x + b.w : b.x;
    p.push({ kind: "line", layer: "DOOR", x1: hx, y1: b.y + b.h, x2: fx, y2: b.y + b.h / 2, dashed: true });
    p.push({ kind: "line", layer: "DOOR", x1: fx, y1: b.y + b.h / 2, x2: hx, y2: b.y, dashed: true });
    for (const y of [b.y + 100, b.y + b.h - 100])
      p.push({ kind: "rect", layer: "HARDWARE", x: hx + (c.hingeSide === "left" ? 15 : -50), y: y - 12, w: 35, h: 24 });
  } else if (m?.kind === "lift-up") {
    p.push({ kind: "line", layer: "DOOR", x1: b.x, y1: b.y, x2: b.x + b.w / 2, y2: b.y + b.h, dashed: true });
    p.push({ kind: "line", layer: "DOOR", x1: b.x + b.w / 2, y1: b.y + b.h, x2: b.x + b.w, y2: b.y, dashed: true });
  } else if (m?.kind === "drawer") {
    p.push({ kind: "line", layer: "HARDWARE", x1: b.x + b.w / 2 - 60, y1: b.y + b.h - 40, x2: b.x + b.w / 2 + 60, y2: b.y + b.h - 40 });
  }
}

export function kitchenFront(asm: KitchenAssembly, opts: { fronts?: boolean } = {}): View {
  const showFronts = opts.fronts ?? true;
  const p: Prim[] = [];
  for (const c of asm.components) {
    if (c.role === "back" || c.role.startsWith("drawer-") && c.role !== "drawer-front") continue;
    if (FRONTS.has(c.role) && !showFronts) continue;
    if (!FRONTS.has(c.role) && showFronts && !["side", "top", "bottom", "plinth", "filler"].includes(c.role)) continue;
    p.push({ kind: "rect", layer: layerOf(c), id: c.id, x: c.box.x, y: c.box.y, w: c.box.w, h: c.box.h });
    if (FRONTS.has(c.role)) frontMarks(c, p);
  }
  for (const r of asm.blueprint.runs) {
    let x = 0;
    const yDim = r.id === "UPPER" ? r.elevation + r.height : 0;
    const off = r.id === "UPPER" ? 90 : -90;
    for (const m of r.modules) {
      p.push({ kind: "dim", layer: "DIMS", x1: x, y1: yDim, x2: x + m.width, y2: yDim, offset: off, value: m.width });
      p.push({ kind: "text", layer: "TEXT", x: x + 10, y: yDim + off * 1.9, text: `${m.id}${r.moduleWidthStatus === "verified" ? "" : " (PROV)"}`, size: 22 });
      x += m.width;
    }
    p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: yDim, x2: r.width, y2: yDim, offset: off * 2.6, value: r.width });
    p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: r.elevation, x2: 0, y2: r.elevation + r.height, offset: -120, value: r.height });
  }
  p.push({ kind: "dim", layer: "DIMS", x1: 2418, y1: 0, x2: 2418, y2: 850, offset: 160, value: 850 });
  p.push({ kind: "dim", layer: "DIMS", x1: 2418, y1: 0, x2: 2418, y2: 1500, offset: 300, value: 1500 });
  return { name: showFronts ? "TAMPAK DEPAN" : "TAMPAK DEPAN — TANPA PINTU (KARKAS)", width: 2418, height: 2300, prims: p };
}

/** Vertical section at plane x = xCut, viewed from the right: drawing x = z (depth), y = y. */
export function kitchenSection(asm: KitchenAssembly, xCut: number, name: string): View {
  const p: Prim[] = [];
  for (const c of asm.components) {
    const b = c.box;
    if (xCut < b.x || xCut > b.x + b.w) continue;
    p.push({ kind: "rect", layer: layerOf(c), id: c.id, x: b.z, y: b.y, w: b.d, h: b.h });
  }
  for (const r of asm.blueprint.runs)
    p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: r.elevation, x2: r.depth, y2: r.elevation, offset: -60, value: r.depth });
  p.push({ kind: "text", layer: "TEXT", x: 0, y: -160, text: `potongan x=${xCut} mm`, size: 24 });
  return { name, width: 650, height: 2300, prims: p };
}

/** Top view: drawing x = x, drawing y = z (wall at 0, front up). Upper run dashed-like via separate layer. */
export function kitchenTop(asm: KitchenAssembly): View {
  const p: Prim[] = [];
  for (const c of asm.components) {
    if (c.runId !== "LOWER" || !["side", "top", "door", "drawer-front", "plinth", "divider"].includes(c.role)) continue;
    p.push({ kind: "rect", layer: layerOf(c), id: c.id, x: c.box.x, y: c.box.z, w: c.box.w, h: c.box.d });
  }
  for (const c of asm.components) if (c.runId === "UPPER" && c.role === "side") {
    const b = c.box; p.push({ kind: "line", layer: "SHELF", x1: b.x, y1: 0, x2: b.x, y2: b.d, dashed: true });
  }
  p.push({ kind: "line", layer: "SHELF", x1: 0, y1: 350, x2: 2400, y2: 350, dashed: true });
  p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: 0, x2: 2400, y2: 0, offset: -80, value: 2400 });
  p.push({ kind: "dim", layer: "DIMS", x1: 2400, y1: 0, x2: 2400, y2: 600, offset: 80, value: 600 });
  p.push({ kind: "text", layer: "TEXT", x: 0, y: 700, text: "garis putus = kabinet atas (350)", size: 22 });
  return { name: "TAMPAK ATAS", width: 2400, height: 700, prims: p };
}

/** Exploded front: every carcass module separated by `gap`; fronts lifted forward-up. */
export function kitchenExploded(asm: KitchenAssembly, gap = 200): View {
  const p: Prim[] = [];
  const order = new Map<string, number>();
  for (const r of asm.blueprint.runs) r.modules.forEach((m, i) => order.set(m.id, i));
  for (const c of asm.components) {
    if (c.role === "back" || (c.role.startsWith("drawer-") && c.role !== "drawer-front")) continue;
    const dx = c.moduleId ? (order.get(c.moduleId) ?? 0) * gap : c.role === "filler" ? 3 * gap + 120 : 0;
    const dy = FRONTS.has(c.role) ? 0 : 0;
    const shiftFront = FRONTS.has(c.role) ? 2800 : 0; // fronts drawn in a separate row to the right
    p.push({ kind: "rect", layer: layerOf(c), id: c.id, x: c.box.x + dx + shiftFront, y: c.box.y + dy, w: c.box.w, h: c.box.h });
    if (FRONTS.has(c.role)) p.push({ kind: "text", layer: "TEXT", x: c.box.x + dx + shiftFront + 10, y: c.box.y + c.box.h / 2, text: c.id, size: 26 });
    else if (c.role === "side" && c.id.endsWith("-SL")) p.push({ kind: "text", layer: "TEXT", x: c.box.x + dx + 20, y: c.box.y + c.box.h + 40, text: c.moduleId!, size: 26 });
    else if (c.role === "plinth") p.push({ kind: "text", layer: "TEXT", x: c.box.x + 20, y: -60, text: `${c.id} (komponen terpisah)`, size: 22 });
  }
  p.push({ kind: "text", layer: "TEXT", x: 0, y: 2420, text: "KARKAS (dipisah per modul)", size: 30 });
  p.push({ kind: "text", layer: "TEXT", x: 2800, y: 2420, text: "DAUN / FRONT", size: 30 });
  return { name: "EXPLODED VIEW", width: 2800 + 3000, height: 2500, prims: p };
}

export function kitchenViews(asm: KitchenAssembly) {
  return {
    front: kitchenFront(asm),
    carcass: kitchenFront(asm, { fronts: false }),
    sectionDrawer: kitchenSection(asm, 850, "POTONGAN A-A (kolom laci LC2 / UC2)"),
    sectionSink: kitchenSection(asm, 1450, "POTONGAN B-B (LC3 / UC3)"),
    top: kitchenTop(asm),
    exploded: kitchenExploded(asm),
  };
}

// ---------------------------------------------------------------------------
// PDF — A3 landscape, true scale 1:20 (1 mm paper = 20 mm real)
// ---------------------------------------------------------------------------
export const KITCHEN_PDF_SCALE = 20;

export function kitchenPdf(asm: KitchenAssembly, date = "2026-11-03"): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const v = kitchenViews(asm);
  const hw = hardwareTally(asm);
  const draw = (view: View, ox: number, oy: number, scale = KITCHEN_PDF_SCALE) => {
    const s = 1 / scale;
    const X = (x: number) => ox + x * s, Y = (y: number) => oy - y * s;
    doc.setFontSize(9); doc.setTextColor(0, 0, 0);
    doc.text(`${view.name}  (1:${scale})`, ox, oy - view.height * s - 6);
    for (const p of view.prims) {
      doc.setLineDashPattern([], 0);
      if (p.kind === "rect") {
        doc.setLineWidth(p.layer === "DOOR" ? 0.25 : 0.18);
        p.layer === "DOOR" ? doc.setDrawColor(30, 70, 160) : p.layer === "HARDWARE" ? doc.setDrawColor(200, 120, 0) : doc.setDrawColor(0, 0, 0);
        doc.rect(X(p.x), Y(p.y + p.h), p.w * s, p.h * s);
      } else if (p.kind === "line") {
        doc.setLineWidth(0.12); doc.setDrawColor(90, 90, 90);
        if (p.dashed) doc.setLineDashPattern([1.5, 1], 0);
        doc.line(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2));
      } else if (p.kind === "text") {
        doc.setFontSize(Math.max(4, p.size * s * 2.6)); doc.text(p.text, X(p.x), Y(p.y));
      } else {
        const d = dimGeom(p);
        doc.setLineWidth(0.1); doc.setDrawColor(192, 57, 43);
        doc.line(X(d.ax), Y(d.ay), X(d.bx), Y(d.by));
        doc.line(X(p.x1), Y(p.y1), X(d.ax), Y(d.ay));
        doc.line(X(p.x2), Y(p.y2), X(d.bx), Y(d.by));
        doc.setTextColor(192, 57, 43); doc.setFontSize(5.5);
        doc.text(String(p.value), X(d.tx), Y(d.ty) - 0.6, { align: "center" });
        doc.setTextColor(0, 0, 0);
      }
    }
    doc.setDrawColor(0, 0, 0);
  };
  const frame = (title: string) => {
    doc.setLineWidth(0.5); doc.rect(5, 5, 410, 287);
    doc.rect(290, 247, 125, 45);
    doc.setFontSize(8);
    [
      "KERJAKU Interior Studio — Gambar Kerja",
      `Proyek: ${asm.blueprint.name} (${asm.blueprint.projectId})`,
      `Lembar: ${title}`,
      `Skala: 1:${KITCHEN_PDF_SCALE} @ A3   Tanggal: ${date}`,
      `Hardware: engsel ${hw.hingeLabel}, rel ${hw.railSets} set, gas spring ${hw.gasSpringPcs} pcs`,
    ].forEach((l, i) => doc.text(l, 293, 254 + i * 6));
    doc.setTextColor(192, 57, 43);
    doc.text(asm.productionReady ? "VERIFIED — SIAP PRODUKSI" : "PROVISIONAL — BUKAN UKURAN PRODUKSI", 293, 288);
    doc.setTextColor(0, 0, 0);
    // scale bar 0–1000 mm
    doc.setLineWidth(0.4); doc.line(20, 285, 20 + 1000 / KITCHEN_PDF_SCALE, 285);
    doc.setFontSize(6); doc.text("0", 20, 289); doc.text("1000 mm", 20 + 1000 / KITCHEN_PDF_SCALE - 6, 289);
  };
  frame("1/4 Tampak depan & karkas");
  draw(v.front, 30, 150);
  draw(v.carcass, 200, 150);
  draw(v.top, 30, 275 - 10);
  doc.addPage("a3", "landscape"); frame("2/4 Potongan & tampak atas");
  draw(v.sectionDrawer, 40, 150); draw(v.sectionSink, 120, 150);
  draw(v.top, 200, 120);
  doc.addPage("a3", "landscape"); frame("3/4 Exploded view");
  draw(v.exploded, 20, 170, 25);
  doc.addPage("a3", "landscape"); frame("4/4 Cutting list & BOM");
  doc.setFontSize(10); doc.text("Cutting List (PROVISIONAL)", 15, 15);
  doc.setFontSize(5.6);
  const rows = kitchenCuttingList(asm);
  const cols = ["ID", "Peran", "Modul", "P", "L", "T", "Qty"]; const xs = [0, 22, 44, 58, 70, 82, 90];
  const perCol = 40;
  rows.forEach((r, k) => {
    const block = Math.floor(k / perCol), row = k % perCol;
    const bx = 15 + block * 100, y = 26 + row * 5.3;
    if (row === 0) cols.forEach((c, i) => doc.text(c, bx + xs[i]!, 21));
    [r.id, r.role, r.module, r.length, r.width, r.thickness, r.qty].forEach((val, i) => doc.text(String(val), bx + xs[i]!, y));
  });
  const bom = kitchenBom(asm);
  doc.setFontSize(9); doc.text("BOM panel & hardware", 15, 250);
  doc.setFontSize(6.5);
  bom.panels.forEach((b, i) => doc.text(`${b.material}: ${b.areaM2} m² → ${b.qty} ${b.unit}`, 15, 256 + i * 4.5));
  bom.hardware.forEach((h, i) => doc.text(`${h.item}: ${h.qty} ${h.note ? "— " + h.note : ""}`, 130, 256 + i * 4.5));
  return doc;
}
