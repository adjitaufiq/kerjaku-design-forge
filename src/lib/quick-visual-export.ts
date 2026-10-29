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

/** ~7s cinematic slow push-in (1.0x → 1.18x) on the render, watermark fixed on top. */
export async function renderCinematic(
  after: string,
  prefs: WatermarkPrefs,
  brand: Brand,
): Promise<{ blob: Blob; ext: string }> {
  const mime = pickVideoMime();
  if (!mime) throw new Error("Browser ini belum mendukung pembuatan video");
  const a = await loadImg(after);
  const k = Math.min(1, 1280 / Math.max(a.naturalWidth, a.naturalHeight));
  const W = Math.round((a.naturalWidth * k) / 2) * 2;
  const H = Math.round((a.naturalHeight * k) / 2) * 2;
  // Transparent overlay holding only the watermark.
  const blank = document.createElement("canvas");
  blank.width = a.naturalWidth;
  blank.height = a.naturalHeight;
  const overlay = await blobToImg(
    await renderWithWatermark(blank.toDataURL("image/png"), prefs, brand),
  );

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const TOTAL = 7000;
  const draw = (t: number) => {
    const p = ease(Math.min(1, t / TOTAL));
    const s = 1 + 0.18 * p;
    const dw = W * s;
    const dh = H * s;
    ctx.drawImage(a, (W - dw) / 2, (H - dh) / 2 - H * 0.02 * p, dw, dh);
    ctx.drawImage(overlay, 0, 0, W, H);
  };
  draw(0);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 5_000_000 });
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

// ---------------- Auto-Director cinematic story ----------------

/** Camera keyframe: scale, offset (fraction of frame), roll (deg). */
type Cam = { s: number; x: number; y: number; r: number };
type Shot = { name: string; a: Cam; b: Cam; c: Cam };

/** Pro videographer shot library (3 keyframes each → two-phase movement). */
const SHOTS = {
  droneDescent: {
    name: "Drone descent",
    a: { s: 1.32, x: 0, y: 0.09, r: 0 },
    b: { s: 1.18, x: 0, y: 0.0, r: 0 },
    c: { s: 1.26, x: 0, y: -0.015, r: 0 },
  },
  closeupSlide: {
    name: "Close-up slider",
    a: { s: 1.45, x: 0.07, y: 0.03, r: 0 },
    b: { s: 1.38, x: 0.0, y: 0.03, r: 0 },
    c: { s: 1.3, x: -0.06, y: 0.02, r: 0 },
  },
  orbitGlide: {
    name: "Parallax orbit",
    a: { s: 1.24, x: -0.06, y: 0, r: -1.1 },
    b: { s: 1.2, x: 0.0, y: -0.01, r: 0 },
    c: { s: 1.24, x: 0.06, y: 0, r: 1.1 },
  },
  pedestalUp: {
    name: "Pedestal up",
    a: { s: 1.3, x: 0, y: -0.08, r: 0 },
    b: { s: 1.22, x: 0.01, y: 0, r: 0 },
    c: { s: 1.18, x: 0, y: 0.04, r: 0 },
  },
  heroPullOut: {
    name: "Hero pull-out",
    a: { s: 1.42, x: 0, y: 0.01, r: 0 },
    b: { s: 1.12, x: 0, y: 0, r: 0 },
    c: { s: 1.04, x: 0, y: 0, r: 0 },
  },
} satisfies Record<string, Shot>;

/**
 * Auto-recommended storyboard. Always ≥2 takes: a single photo is re-shot with a
 * different angle (drone → orbit) so it never looks like one static zoom.
 */
function directorPlan(n: number): { shot: Shot; img: number }[] {
  const S = SHOTS;
  if (n <= 1)
    return [
      { shot: S.droneDescent, img: 0 },
      { shot: S.orbitGlide, img: 0 },
      { shot: S.heroPullOut, img: 0 },
    ];
  const order: Shot[] = [S.droneDescent, S.closeupSlide, S.orbitGlide, S.pedestalUp];
  const list = Array.from({ length: n }, (_, i) => ({
    shot: i === n - 1 ? S.heroPullOut : order[i % order.length]!,
    img: i,
  }));
  return list;
}

const smooth = (t: number) => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
function camAt(shot: Shot, t: number): Cam {
  // Smooth two-phase curve: continuous velocity through middle keyframe.
  const tt = smooth(Math.min(1, Math.max(0, t)));
  const u = tt < 0.5 ? tt * 2 : (tt - 0.5) * 2;
  const p = tt < 0.5 ? shot.a : shot.b;
  const q = tt < 0.5 ? shot.b : shot.c;
  const k = tt < 0.5 ? 1 - Math.pow(1 - u, 2) * 0.5 - 0.5 * (1 - u) : u; // gentle ease
  const kk = Math.min(1, Math.max(0, tt < 0.5 ? k : 1 - Math.pow(1 - u, 1.6)));
  return { s: mix(p.s, q.s, kk), x: mix(p.x, q.x, kk), y: mix(p.y, q.y, kk), r: mix(p.r, q.r, kk) };
}

export { BACKSOUNDS, type Backsound } from "@/lib/backsound";
import { scheduleBacksound, scheduleCustom, type Backsound } from "@/lib/backsound";

/**
 * Multi-photo cinematic story video (1–5 renders), Auto-Director camera moves,
 * momentum transitions and optional synthesized backsound. Records in real time.
 */
export async function renderCinematicStory(
  images: string[],
  seconds: number,
  prefs: WatermarkPrefs,
  brand: Brand,
  onProgress?: (p: number) => void,
  music: Backsound = "luxury-piano",
  musicFile: Blob | null = null,
): Promise<{ blob: Blob; ext: string }> {
  const mime = pickVideoMime();
  if (!mime) throw new Error("Browser ini belum mendukung pembuatan video");
  if (!images.length) throw new Error("Belum ada foto render");
  const imgs = await Promise.all(images.map(loadImg));
  const f = imgs[0]!;
  const k = Math.min(1, 1080 / Math.max(f.naturalWidth, f.naturalHeight));
  const W = Math.round((f.naturalWidth * k) / 2) * 2;
  const H = Math.round((f.naturalHeight * k) / 2) * 2;
  const blank = document.createElement("canvas");
  blank.width = f.naturalWidth;
  blank.height = f.naturalHeight;
  const overlay = await blobToImg(
    await renderWithWatermark(blank.toDataURL("image/png"), prefs, brand),
  );
  // Pre-scale every photo to a cached canvas (cover W×H) → light per-frame work, no stutter.
  const frames = imgs.map((img) => {
    const pc = document.createElement("canvas");
    pc.width = W;
    pc.height = H;
    const pctx = pc.getContext("2d")!;
    pctx.imageSmoothingQuality = "high";
    drawCover(pctx, img, 0, 0, W, H);
    return pc;
  });

  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const TOTAL = seconds * 1000;
  const plan = directorPlan(frames.length);
  const n = plan.length;
  const TR = Math.min(1400, TOTAL / n / 3); // momentum transition length
  const seg = (TOTAL + TR * (n - 1)) / n;

  const drawShot = (i: number, local: number, alpha: number, push: number) => {
    const cam = camAt(plan[i]!.shot, local / seg);
    // safe margins: never reveal frame edges while panning/rolling
    const need = 1 + 2 * Math.max(Math.abs(cam.x), Math.abs(cam.y)) + Math.abs(cam.r) * 0.035;
    const s = Math.max(cam.s, need) * (1 + push);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(W / 2 + cam.x * W, H / 2 + cam.y * H);
    ctx.rotate((cam.r * Math.PI) / 180);
    ctx.scale(s, s);
    ctx.drawImage(frames[plan[i]!.img]!, -W / 2, -H / 2, W, H);
    ctx.restore();
  };

  const draw = (t: number) => {
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < n; i++) {
      const start = i * (seg - TR);
      const local = t - start;
      if (local < 0 || local > seg) continue;
      let alpha = 1;
      let push = 0;
      if (i > 0 && local < TR) {
        // incoming: settles from a slight zoom-through into its own move
        const p = smooth(local / TR);
        alpha = p;
        push = (1 - p) * 0.08;
      }
      if (i < n - 1 && local > seg - TR) {
        // outgoing: keeps momentum forward (zoom-through) as it hands off
        const p = smooth((local - (seg - TR)) / TR);
        push = p * 0.1;
      }
      drawShot(i, local, alpha, push);
    }
    // cinematic vignette
    const g = ctx.createRadialGradient(
      W / 2,
      H / 2,
      Math.min(W, H) * 0.35,
      W / 2,
      H / 2,
      Math.max(W, H) * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.globalAlpha = 1;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // fade in / out
    const edge = t < 600 ? 1 - t / 600 : TOTAL - t < 1000 ? 1 - Math.max(0, TOTAL - t) / 1000 : 0;
    if (edge > 0) {
      ctx.globalAlpha = edge;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, W, H);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(overlay, 0, 0, W, H);
  };

  draw(0);
  const stream = c.captureStream(30);
  let ac: AudioContext | null = null;
  if (music !== "none" && typeof AudioContext !== "undefined") {
    ac = new AudioContext();
    await ac.resume().catch(() => {});
    const dest = ac.createMediaStreamDestination();
    if (music === "custom") {
      if (musicFile) await scheduleCustom(ac, dest, musicFile, seconds).catch(() => {});
    } else scheduleBacksound(ac, dest, music, seconds);
    dest.stream.getAudioTracks().forEach((tr) => stream.addTrack(tr));
  }
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(500);
  const start = performance.now();
  await new Promise<void>((resolve) => {
    const tick = () => {
      const t = performance.now() - start;
      draw(Math.min(t, TOTAL));
      onProgress?.(Math.min(1, t / TOTAL));
      if (t >= TOTAL) return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  stream.getTracks().forEach((tr) => tr.stop());
  await done;
  void ac?.close();
  const type = mime.split(";")[0] ?? "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type === "video/mp4" ? "mp4" : "webm" };
}
