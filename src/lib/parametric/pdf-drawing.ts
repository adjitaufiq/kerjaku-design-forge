import { jsPDF } from "jspdf";
import { cuttingList, hingeTally } from "./cabinet-engine";
import { dimGeom, frontElevation, sideSection, topView, type View } from "./elevation-2d";
import type { CompiledCabinet } from "./types";

export const PDF_SCALE = 10; // 1:10 → 1 mm on paper = 10 mm real

/** A3 landscape working drawing at true 1:10 scale. */
export function workingDrawingPdf(cab: CompiledCabinet, date = "2026-11-03"): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const s = 1 / PDF_SCALE;
  const PH = 297;
  const draw = (v: View, ox: number, oy: number) => {
    // ox, oy = paper mm of the view origin (bottom-left); paper y is down.
    const X = (x: number) => ox + x * s;
    const Y = (y: number) => oy - y * s;
    doc.setFontSize(10);
    doc.text(v.name, ox, oy - v.height * s - 12);
    for (const p of v.prims) {
      doc.setLineDashPattern([], 0);
      if (p.kind === "rect") { doc.setLineWidth(0.3); doc.rect(X(p.x), Y(p.y + p.h), p.w * s, p.h * s); }
      else if (p.kind === "line") { doc.setLineWidth(0.2); if (p.dashed) doc.setLineDashPattern([2, 1.5], 0); doc.line(X(p.x1), Y(p.y1), X(p.x2), Y(p.y2)); }
      else if (p.kind === "text") { doc.setFontSize(6); doc.text(p.text, X(p.x), Y(p.y)); }
      else {
        const d = dimGeom(p);
        doc.setLineWidth(0.15);
        doc.setDrawColor(192, 57, 43);
        doc.line(X(d.ax), Y(d.ay), X(d.bx), Y(d.by));
        doc.line(X(p.x1), Y(p.y1), X(d.ax), Y(d.ay));
        doc.line(X(p.x2), Y(p.y2), X(d.bx), Y(d.by));
        doc.setTextColor(192, 57, 43); doc.setFontSize(7);
        doc.text(String(p.value), X(d.tx), Y(d.ty), { align: "center" });
        doc.setTextColor(0, 0, 0); doc.setDrawColor(0, 0, 0);
      }
    }
  };
  draw(frontElevation(cab), 30, 120);
  draw(sideSection(cab), 175, 120);
  draw(topView(cab), 30, 250);
  draw(frontElevation(cab, false), 255, 120);

  // scale bar 0–500 mm
  doc.setLineWidth(0.4); doc.line(175, 250, 175 + 500 * s, 250);
  doc.setFontSize(7); doc.text("0", 175, 255); doc.text("500 mm (skala 1:10)", 175 + 500 * s, 255);

  // Title block
  doc.setLineWidth(0.5); doc.rect(5, 5, 410, PH - 10);
  doc.rect(290, 232, 125, 60);
  doc.setFontSize(9);
  const tb = [
    `KERJAKU Interior Studio — Gambar Kerja`,
    `Proyek: ${cab.spec.name} (${cab.spec.id})`,
    `Ukuran: ${cab.spec.width} x ${cab.spec.height} x ${cab.spec.depth} mm`,
    `Skala: 1:${PDF_SCALE} @ A3   Tanggal: ${date}`,
    `Engsel: ${hingeTally(cab).label}`,
    `Status: ${cab.productionReady ? "VERIFIED — SIAP PRODUKSI" : "PROVISIONAL — BUKAN UNTUK PRODUKSI"}`,
  ];
  tb.forEach((l, i) => doc.text(l, 293, 240 + i * 8));

  // Cutting list page
  doc.addPage("a3", "landscape");
  doc.setFontSize(12); doc.text(`Cutting List — ${cab.spec.id}`, 20, 20);
  doc.setFontSize(8);
  const cols = ["ID", "Peran", "Material", "P (mm)", "L (mm)", "T (mm)", "Qty", "Status"];
  const xs = [20, 90, 115, 190, 215, 240, 262, 278];
  cols.forEach((c, i) => doc.text(c, xs[i], 32));
  cuttingList(cab).forEach((r, k) => {
    const y = 40 + k * 7;
    [r.id, r.role, r.material, r.length, r.width, r.thickness, r.qty, r.status].forEach((v, i) => doc.text(String(v), xs[i], y));
  });
  if (!cab.productionReady) { doc.setTextColor(192, 57, 43); doc.text("PROVISIONAL: dimensi belum diverifikasi workshop.", 20, 280); }
  return doc;
}
