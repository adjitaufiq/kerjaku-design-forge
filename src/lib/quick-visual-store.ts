/** Browser-only persistence for the Quick Visual session (IndexedDB — photos are too big for localStorage). */
import type { SpecHints } from "@/lib/interior-spec";

export interface VisualOption {
  id: string;
  name: string;
  image: string; // data URL
  before?: string; // client photo this visual was made from
  spec: string; // short description of design / finish
  createdAt: number;
  interiorImage?: string | undefined;
  specHints?: SpecHints;
}

export interface QuickSession {
  roomImage: string | null;
  options: VisualOption[];
  activeId: string | null;
  saved: boolean;
}

const DB = "kerjaku-quick-visual";
const STORE = "kv";
const KEY = "session";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadSession(): Promise<QuickSession | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve((req.result as QuickSession) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveSession(session: QuickSession): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(session, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* storage unavailable — session stays in memory */
  }
}

export interface WatermarkPrefs {
  enabled: boolean;
  showLogo: boolean;
  showName: boolean;
  x: number; // 0-100 % centre
  y: number;
  size: number; // % of image width
  opacity: number; // 0.1-1
  font: string; // CSS font-family stack
  color: string; // hex
  logoScale?: number; // % relative to size
  textScale?: number; // % relative to size
}

export const WATERMARK_FONTS: { label: string; family: string; weight: number }[] = [
  { label: "Modern Sans", family: "system-ui, sans-serif", weight: 600 },
  { label: "Classic Serif", family: "Georgia, 'Times New Roman', serif", weight: 600 },
  { label: "Elegant", family: "'Playfair Display', Georgia, serif", weight: 500 },
  { label: "Bold Display", family: "Impact, 'Arial Black', sans-serif", weight: 400 },
  { label: "Geometric", family: "'Montserrat', 'Century Gothic', sans-serif", weight: 700 },
  { label: "Slab", family: "'Roboto Slab', 'Rockwell', serif", weight: 700 },
  { label: "Condensed", family: "'Oswald', 'Arial Narrow', sans-serif", weight: 600 },
  { label: "Signature", family: "'Great Vibes', 'Brush Script MT', cursive", weight: 400 },
  { label: "Script", family: "'Dancing Script', 'Segoe Script', cursive", weight: 700 },
  { label: "Monospace", family: "'Courier New', monospace", weight: 700 },
  { label: "Minimal Light", family: "'Helvetica Neue', Arial, sans-serif", weight: 300 },
];

export const WATERMARK_COLORS = [
  "#ffffff",
  "#000000",
  "#d4af37",
  "#f5e6c8",
  "#9ca3af",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
];

export function fontWeightOf(family: string) {
  return WATERMARK_FONTS.find((f) => f.family === family)?.weight ?? 600;
}

export const DEFAULT_WATERMARK: WatermarkPrefs = {
  enabled: true,
  showLogo: true,
  showName: true,
  x: 82,
  y: 92,
  size: 22,
  opacity: 0.7,
  font: "system-ui, sans-serif",
  color: "#ffffff",
};

const WM_KEY = "kerjaku-watermark";

export function loadWatermark(): WatermarkPrefs {
  try {
    const raw = localStorage.getItem(WM_KEY);
    return raw
      ? { ...DEFAULT_WATERMARK, ...(JSON.parse(raw) as WatermarkPrefs) }
      : DEFAULT_WATERMARK;
  } catch {
    return DEFAULT_WATERMARK;
  }
}

export function saveWatermark(p: WatermarkPrefs) {
  try {
    localStorage.setItem(WM_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

function loadImg(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image"));
    img.src = src;
  });
}

/** Draw image + optional watermark onto a canvas and return a PNG blob. */
export async function renderWithWatermark(
  image: string,
  prefs: WatermarkPrefs,
  brand: { name: string | null; logo: string | null },
): Promise<Blob> {
  if (prefs.enabled && prefs.showName) await document.fonts?.ready;
  const base = await loadImg(image);
  const canvas = document.createElement("canvas");
  canvas.width = base.naturalWidth;
  canvas.height = base.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(base, 0, 0);

  if (prefs.enabled) {
    const name = prefs.showName ? brand.name?.trim() || null : null;
    let logo: HTMLImageElement | null = null;
    if (prefs.showLogo && brand.logo) {
      try {
        logo = await loadImg(brand.logo, true);
      } catch {
        logo = null;
      }
    }
    if (name || logo) {
      const W = canvas.width;
      const boxW = (prefs.size / 100) * W;
      const logoK = (prefs.logoScale ?? 100) / 100;
      const textK = (prefs.textScale ?? 100) / 100;
      const logoH = logo ? boxW * 0.45 * logoK : 0;
      const fontPx = Math.max(8, boxW * 0.12 * textK);
      const lines = name ? name.split(/\r?\n/) : [];
      const lineH = fontPx * 1.2;
      const gap = logo && name ? fontPx * 0.4 : 0;
      const totalH = logoH + gap + lines.length * lineH;
      const cx = (prefs.x / 100) * W;
      const cy = (prefs.y / 100) * canvas.height;
      let top = Math.min(Math.max(cy - totalH / 2, 0), canvas.height - totalH);
      ctx.globalAlpha = prefs.opacity;
      if (logo) {
        const lw = Math.min(boxW * logoK, (logo.naturalWidth / logo.naturalHeight) * logoH);
        ctx.drawImage(logo, cx - lw / 2, top, lw, logoH);
        top += logoH + gap;
      }
      if (name) {
        ctx.font = `${fontWeightOf(prefs.font)} ${fontPx}px ${prefs.font}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = fontPx * 0.3;
        ctx.fillStyle = prefs.color;
        lines.forEach((l, i) => ctx.fillText(l, cx, top + i * lineH));
      }
      ctx.globalAlpha = 1;
    }
  }

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export"))), "image/png");
    } catch {
      reject(new Error("Logo tidak bisa dipakai (link diblokir). Matikan logo atau ganti link."));
    }
  });
}

/** Saved client sessions — reopen from the Quick Visual list without regenerating. */
export interface SavedSession {
  id: string;
  clientName: string;
  location: string;
  roomId: string;
  leadId: string | null;
  savedAt: number;
  session: QuickSession;
}

const HISTORY_KEY = "history";

export async function loadHistory(): Promise<SavedSession[]> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(HISTORY_KEY);
      req.onsuccess = () => resolve((req.result as SavedSession[]) ?? []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function putHistory(entry: SavedSession): Promise<SavedSession[]> {
  const list = [entry, ...(await loadHistory()).filter((h) => h.id !== entry.id)].slice(0, 30);
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(list, HISTORY_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
  return list;
}

/** Read a logo file, optionally removing a solid background, and return a compact PNG data URL. */
export async function processLogo(file: File, removeBg: boolean, max = 512): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bitmap.width * scale));
  c.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, c.width, c.height);
  if (removeBg) {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    // Background colour = average of the four corners.
    const corners = [0, c.width - 1, (c.height - 1) * c.width, c.height * c.width - 1];
    const bg = [0, 1, 2].map((k) => corners.reduce((a, i) => a + d[i * 4 + k]!, 0) / 4);
    for (let i = 0; i < d.length; i += 4) {
      const dist = Math.hypot(d[i]! - bg[0]!, d[i + 1]! - bg[1]!, d[i + 2]! - bg[2]!);
      if (dist < 40) d[i + 3] = 0;
      else if (dist < 80) d[i + 3] = Math.round((d[i + 3]! * (dist - 40)) / 40);
    }
    ctx.putImageData(img, 0, 0);
  }
  return c.toDataURL("image/png");
}

/** Generic key/value helpers on the same IndexedDB store. */
export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise((resolve) => {
      const req = db.transaction(STORE).objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function kvPut(key: string, value: unknown): Promise<void> {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
