import { dimGeom, type Layer, type View } from "./elevation-2d";

/** Minimal AutoCAD R12 ASCII DXF. Units: millimetres (1 drawing unit = 1 mm, scale 1:1). */
const LAYERS: { name: Layer; color: number; ltype: string }[] = [
  { name: "CARCASS", color: 7, ltype: "CONTINUOUS" },
  { name: "SHELF", color: 8, ltype: "CONTINUOUS" },
  { name: "DOOR", color: 5, ltype: "CONTINUOUS" },
  { name: "HARDWARE", color: 30, ltype: "CONTINUOUS" },
  { name: "DIMS", color: 1, ltype: "CONTINUOUS" },
  { name: "TEXT", color: 7, ltype: "CONTINUOUS" },
];

const f = (n: number) => (Math.round(n * 1000) / 1000).toString();

export function viewsToDxf(views: { view: View; ox: number; oy: number }[]): string {
  const L: string[] = [];
  const g = (code: number, v: string | number) => L.push(String(code), typeof v === "number" ? f(v) : v);
  g(0, "SECTION"); g(2, "HEADER");
  g(9, "$ACADVER"); g(1, "AC1009");
  g(9, "$INSUNITS"); g(70, "4");
  g(9, "$MEASUREMENT"); g(70, "1");
  g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LTYPE"); g(70, "2");
  g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, "0"); g(3, "Solid"); g(72, "65"); g(73, "0"); g(40, 0);
  g(0, "LTYPE"); g(2, "DASHED"); g(70, "0"); g(3, "Dashed"); g(72, "65"); g(73, "2"); g(40, 20); g(49, 12); g(49, -8);
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "LAYER"); g(70, String(LAYERS.length));
  for (const l of LAYERS) { g(0, "LAYER"); g(2, l.name); g(70, "0"); g(62, String(l.color)); g(6, l.ltype); }
  g(0, "ENDTAB");
  g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");
  const line = (layer: string, x1: number, y1: number, x2: number, y2: number, lt?: string) => {
    g(0, "LINE"); g(8, layer); if (lt) g(6, lt);
    g(10, x1); g(20, y1); g(30, 0); g(11, x2); g(21, y2); g(31, 0);
  };
  const text = (layer: string, x: number, y: number, h: number, s: string) => {
    g(0, "TEXT"); g(8, layer); g(10, x); g(20, y); g(30, 0); g(40, h); g(1, s);
  };
  for (const { view, ox, oy } of views) {
    text("TEXT", ox, oy + view.height + 120, 30, view.name);
    for (const p of view.prims) {
      if (p.kind === "rect") {
        const x = ox + p.x, y = oy + p.y;
        line(p.layer, x, y, x + p.w, y); line(p.layer, x + p.w, y, x + p.w, y + p.h);
        line(p.layer, x + p.w, y + p.h, x, y + p.h); line(p.layer, x, y + p.h, x, y);
      } else if (p.kind === "line") line(p.layer, ox + p.x1, oy + p.y1, ox + p.x2, oy + p.y2, p.dashed ? "DASHED" : undefined);
      else if (p.kind === "text") text(p.layer, ox + p.x, oy + p.y, p.size, p.text);
      else {
        const d = dimGeom(p);
        line("DIMS", ox + d.ax, oy + d.ay, ox + d.bx, oy + d.by);
        // extension lines
        line("DIMS", ox + p.x1, oy + p.y1, ox + d.ax, oy + d.ay);
        line("DIMS", ox + p.x2, oy + p.y2, ox + d.bx, oy + d.by);
        text("DIMS", ox + d.tx - 25, oy + d.ty, 22, String(p.value));
      }
    }
  }
  g(0, "ENDSEC");
  g(0, "EOF");
  return L.join("\n") + "\n";
}
