/** Browser-only persistence for the Quick Visual session (IndexedDB — photos are too big for localStorage). */

export interface VisualOption {
  id: string;
  name: string;
  image: string; // data URL
  spec: string; // short description of design / finish
  createdAt: number;
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
}

export const DEFAULT_WATERMARK: WatermarkPrefs = {
  enabled: true,
  showLogo: true,
  showName: true,
  x: 82,
  y: 92,
  size: 22,
  opacity: 0.7,
};

const WM_KEY = "kerjaku-watermark";

export function loadWatermark(): WatermarkPrefs {
  try {
    const raw = localStorage.getItem(WM_KEY);
    return raw ? { ...DEFAULT_WATERMARK, ...(JSON.parse(raw) as WatermarkPrefs) } : DEFAULT_WATERMARK;
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
      const logoH = logo ? boxW * 0.45 : 0;
      const fontPx = Math.max(12, boxW * 0.12);
      const gap = logo && name ? fontPx * 0.4 : 0;
      const totalH = logoH + gap + (name ? fontPx * 1.2 : 0);
      const cx = (prefs.x / 100) * W;
      const cy = (prefs.y / 100) * canvas.height;
      let top = Math.min(Math.max(cy - totalH / 2, 0), canvas.height - totalH);
      ctx.globalAlpha = prefs.opacity;
      if (logo) {
        const lw = Math.min(boxW, (logo.naturalWidth / logo.naturalHeight) * logoH);
        ctx.drawImage(logo, cx - lw / 2, top, lw, logoH);
        top += logoH + gap;
      }
      if (name) {
        ctx.font = `600 ${fontPx}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = fontPx * 0.3;
        ctx.fillStyle = "#ffffff";
        ctx.fillText(name, cx, top);
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
