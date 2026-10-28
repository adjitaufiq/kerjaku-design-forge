import { renderWithWatermark, type WatermarkPrefs } from "@/lib/quick-visual-store";

type Brand = { name: string | null; logo: string | null };

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar gagal dimuat"));
    img.src = src;
  });
}

function blobToImg(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  return loadImg(url).finally(() => setTimeout(() => URL.revokeObjectURL(url), 1000));
}

/** Draw `img` covering a w×h box (center crop). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, unit: number) {
  const fs = Math.max(14, unit * 0.035);
  ctx.font = `700 ${fs}px Montserrat, sans-serif`;
  const pad = fs * 0.5;
  const w = ctx.measureText(text).width + pad * 2;
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x, y, w, fs + pad * 2);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillText(text, x + pad, y + pad);
}

/** Resize `before` to after's dimensions, return as data URL. */
async function fitBefore(before: string, w: number, h: number): Promise<string> {
  const img = await loadImg(before);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  drawCover(c.getContext("2d")!, img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.92);
}

/** One image: full Before + full After (side-by-side if landscape, stacked if portrait). */
export async function renderGrid(
  before: string,
  after: string,
  prefs: WatermarkPrefs,
  brand: Brand,
): Promise<Blob> {
  const a = await loadImg(after);
  const b = await loadImg(before);
  const W = a.naturalWidth;
  const H = a.naturalHeight;
  const landscape = W >= H;
  const gap = Math.round(Math.max(W, H) * 0.01);
  const c = document.createElement("canvas");
  c.width = landscape ? W * 2 + gap : W;
  c.height = landscape ? H : H * 2 + gap;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  drawCover(ctx, b, 0, 0, W, H);
  const ax = landscape ? W + gap : 0;
  const ay = landscape ? 0 : H + gap;
  ctx.drawImage(a, ax, ay, W, H);
  const unit = Math.max(W, H);
  const m = unit * 0.02;
  label(ctx, "SEBELUM", m, m, unit);
  label(ctx, "SESUDAH", ax + m, ay + m, unit);
  return renderWithWatermark(c.toDataURL("image/jpeg", 0.92), prefs, brand);
}

export function pickVideoMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const list = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return list.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** ~8s slow-motion wipe video Before → After, watermark on both frames. */
export async function renderVideo(
  before: string,
  after: string,
  prefs: WatermarkPrefs,
  brand: Brand,
): Promise<{ blob: Blob; ext: string }> {
  const mime = pickVideoMime();
  if (!mime) throw new Error("Browser ini belum mendukung pembuatan video");
  const a0 = await loadImg(after);
  // Even dimensions, capped for small files
  const k = Math.min(1, 1280 / Math.max(a0.naturalWidth, a0.naturalHeight));
  const W = Math.round((a0.naturalWidth * k) / 2) * 2;
  const H = Math.round((a0.naturalHeight * k) / 2) * 2;
  const afterW = await blobToImg(await renderWithWatermark(after, prefs, brand));
  const beforeW = await blobToImg(
    await renderWithWatermark(
      await fitBefore(before, a0.naturalWidth, a0.naturalHeight),
      prefs,
      brand,
    ),
  );

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const unit = Math.max(W, H);
  const m = unit * 0.025;
  const HOLD1 = 1500;
  const WIPE = 5000;
  const HOLD2 = 2000;
  const TOTAL = HOLD1 + WIPE + HOLD2;

  const draw = (t: number) => {
    const p = t < HOLD1 ? 0 : t > HOLD1 + WIPE ? 1 : ease((t - HOLD1) / WIPE);
    const x = p * W;
    ctx.drawImage(beforeW, 0, 0, W, H);
    if (x > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, x, H);
      ctx.clip();
      ctx.drawImage(afterW, 0, 0, W, H);
      ctx.restore();
    }
    if (p > 0 && p < 1) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(x - 2, 0, 4, H);
    }
    label(ctx, p < 0.5 ? "SEBELUM" : "SESUDAH", m, m, unit);
  };

  draw(0);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(250);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - start;
      draw(Math.min(t, TOTAL));
      if (t >= TOTAL) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  await done;
  const type = mime.split(";")[0] ?? "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
}
