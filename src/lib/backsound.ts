/**
 * Built-in backsound library — studio-style music synthesized live in the browser
 * (royalty-free, no download, 0 credits). Also supports a user-uploaded audio file.
 */

export type BacksoundId =
  | "none"
  | "custom"
  | "luxury-piano"
  | "grand-lobby"
  | "golden-hour"
  | "lofi-cafe"
  | "acoustic-warm"
  | "sunday-home"
  | "reels-chill"
  | "deep-house"
  | "tiktok-pop"
  | "arch-atmos"
  | "epic-reveal"
  | "minimal-tech";

export type Backsound = BacksoundId;

type Preset = {
  id: BacksoundId;
  label: string;
  group: string;
  bpm: number;
  root: number; // midi
  prog: number[][]; // chord degrees as semitone offsets from root
  piano?: "arp" | "chords" | "melody";
  pluck?: boolean;
  pad?: number; // volume
  bass?: boolean;
  kick?: "four" | "half" | "boom";
  snare?: boolean;
  hat?: "8" | "16";
  vinyl?: boolean;
  bright?: number; // lowpass Hz
  reverb?: number; // wet 0..1
};

const MAJ = [0, 4, 7, 11];
const MIN = [0, 3, 7, 10];
const ch = (o: number, q: number[]) => q.map((x) => x + o);
// I–V–vi–IV, vi–IV–I–V, ii–V–I–vi, etc.
const POP = [ch(0, MAJ), ch(7, MAJ), ch(9, MIN), ch(5, MAJ)];
const EMO = [ch(9, MIN), ch(5, MAJ), ch(0, MAJ), ch(7, MAJ)];
const JAZZ = [ch(2, MIN), ch(7, [0, 4, 7, 10]), ch(0, MAJ), ch(9, MIN)];
const DREAM = [ch(0, MAJ), ch(5, MAJ), ch(9, MIN), ch(4, MIN)];
const DARK = [ch(0, MIN), ch(8, MAJ), ch(3, MAJ), ch(10, MAJ)];

export const PRESETS: Preset[] = [
  { id: "luxury-piano", label: "Luxury Piano", group: "🏛️ Luxury Interior", bpm: 72, root: 60, prog: DREAM, piano: "arp", pad: 0.05, bass: true, bright: 3200, reverb: 0.5 },
  { id: "grand-lobby", label: "Grand Lobby", group: "🏛️ Luxury Interior", bpm: 64, root: 57, prog: EMO, piano: "chords", pad: 0.07, bass: true, bright: 2400, reverb: 0.6 },
  { id: "golden-hour", label: "Golden Hour", group: "🏛️ Luxury Interior", bpm: 80, root: 62, prog: POP, piano: "melody", pad: 0.05, bass: true, kick: "half", bright: 3600, reverb: 0.45 },
  { id: "lofi-cafe", label: "Lo-fi Cafe", group: "☕ Acoustic & Cafe", bpm: 82, root: 60, prog: JAZZ, piano: "chords", bass: true, kick: "half", snare: true, hat: "8", vinyl: true, bright: 2000, reverb: 0.3 },
  { id: "acoustic-warm", label: "Acoustic Warm", group: "☕ Acoustic & Cafe", bpm: 96, root: 55, prog: POP, pluck: true, pad: 0.03, bass: true, bright: 4200, reverb: 0.3 },
  { id: "sunday-home", label: "Sunday Home", group: "☕ Acoustic & Cafe", bpm: 88, root: 64, prog: DREAM, pluck: true, piano: "melody", bass: true, hat: "8", bright: 3800, reverb: 0.35 },
  { id: "reels-chill", label: "Reels Chill", group: "⚡ Modern Reels", bpm: 100, root: 57, prog: EMO, piano: "arp", pad: 0.05, bass: true, kick: "four", snare: true, hat: "8", bright: 4000, reverb: 0.3 },
  { id: "deep-house", label: "Deep House", group: "⚡ Modern Reels", bpm: 118, root: 53, prog: JAZZ, piano: "chords", pad: 0.04, bass: true, kick: "four", hat: "16", snare: true, bright: 2800, reverb: 0.25 },
  { id: "tiktok-pop", label: "TikTok Pop", group: "⚡ Modern Reels", bpm: 112, root: 60, prog: POP, pluck: true, piano: "melody", bass: true, kick: "four", snare: true, hat: "16", bright: 5200, reverb: 0.25 },
  { id: "arch-atmos", label: "Architectural Atmos", group: "🏢 Cinematic", bpm: 60, root: 50, prog: DREAM, pad: 0.09, piano: "melody", bass: true, bright: 1800, reverb: 0.75 },
  { id: "epic-reveal", label: "Epic Reveal", group: "🏢 Cinematic", bpm: 70, root: 48, prog: DARK, pad: 0.08, piano: "chords", bass: true, kick: "boom", bright: 2600, reverb: 0.6 },
  { id: "minimal-tech", label: "Minimal Tech", group: "🏢 Cinematic", bpm: 108, root: 57, prog: EMO, pluck: true, pad: 0.04, bass: true, kick: "four", hat: "16", bright: 3000, reverb: 0.4 },
];

export const BACKSOUNDS: { id: BacksoundId; label: string; group: string }[] = [
  ...PRESETS.map((p) => ({ id: p.id, label: p.label, group: p.group })),
  { id: "custom", label: "Upload musik sendiri", group: "📁 Lainnya" },
  { id: "none", label: "Tanpa musik", group: "📁 Lainnya" },
];

const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function impulse(ac: BaseAudioContext, sec: number, decay: number) {
  const len = Math.floor(ac.sampleRate * sec);
  const buf = ac.createBuffer(2, len, ac.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function noiseBuf(ac: BaseAudioContext) {
  const len = ac.sampleRate;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

/** Master bus with fade-in, ending fade-out (smart ducking at the branding outro). */
function masterBus(ac: BaseAudioContext, out: AudioNode, t0: number, sec: number, vol = 0.8) {
  const g = ac.createGain();
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + Math.min(1.5, sec * 0.15));
  g.gain.setValueAtTime(vol, Math.max(t0 + 1.6, t0 + sec - 2));
  g.gain.linearRampToValueAtTime(0, t0 + sec);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  g.connect(comp);
  comp.connect(out);
  return g;
}

export function scheduleBacksound(
  ac: BaseAudioContext,
  out: AudioNode,
  id: BacksoundId,
  sec: number,
) {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  const t0 = ac.currentTime + 0.05;
  const master = masterBus(ac, out, t0, sec);
  const tone = ac.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = p.bright ?? 3000;
  tone.Q.value = 0.4;
  const dry = ac.createGain();
  dry.gain.value = 1;
  const rv = ac.createConvolver();
  rv.buffer = impulse(ac, 2.8, 2.6);
  const wet = ac.createGain();
  wet.gain.value = p.reverb ?? 0.35;
  tone.connect(dry).connect(master);
  tone.connect(rv).connect(wet).connect(master);
  const drums = ac.createGain();
  drums.gain.value = 0.9;
  drums.connect(master);
  const noise = noiseBuf(ac);

  const beat = 60 / p.bpm;
  const bar = beat * 4;

  const piano = (m: number, at: number, vol: number, len = 2.2) => {
    // additive "electric grand": fundamental + soft harmonics, hammer-like decay
    [1, 2, 3, 4].forEach((h, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = "sine";
      o.frequency.value = hz(m) * h;
      o.detune.value = (Math.random() - 0.5) * 4;
      const v = vol * [1, 0.45, 0.18, 0.08][i]!;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(v, at + 0.008);
      g.gain.exponentialRampToValueAtTime(v * 0.35, at + 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(g).connect(tone);
      o.start(at);
      o.stop(at + len + 0.05);
    });
  };
  const pluck = (m: number, at: number, vol: number) => {
    // Karplus-ish: bright triangle + fast filter sweep
    const o = ac.createOscillator();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    o.type = "sawtooth";
    o.frequency.value = hz(m);
    f.type = "lowpass";
    f.frequency.setValueAtTime(4500, at);
    f.frequency.exponentialRampToValueAtTime(500, at + 0.4);
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    o.connect(f).connect(g).connect(tone);
    o.start(at);
    o.stop(at + 1);
  };
  const pad = (m: number, at: number, dur: number, vol: number) => {
    for (const d of [-9, 9]) {
      const o = ac.createOscillator();
      const f = ac.createBiquadFilter();
      const g = ac.createGain();
      o.type = "sawtooth";
      o.frequency.value = hz(m);
      o.detune.value = d;
      f.type = "lowpass";
      f.frequency.value = 900;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(vol / 2, at + dur * 0.4);
      g.gain.linearRampToValueAtTime(0, at + dur + 0.4);
      o.connect(f).connect(g).connect(tone);
      o.start(at);
      o.stop(at + dur + 0.5);
    }
  };
  const bass = (m: number, at: number, dur: number) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = "triangle";
    o.frequency.value = hz(m);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.22, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.05, at + dur * 0.9);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(g).connect(master);
    o.start(at);
    o.stop(at + dur + 0.05);
  };
  const kick = (at: number, boom = false) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.frequency.setValueAtTime(boom ? 90 : 140, at);
    o.frequency.exponentialRampToValueAtTime(boom ? 28 : 42, at + (boom ? 0.9 : 0.22));
    g.gain.setValueAtTime(boom ? 0.9 : 0.7, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + (boom ? 1.4 : 0.3));
    o.connect(g).connect(drums);
    o.start(at);
    o.stop(at + 1.5);
  };
  const hit = (at: number, freq: number, dur: number, vol: number, type: BiquadFilterType) => {
    const s = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    s.buffer = noise;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(vol, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(drums);
    s.start(at, Math.random() * 0.5);
    s.stop(at + dur + 0.02);
  };

  if (p.vinyl) {
    const s = ac.createBufferSource();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    s.buffer = noise;
    s.loop = true;
    f.type = "bandpass";
    f.frequency.value = 3500;
    g.gain.value = 0.012;
    s.connect(f).connect(g).connect(master);
    s.start(t0);
    s.stop(t0 + sec);
  }

  const melodyRhythm = [0, 1.5, 2, 3, 3.5];
  for (let b = 0, at = t0; at < t0 + sec; b++, at += bar) {
    const c = p.prog[b % p.prog.length]!.map((x) => x + p.root);
    // intro: first bar lighter — drums enter on bar 2 (build-up feel)
    const full = b > 0;
    if (p.pad) for (const m of c.slice(0, 3)) pad(m, at, bar, p.pad);
    if (p.bass) {
      bass(c[0]! - 24, at, beat * 2);
      bass(c[0]! - 24, at + beat * 2, beat * 1.5);
      if (full) bass(c[2]! - 24, at + beat * 3.5, beat * 0.5);
    }
    if (p.piano === "arp") {
      const seq = [c[0]!, c[1]!, c[2]!, c[3]! ?? c[0]! + 12, c[2]! + 12, c[1]! + 12, c[2]!, c[1]!];
      seq.forEach((m, i) => piano(m, at + i * (beat / 2), 0.06));
    } else if (p.piano === "chords") {
      for (const m of c) piano(m, at, 0.045, bar);
      for (const m of c) piano(m, at + beat * 2.5, 0.03, beat * 1.5);
    } else if (p.piano === "melody") {
      for (const m of c.slice(0, 3)) piano(m - 12, at, 0.035, bar);
      melodyRhythm.forEach((r, i) => {
        const note = c[(b + i) % c.length]! + 12;
        piano(note, at + r * beat, 0.055, 1.4);
      });
    }
    if (p.pluck) {
      const pat = [0, 2, 1, 2, 0, 2, 1, 3];
      pat.forEach((ix, i) => pluck((c[ix] ?? c[0]!) + 12, at + i * (beat / 2), 0.05));
    }
    if (full || !p.pad) {
      for (let q = 0; q < 4; q++) {
        const t = at + q * beat;
        if (p.kick === "four") kick(t);
        if (p.kick === "half" && (q === 0 || q === 2)) kick(t);
        if (p.snare && (q === 1 || q === 3)) hit(t, 1800, 0.18, 0.28, "bandpass");
        if (p.hat === "8") {
          hit(t + beat / 2, 8000, 0.05, 0.12, "highpass");
        }
        if (p.hat === "16") {
          for (let s = 0; s < 4; s++)
            hit(t + (s * beat) / 4, 9000, 0.03, s % 2 ? 0.06 : 0.1, "highpass");
        }
      }
    }
    if (p.kick === "boom" && b % 2 === 0) kick(at, true);
  }
}

/** Uploaded file → decoded buffer played (looped) with smart fades. */
export async function scheduleCustom(
  ac: BaseAudioContext,
  out: AudioNode,
  file: Blob,
  sec: number,
) {
  const buf = await ac.decodeAudioData(await file.arrayBuffer());
  const t0 = ac.currentTime + 0.05;
  const master = masterBus(ac, out, t0, sec, 0.9);
  const s = ac.createBufferSource();
  s.buffer = buf;
  s.loop = buf.duration < sec;
  s.connect(master);
  s.start(t0);
  s.stop(t0 + sec + 0.05);
}

/** Play a short preview through the speakers. Returns a stop function. */
export async function previewBacksound(
  id: BacksoundId,
  file: Blob | null,
  sec = 10,
): Promise<() => void> {
  const ac = new AudioContext();
  await ac.resume().catch(() => {});
  if (id === "custom" && file) await scheduleCustom(ac, ac.destination, file, sec);
  else scheduleBacksound(ac, ac.destination, id, sec);
  const tm = setTimeout(() => void ac.close(), (sec + 0.5) * 1000);
  return () => {
    clearTimeout(tm);
    void ac.close();
  };
}
