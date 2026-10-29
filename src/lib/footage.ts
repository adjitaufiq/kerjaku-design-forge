// Client-side 2D camera "takes" for B-roll footage (0 AI credit).
import { pickVideoMime } from "@/lib/quick-visual-export";

export const FOOTAGE_MODES = [
  { id: "push", label: "Push-in", emoji: "🔍" },
  { id: "pull", label: "Pull-out", emoji: "🔭" },
  { id: "slide", label: "Slider kiri→kanan", emoji: "➡️" },
  { id: "slideback", label: "Slider kanan→kiri", emoji: "⬅️" },
  { id: "tilt", label: "Tilt naik", emoji: "⬆️" },
  { id: "tiltdown", label: "Tilt turun", emoji: "⬇️" },
  { id: "orbit", label: "Orbit", emoji: "🌀" },
  { id: "drone", label: "Drone turun", emoji: "🚁" },
  { id: "uturn", label: "Letter U", emoji: "🧲" },
  { id: "custom", label: "Custom mix", emoji: "🎛️" },
] as const;
export type FootageMode = (typeof FOOTAGE_MODES)[number]["id"];

export type FootageMix = {
  pan: "none" | "lr" | "rl";
  tilt: "none" | "up" | "down";
  zoom: "none" | "in" | "out";
  walk: boolean;
  roll: boolean;
};
export const DEFAULT_MIX: FootageMix = {
  pan: "lr",
  tilt: "none",
  zoom: "in",
  walk: true,
  roll: false,
};

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Camera at progress t (0..1): scale >= 1, offsets in [-1,1] of available slack, rotation rad. */
function camera(mode: FootageMode, t: number, mix: FootageMix = DEFAULT_MIX) {
  const e = ease(t);
  switch (mode) {
    case "push":
      return { s: lerp(1.0, 1.3, e), x: 0, y: 0, r: 0 };
    case "pull":
      return { s: lerp(1.35, 1.0, e), x: 0, y: lerp(-0.2, 0, e), r: 0 };
    case "slide":
      return { s: 1.22, x: lerp(-1, 1, e), y: 0, r: 0 };
    case "slideback":
      return { s: 1.22, x: lerp(1, -1, e), y: 0, r: 0 };
    case "tilt":
      return { s: 1.22, x: 0, y: lerp(1, -1, e), r: 0 };
    case "tiltdown":
      return { s: 1.22, x: 0, y: lerp(-1, 1, e), r: 0 };
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
    case "uturn": {
      // curve: left far -> close center -> right far
      const k = Math.sin(Math.PI * e);
      return {
        s: 1.18 + 0.2 * k,
        x: lerp(-1, 1, e) * (1 - 0.25 * k),
        y: -0.15 * k,
        r: lerp(0.025, -0.025, e),
      };
    }
    case "custom": {
      const zs =
        mix.zoom === "in" ? lerp(1.12, 1.38, e) : mix.zoom === "out" ? lerp(1.38, 1.12, e) : 1.24;
      let x = mix.pan === "lr" ? lerp(-0.85, 0.85, e) : mix.pan === "rl" ? lerp(0.85, -0.85, e) : 0;
      let y =
        mix.tilt === "up" ? lerp(0.85, -0.85, e) : mix.tilt === "down" ? lerp(-0.85, 0.85, e) : 0;
      let r = mix.roll ? Math.sin(e * Math.PI * 2) * 0.012 : 0;
      if (mix.walk) {
        // ~1.6 steps per second feel, normalized to progress
        const steps = 10;
        y += Math.abs(Math.sin(t * Math.PI * steps)) * -0.12 + 0.06;
        x += Math.sin(t * Math.PI * steps * 0.5) * 0.06;
        r += Math.sin(t * Math.PI * steps * 0.5) * 0.006;
      }
      return { s: zs, x, y, r };
    }
  }
}

/** Output frame for CapCut / TikTok. */
export const FRAME_W = 720;
export const FRAME_H = 1280;

export function drawTake(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  mode: FootageMode,
  t: number,
  mix?: FootageMix,
  zoom = 1.3,
) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const cam = camera(mode, Math.min(1, Math.max(0, t)), mix);
  // Keep the camera on the rendered object (center), never drift to floor / ceiling.
  const x = Math.max(-0.7, Math.min(0.7, cam.x * 0.75));
  const y = Math.max(-0.45, Math.min(0.35, cam.y * 0.45 - 0.05));
  const r = cam.r;
  const s = cam.s * zoom;
  const base = Math.max(W / img.width, H / img.height) * s * (r ? 1.06 : 1);
  const dw = img.width * base;
  const dh = img.height * base;
  const slackX = (dw - W) / 2;
  const slackY = (dh - H) / 2;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(r);
  ctx.drawImage(img, -dw / 2 - x * slackX, -dh / 2 - y * slackY, dw, dh);
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

/** Encode a take frame-by-frame into a standard MP4 (faststart) readable by CapCut/gallery. */
async function encodeMp4(
  src: string,
  mode: FootageMode,
  seconds: number,
  mix: FootageMix | undefined,
  zoom: number,
): Promise<Blob | null> {
  if (typeof VideoEncoder === "undefined" || typeof VideoFrame === "undefined") return null;
  const configs = ["avc1.640028", "avc1.4D0028", "avc1.42E028", "avc1.42001f"];
  let codec: string | null = null;
  for (const c of configs) {
    try {
      const s = await VideoEncoder.isConfigSupported({
        codec: c,
        width: FRAME_W,
        height: FRAME_H,
        bitrate: 8_000_000,
        framerate: 30,
      });
      if (s.supported) {
        codec = c;
        break;
      }
    } catch {
      /* try next */
    }
  }
  if (!codec) return null;
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const img = await loadImg(src);
  const c = document.createElement("canvas");
  c.width = FRAME_W;
  c.height = FRAME_H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: "avc", width: FRAME_W, height: FRAME_H, frameRate: 30 },
    fastStart: "in-memory",
  });
  let err: unknown = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => (err = e),
  });
  enc.configure({ codec, width: FRAME_W, height: FRAME_H, bitrate: 8_000_000, framerate: 30 });
  const fps = 30;
  const total = Math.round(seconds * fps);
  for (let i = 0; i < total; i++) {
    drawTake(ctx, img, mode, i / (total - 1), mix, zoom);
    const frame = new VideoFrame(c, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
    enc.encode(frame, { keyFrame: i % 30 === 0 });
    frame.close();
    if (enc.encodeQueueSize > 10) await new Promise((r) => setTimeout(r, 0));
    if (err) throw err;
  }
  await enc.flush();
  enc.close();
  if (err) throw err;
  muxer.finalize();
  return new Blob([target.buffer], { type: "video/mp4" });
}

/** Record one take to a silent video file. */
export async function recordTake(
  src: string,
  mode: FootageMode,
  seconds: number,
  mix?: FootageMix,
  zoom = 1.3,
): Promise<{ blob: Blob; ext: string }> {
  try {
    const mp4 = await encodeMp4(src, mode, seconds, mix, zoom);
    if (mp4) return { blob: mp4, ext: "mp4" };
  } catch (e) {
    console.warn("MP4 encoder failed, fallback to recorder", e);
  }
  const mime = pickVideoMime();
  if (!mime) throw new Error("Browser tidak mendukung rekam video");
  const img = await loadImg(src);
  const c = document.createElement("canvas");
  c.width = FRAME_W;
  c.height = FRAME_H;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  drawTake(ctx, img, mode, 0, mix, zoom);
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
      drawTake(ctx, img, mode, t, mix, zoom);
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
