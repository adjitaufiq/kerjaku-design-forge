// Client-side 2D camera "takes" for B-roll footage (0 AI credit).
import { pickVideoMime } from "@/lib/quick-visual-export";

export const FOOTAGE_MODES = [
  { id: "push", label: "Push-in", emoji: "🔍" },
  { id: "pull", label: "Pull-out", emoji: "🔭" },
  { id: "slide", label: "Slider kiri→kanan", emoji: "↔️" },
  { id: "tilt", label: "Tilt naik", emoji: "⬆️" },
  { id: "orbit", label: "Orbit", emoji: "🌀" },
  { id: "drone", label: "Drone turun", emoji: "🚁" },
] as const;
export type FootageMode = (typeof FOOTAGE_MODES)[number]["id"];

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera at progress t (0..1): scale >= 1, offsets in [-1,1] of available slack, rotation rad. */
function camera(mode: FootageMode, t: number) {
  const e = ease(t);
  switch (mode) {
    case "push":
      return { s: lerp(1.0, 1.3, e), x: 0, y: 0, r: 0 };
    case "pull":
      return { s: lerp(1.35, 1.0, e), x: 0, y: lerp(-0.2, 0, e), r: 0 };
    case "slide":
      return { s: 1.22, x: lerp(-1, 1, e), y: 0, r: 0 };
    case "tilt":
      return { s: 1.22, x: 0, y: lerp(1, -1, e), r: 0 };
    case "orbit": {
      const a = lerp(-Math.PI / 2, Math.PI / 2, e);
      return { s: 1.28, x: Math.sin(a) * 0.9, y: Math.cos(a) * 0.25, r: lerp(-0.035, 0.035, e) };
    }
    case "drone":
      return {
        s: lerp(1.5, 1.08, e),
        x: lerp(0.15, 0, e),
        y: lerp(-1, 0.2, e),
        r: lerp(0.02, 0, e),
      };
  }
}

export function drawTake(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  mode: FootageMode,
  t: number,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const { s, x, y, r } = camera(mode, Math.min(1, Math.max(0, t)));
  // cover-fit, extra 6% so rotation never shows edges
  const base = Math.max(W / img.width, H / img.height) * s * (r ? 1.06 : 1);
  const dw = img.width * base;
  const dh = img.height * base;
  const slackX = (dw - W) / 2;
  const slackY = (dh - H) / 2;
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(r);
  ctx.drawImage(img, -dw / 2 - x * slackX * 0.9, -dh / 2 - y * slackY * 0.9, dw, dh);
  ctx.restore();
}

export function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
}

/** Record one take to a silent video file. */
export async function recordTake(
  src: string,
  mode: FootageMode,
  seconds: number,
): Promise<{ blob: Blob; ext: string }> {
  const mime = pickVideoMime();
  if (!mime) throw new Error("Browser tidak mendukung rekam video");
  const img = await loadImg(src);
  const c = document.createElement("canvas");
  const maxW = 1080;
  const k = Math.min(1, maxW / img.width);
  c.width = Math.round((img.width * k) / 2) * 2;
  c.height = Math.round((img.height * k) / 2) * 2;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  drawTake(ctx, img, mode, 0);
  const stream = c.captureStream(30);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start(250);
  const t0 = performance.now();
  await new Promise<void>((done) => {
    const tick = () => {
      const t = (performance.now() - t0) / (seconds * 1000);
      drawTake(ctx, img, mode, t);
      if (t >= 1) return done();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  rec.stop();
  await stopped;
  return { blob: new Blob(chunks, { type: mime }), ext: mime.includes("mp4") ? "mp4" : "webm" };
}

export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
