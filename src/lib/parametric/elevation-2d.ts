import type { CompiledCabinet } from "./types";

/** 2D primitives in mm, drawing-space y-up. Shared by SVG, DXF and PDF. */
export type Prim =
  | { kind: "rect"; layer: Layer; id?: string; x: number; y: number; w: number; h: number }
  | { kind: "line"; layer: Layer; x1: number; y1: number; x2: number; y2: number; dashed?: boolean }
  | { kind: "text"; layer: Layer; x: number; y: number; text: string; size: number }
  | { kind: "dim"; layer: "DIMS"; x1: number; y1: number; x2: number; y2: number; offset: number; value: number };

export type Layer = "CARCASS" | "SHELF" | "DOOR" | "HARDWARE" | "DIMS" | "TEXT";

export interface View {
  name: string;
  width: number;
  height: number;
  prims: Prim[];
}

export function frontElevation(cab: CompiledCabinet, showDoors = true): View {
  const { width: W, height: H } = cab.spec;
  const p: Prim[] = [];
  for (const c of cab.components) {
    if (c.role === "back") continue;
    if (c.role === "door") {
      if (!showDoors) continue;
      const b = c.box;
      p.push({ kind: "rect", layer: "DOOR", id: c.id, ...rect(b.x, b.y, b.w, b.h) });
      // opening triangle: apex on handle side, base on hinge side (standard convention)
      const hx = c.hingeSide === "left" ? b.x : b.x + b.w;
      const fx = c.hingeSide === "left" ? b.x + b.w : b.x;
      p.push({ kind: "line", layer: "DOOR", x1: hx, y1: b.y + b.h, x2: fx, y2: b.y + b.h / 2, dashed: true });
      p.push({ kind: "line", layer: "DOOR", x1: fx, y1: b.y + b.h / 2, x2: hx, y2: b.y, dashed: true });
      for (const y of c.hardware?.[0]?.positionsY ?? [])
        p.push({ kind: "rect", layer: "HARDWARE", x: hx + (c.hingeSide === "left" ? 20 : -55), y: y - 10, w: 35, h: 20 });
      p.push({ kind: "text", layer: "TEXT", x: b.x + b.w / 2 - 40, y: b.y + b.h / 2 + 30, text: c.id, size: 18 });
    } else if (!showDoors || c.role === "side" || c.role === "top" || c.role === "bottom") {
      const b = c.box;
      p.push({ kind: "rect", layer: c.role === "shelf" ? "SHELF" : "CARCASS", id: c.id, ...rect(b.x, b.y, b.w, b.h) });
    }
  }
  p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: 0, x2: W, y2: 0, offset: -80, value: W });
  p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: 0, x2: 0, y2: H, offset: -80, value: H });
  return { name: showDoors ? "TAMPAK DEPAN" : "TAMPAK DEPAN (PINTU DILEPAS)", width: W, height: H, prims: p };
}

/** Section through the first column, viewed from the left: x = depth (front at right). */
export function sideSection(cab: CompiledCabinet): View {
  const { depth: D, height: H } = cab.spec;
  const p: Prim[] = [];
  for (const c of cab.components) {
    const b = c.box;
    if (c.role === "side" && c.id.endsWith("SIDE-L")) p.push({ kind: "rect", layer: "CARCASS", id: c.id, ...rect(0, 0, D, H) });
    if (c.role === "top" || c.role === "bottom") p.push({ kind: "rect", layer: "CARCASS", id: c.id, ...rect(b.z, b.y, b.d, b.h) });
    if (c.role === "back") p.push({ kind: "rect", layer: "CARCASS", id: c.id, ...rect(b.z, b.y, b.d, b.h) });
    if (c.role === "shelf" && c.column === 1) p.push({ kind: "rect", layer: "SHELF", id: c.id, ...rect(b.z, b.y, b.d, b.h) });
    if (c.role === "door" && c.column === 1) p.push({ kind: "rect", layer: "DOOR", id: c.id, ...rect(b.z, b.y, b.d, b.h) });
  }
  const t = cab.spec.construction.panelThickness;
  p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: 0, x2: D, y2: 0, offset: -80, value: D });
  p.push({ kind: "dim", layer: "DIMS", x1: D + t, y1: 0, x2: D + t, y2: H, offset: 80, value: H });
  for (const s of cab.components.filter((c) => c.role === "shelf" && c.column === 1))
    p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: 0, x2: 0, y2: s.box.y + s.box.h, offset: -40, value: s.box.y + s.box.h });
  return { name: "POTONGAN SAMPING A-A", width: D + t, height: H, prims: p };
}

/** Top view: x = width, y = depth (front at bottom → y = 0 is front). */
export function topView(cab: CompiledCabinet): View {
  const { width: W, depth: D } = cab.spec;
  const t = cab.spec.construction.panelThickness;
  const p: Prim[] = [];
  const fy = (z: number, d: number) => D - (z + d) + t; // flip so front at bottom, doors below
  for (const c of cab.components) {
    const b = c.box;
    if (["side", "divider", "back", "door"].includes(c.role))
      p.push({ kind: "rect", layer: c.role === "door" ? "DOOR" : "CARCASS", id: c.id, ...rect(b.x, fy(b.z, b.d), b.w, b.d) });
    if (c.role === "door") {
      const hx = c.hingeSide === "left" ? b.x : b.x + b.w;
      const y0 = fy(b.z, b.d);
      const a = (Math.PI / 180) * 90;
      const ex = hx + (c.hingeSide === "left" ? 1 : -1) * b.w * Math.cos(a);
      p.push({ kind: "line", layer: "DOOR", x1: hx, y1: y0, x2: ex, y2: y0 - b.w * Math.sin(a), dashed: true });
    }
  }
  p.push({ kind: "dim", layer: "DIMS", x1: 0, y1: D + t, x2: W, y2: D + t, offset: 60, value: W });
  p.push({ kind: "dim", layer: "DIMS", x1: W, y1: t, x2: W, y2: D + t, offset: 60, value: D });
  return { name: "TAMPAK ATAS", width: W, height: D + t, prims: p };
}

function rect(x: number, y: number, w: number, h: number) {
  return { x, y, w, h };
}

export function viewToSvg(v: View, margin = 140): string {
  const W = v.width + margin * 2;
  const H = v.height + margin * 2;
  const Y = (y: number) => H - margin - y;
  const X = (x: number) => x + margin;
  const color: Record<Layer, string> = { CARCASS: "#222", SHELF: "#555", DOOR: "#1f5fa8", HARDWARE: "#b5651d", DIMS: "#c0392b", TEXT: "#222" };
  const parts: string[] = [];
  for (const p of v.prims) {
    if (p.kind === "rect")
      parts.push(`<rect data-id="${p.id ?? ""}" x="${X(p.x)}" y="${Y(p.y + p.h)}" width="${p.w}" height="${p.h}" fill="none" stroke="${color[p.layer]}" stroke-width="2"/>`);
    else if (p.kind === "line")
      parts.push(`<line x1="${X(p.x1)}" y1="${Y(p.y1)}" x2="${X(p.x2)}" y2="${Y(p.y2)}" stroke="${color[p.layer]}" stroke-width="1.5"${p.dashed ? ' stroke-dasharray="12 8"' : ""}/>`);
    else if (p.kind === "text")
      parts.push(`<text x="${X(p.x)}" y="${Y(p.y)}" font-size="${p.size}" font-family="monospace">${p.text}</text>`);
    else {
      const d = dimGeom(p);
      parts.push(`<line x1="${X(d.ax)}" y1="${Y(d.ay)}" x2="${X(d.bx)}" y2="${Y(d.by)}" stroke="${color.DIMS}" stroke-width="1.5"/>`);
      parts.push(`<text x="${X(d.tx)}" y="${Y(d.ty)}" font-size="22" fill="${color.DIMS}" font-family="monospace" text-anchor="middle">${p.value}</text>`);
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><rect width="100%" height="100%" fill="#fff"/><text x="${margin}" y="50" font-size="32" font-family="monospace">${v.name}</text>${parts.join("")}</svg>`;
}

export function dimGeom(p: Extract<Prim, { kind: "dim" }>) {
  const horiz = p.y1 === p.y2;
  if (horiz) {
    const y = p.y1 + p.offset;
    return { ax: p.x1, ay: y, bx: p.x2, by: y, tx: (p.x1 + p.x2) / 2, ty: y + 10, horiz };
  }
  const x = p.x1 + p.offset;
  return { ax: x, ay: p.y1, bx: x, by: p.y2, tx: x - 10, ty: (p.y1 + p.y2) / 2, horiz };
}
