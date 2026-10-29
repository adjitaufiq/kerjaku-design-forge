import { createFileRoute } from "@tanstack/react-router";
import { Download, ImagePlus, Lock, LockOpen, Share2, Trash2, Wand2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { PageHeader } from "@/components/kerjaku/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { render3d } from "@/lib/render-3d.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/render-3d")({
  head: () => ({
    meta: [
      { title: "3D Render AI — KERJAKU" },
      {
        name: "description",
        content: "Ubah gambar SketchUp jadi render foto realistis dengan bentuk dan warna terkunci.",
      },
    ],
  }),
  component: Render3dPage,
});

const OBJECTS = [
  { id: "booth", label: "Booth / Kiosk" },
  { id: "kitchen", label: "Kitchen set" },
  { id: "wardrobe", label: "Lemari" },
  { id: "backdrop", label: "Backdrop TV" },
  { id: "counter", label: "Meja resepsionis" },
  { id: "furniture", label: "Furnitur lain" },
] as const;

const LOCATIONS = [
  { id: "mall", label: "Mall Atrium", text: "di dalam atrium mall mewah yang ramai, lantai marmer mengkilap" },
  { id: "ruko", label: "Ruko", text: "di dalam ruko/shophouse modern dengan kaca depan" },
  { id: "cafe", label: "Cafe", text: "di dalam cafe modern yang hangat dan estetik" },
  { id: "indoor", label: "Indoor", text: "di dalam ruangan indoor modern yang bersih dan terang" },
  { id: "outdoor", label: "Outdoor", text: "di area outdoor/taman dengan cahaya natural" },
  { id: "rumah", label: "Rumah", text: "di dalam rumah tinggal modern yang nyaman" },
  { id: "kantor", label: "Kantor", text: "di dalam kantor modern yang profesional" },
  { id: "sekolah", label: "Sekolah", text: "di dalam area sekolah/kampus yang bersih" },
] as const;

const OBJECT_DEFAULT_LOC: Record<string, string> = {
  booth: "mall",
  kitchen: "rumah",
  wardrobe: "rumah",
  backdrop: "rumah",
  counter: "kantor",
  furniture: "indoor",
};

const LOC_MARK = /Lokasi: [^.]*\./;

function basePrompt(objectLabel: string, locText: string) {
  return `Objek: ${objectLabel}. Lokasi: ${locText}. Pencahayaan hangat dan realistis, kamera setinggi mata.`;
}

interface Shot {
  id: string;
  sketch: string;
  result?: string;
  busy?: boolean;
}

async function fileToDataUrl(file: File, max = 1536): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Compare({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const [locked, setLocked] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const move = (x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (r) setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={box}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-2xl border border-border bg-surface",
        !locked && "touch-none",
      )}
      onPointerDown={(e) => {
        if (locked) return;
        drag.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => !locked && drag.current && move(e.clientX)}
      onPointerUp={() => (drag.current = false)}
    >
      <img src={after} alt="Render" className="block w-full" draggable={false} />
      <img
        src={before}
        alt="3D"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
      </div>
      <span className="absolute top-3 left-3 rounded-md bg-background/70 px-2 py-1 text-xs">3D</span>
      <button
        type="button"
        aria-label={locked ? "Buka kunci slider" : "Kunci slider"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setLocked((v) => !v)}
        className={cn(
          "absolute top-3 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full border",
          locked ? "border-cta bg-cta text-cta-foreground" : "border-border bg-background/70 text-foreground",
        )}
      >
        {locked ? <Lock className="size-4" /> : <LockOpen className="size-4" />}
      </button>
      <span className="absolute top-3 right-3 rounded-md bg-background/70 px-2 py-1 text-xs">
        Render
      </span>
    </div>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface/60 text-foreground",
      )}
    >
      {children}
    </button>
  );
}

async function dataUrlToFile(src: string, name: string) {
  const blob = await (await fetch(src)).blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

function Render3dPage() {
  const run = useServerFn(render3d);
  const [shots, setShots] = useState<Shot[]>([]);
  const [object, setObject] = useState<string | null>(null);
  const [loc, setLoc] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [keepDims, setKeepDims] = useState(false);
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const room = 5 - shots.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.warning("Maksimal 5 gambar");
    const added = await Promise.all(
      list.map(async (f) => ({ id: crypto.randomUUID(), sketch: await fileToDataUrl(f) })),
    );
    setShots((s) => [...s, ...added]);
  };

  const pickObject = (id: string) => {
    setObject(id);
    const label = OBJECTS.find((o) => o.id === id)!.label;
    const l = LOCATIONS.find((x) => x.id === (loc ?? OBJECT_DEFAULT_LOC[id]))!;
    setLoc(l.id);
    setPrompt((p) =>
      p.trim() ? p.replace(/Objek: [^.]*\./, `Objek: ${label}.`) : basePrompt(label, l.text),
    );
  };

  const pickLoc = (id: string) => {
    setLoc(id);
    const l = LOCATIONS.find((x) => x.id === id)!;
    setPrompt((p) => {
      if (!p.trim()) return basePrompt(OBJECTS.find((o) => o.id === object)?.label ?? "furnitur", l.text);
      return LOC_MARK.test(p) ? p.replace(LOC_MARK, `Lokasi: ${l.text}.`) : `${p} Lokasi: ${l.text}.`;
    });
  };

  const renderOne = async (idx: number, anchor: string | null) => {
    setShots((s) => s.map((x, i) => (i === idx ? { ...x, busy: true } : x)));
    try {
      const { image } = await run({
        data: { sketch: shots[idx]!.sketch, anchor, scene: prompt, keepDimensions: keepDims },
      });
      setShots((s) => s.map((x, i) => (i === idx ? { ...x, result: image, busy: false } : x)));
      return image;
    } catch (e) {
      setShots((s) => s.map((x, i) => (i === idx ? { ...x, busy: false } : x)));
      throw e;
    }
  };

  const renderAll = async () => {
    if (!shots.length) { toast.error("Upload gambar 3D dulu"); return; }
    if (!prompt.trim()) { toast.error("Pilih objek atau isi prompt dulu"); return; }
    setRunning(true);
    try {
      const master = await renderOne(0, null);
      setActive(0);
      for (let i = 1; i < shots.length; i++) await renderOne(i, master);
      toast.success(`${shots.length} render selesai`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Render gagal");
    } finally {
      setRunning(false);
    }
  };

  const rerender = async (idx: number) => {
    setRunning(true);
    try {
      await renderOne(idx, idx === 0 ? null : (shots[0]?.result ?? null));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Render gagal");
    } finally {
      setRunning(false);
    }
  };

  const current = shots[active];
  const done = shots.filter((s) => s.result);

  const share = async () => {
    const files = await Promise.all(done.map((s, i) => dataUrlToFile(s.result!, `render-${i + 1}.png`)));
    if (navigator.canShare?.({ files })) {
      await navigator.share({ files, title: "3D Render" }).catch(() => undefined);
    } else {
      files.forEach((f) => {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(f);
        a.download = f.name;
        a.click();
      });
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <PageHeader title="3D Render AI" subtitle="Gambar SketchUp → foto render realistis. Bentuk & warna dikunci." />

      <SectionCard title="1. Upload gambar 3D (1–5)">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {shots.map((s, i) => (
            <div key={s.id} className="relative aspect-square overflow-hidden rounded-xl border border-border">
              <img src={s.result ?? s.sketch} alt={`Foto ${i + 1}`} className="size-full object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-[10px]">
                {i === 0 ? "Foto 1 · Master" : `Foto ${i + 1}`}
              </span>
              <button
                type="button"
                aria-label="Hapus"
                disabled={running}
                onClick={() => setShots((x) => x.filter((y) => y.id !== s.id))}
                className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-background/80"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          {shots.length < 5 && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed border-border bg-surface/40 text-xs text-muted-foreground">
              <div className="flex flex-col items-center gap-1">
                <ImagePlus className="size-5" />
                Tambah
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => {
                  void addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Foto 1 dirender duluan jadi patokan, Foto 2–5 ikut suasana & material yang sama.
        </p>
      </SectionCard>

      {shots.length > 0 && (
        <SectionCard title="2. Prompt render">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Objek</p>
              <div className="flex flex-wrap gap-2">
                {OBJECTS.map((o) => (
                  <Pill key={o.id} active={object === o.id} onClick={() => pickObject(o.id)}>
                    {o.label}
                  </Pill>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Lokasi (ganti otomatis di prompt)</p>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map((l) => (
                  <Pill key={l.id} active={loc === l.id} onClick={() => pickLoc(l.id)}>
                    {l.label}
                  </Pill>
                ))}
              </div>
            </div>
            <Textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Contoh: tambah kasir di booth, tambah antrian, signage offle menyala terang, etalase isi croffle."
            />
            <p className="text-xs text-muted-foreground">
              Tanpa ditulis, AI tidak akan menambah orang/barang. Bentuk, warna & tulisan selalu dikunci.
            </p>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
              <span>
                Pertahankan angka & garis ukuran
                <span className="block text-xs text-muted-foreground">Default mati: render bersih</span>
              </span>
              <Switch checked={keepDims} onCheckedChange={setKeepDims} />
            </label>
            <Button className="w-full" disabled={running} onClick={renderAll}>
              <Wand2 className="size-4" />
              {running ? "Merender…" : `Render semua (${shots.length} foto)`}
            </Button>
          </div>
        </SectionCard>
      )}

      {done.length > 0 && current && (
        <GlassCard className="space-y-3 p-4">
          <div className="flex flex-wrap gap-2">
            {shots.map((s, i) => (
              <Pill key={s.id} active={active === i} onClick={() => setActive(i)}>
                Foto {i + 1}
                {s.busy ? " …" : ""}
              </Pill>
            ))}
          </div>
          {current.result ? (
            <Compare before={current.sketch} after={current.result} />
          ) : (
            <div className="grid aspect-video place-items-center rounded-2xl border border-border text-sm text-muted-foreground">
              {current.busy ? "Sedang dirender…" : "Belum dirender"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={running} onClick={() => rerender(active)}>
              <Wand2 className="size-4" /> Render ulang
            </Button>
            <Button onClick={share}>
              {typeof navigator !== "undefined" && "share" in navigator ? (
                <Share2 className="size-4" />
              ) : (
                <Download className="size-4" />
              )}
              Share ({done.length})
            </Button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
