import { createFileRoute } from "@tanstack/react-router";
import { ImagePlus, Lock, LockOpen, Plus, ScanSearch, Share2, Trash2, Wand2 } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { kvGet, kvPut } from "@/lib/quick-visual-store";
import { toast } from "sonner";

import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { PageHeader } from "@/components/kerjaku/page-header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TextField } from "@/components/kerjaku/form-fields";
import { useWorkspace } from "@/hooks/useWorkspace";
import { data } from "@/services/data";
import { WatermarkDialog } from "./quick-visual";
import { useServerFn } from "@tanstack/react-start";
import { render3d, scan3d, type ScanResult } from "@/lib/render-3d.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/render-3d")({
  head: () => ({
    meta: [
      { title: "3D Render AI — KERJAKU" },
      {
        name: "description",
        content:
          "Ubah gambar SketchUp jadi render foto realistis dengan bentuk dan warna terkunci.",
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
  {
    id: "mall",
    label: "Mall Atrium",
    text: "di dalam atrium mall mewah yang ramai, lantai marmer mengkilap",
  },
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
  before?: string;
  busy?: boolean;
}

interface RenderVersion {
  id: string;
  name: string;
  shots: Shot[];
  prompt: string;
  object: string | null;
  loc: string | null;
  ratio: RatioId;
  keepDims: boolean;
}

interface RenderFolder {
  id: string;
  title: string;
  clientName: string;
  location: string;
  leadId: string | null;
  savedAt: number;
  versions: RenderVersion[];
}

const FOLDERS_KEY = "render3d-folders";

const RATIOS = [
  { id: "4:5", label: "4:5 Feed IG", w: 4, h: 5 },
  { id: "9:16", label: "9:16 TikTok", w: 9, h: 16 },
  { id: "16:9", label: "16:9 Landscape", w: 16, h: 9 },
] as const;
type RatioId = (typeof RATIOS)[number]["id"];

/** Letterbox the sketch onto a canvas of the chosen ratio so the AI renders that frame. */
async function frameToRatio(src: string, ratio: RatioId): Promise<string> {
  const r = RATIOS.find((x) => x.id === ratio)!;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const target = r.w / r.h;
  let W = img.width;
  let H = img.height;
  if (W / H > target) H = Math.round(W / target);
  else W = Math.round(H * target);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#d9d9d9";
  ctx.fillRect(0, 0, W, H);
  ctx.drawImage(img, (W - img.width) / 2, (H - img.height) / 2);
  return c.toDataURL("image/jpeg", 0.9);
}

/** Center-crop the sketch to the chosen ratio (no grey bars) for the Before view. */
async function cropToRatio(src: string, ratio: RatioId): Promise<string> {
  const r = RATIOS.find((x) => x.id === ratio)!;
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const target = r.w / r.h;
  let sw = img.width;
  let sh = img.height;
  if (sw / sh > target) sw = Math.round(sh * target);
  else sh = Math.round(sw / target);
  const c = document.createElement("canvas");
  c.width = sw;
  c.height = sh;
  c.getContext("2d")!.drawImage(
    img,
    (img.width - sw) / 2,
    (img.height - sh) / 2,
    sw,
    sh,
    0,
    0,
    sw,
    sh,
  );
  return c.toDataURL("image/jpeg", 0.9);
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
      <span className="absolute top-3 left-3 rounded-md bg-background/70 px-2 py-1 text-xs">
        3D
      </span>
      <button
        type="button"
        aria-label={locked ? "Buka kunci slider" : "Kunci slider"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => setLocked((v) => !v)}
        className={cn(
          "absolute top-3 left-1/2 grid size-9 -translate-x-1/2 place-items-center rounded-full border",
          locked
            ? "border-cta bg-cta text-cta-foreground"
            : "border-border bg-background/70 text-foreground",
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

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-surface/60 text-foreground",
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
  const scanFn = useServerFn(scan3d);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [usedIdeas, setUsedIdeas] = useState<string[]>([]);
  const { workspaceId } = useWorkspace();
  const workshopQuery = useQuery({
    queryKey: ["workshop", workspaceId],
    queryFn: () => data.workspaces.getWorkshop(workspaceId!),
    enabled: !!workspaceId,
  });
  const brand = {
    name: workshopQuery.data?.name?.trim() || null,
    logo: workshopQuery.data?.logo?.trim() || null,
  };
  const [wmOpen, setWmOpen] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [object, setObject] = useState<string | null>(null);
  const [loc, setLoc] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [keepDims, setKeepDims] = useState(false);
  const [ratio, setRatio] = useState<RatioId>("4:5");
  const [active, setActive] = useState(0);
  const [running, setRunning] = useState(false);
  const [folders, setFolders] = useState<RenderFolder[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const folder = folders.find((f) => f.id === folderId) ?? null;
  const objectLabel = OBJECTS.find((o) => o.id === object)?.label ?? "3D Render";
  const hasResult = shots.some((s) => s.result);
  const unsaved = hasResult && !folder;

  useEffect(() => {
    void kvGet<RenderFolder[]>(FOLDERS_KEY).then((f) => f && setFolders(f));
  }, []);

  // Auto-save the open version into its client folder.
  useEffect(() => {
    if (!folderId || !versionId || shots.some((s) => s.busy)) return;
    setFolders((list) => {
      const next = list.map((f) => {
        if (f.id !== folderId) return f;
        const old = f.versions.find((v) => v.id === versionId);
        const v: RenderVersion = {
          id: versionId,
          name: old?.name ?? `${objectLabel} ${f.versions.length + 1}`,
          shots: shots.map(({ busy: _b, ...x }) => x),
          prompt,
          object,
          loc,
          ratio,
          keepDims,
        };
        const versions = old
          ? f.versions.map((x) => (x.id === versionId ? v : x))
          : [...f.versions, v];
        return { ...f, versions, savedAt: Date.now() };
      });
      void kvPut(FOLDERS_KEY, next);
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shots, prompt, object, loc, ratio, keepDims, folderId, versionId]);

  const requireSave = () => {
    toast.error("Simpan profil klien dulu sebelum ganti foto / project");
    setFormOpen(true);
  };

  const openVersion = (f: RenderFolder, v: RenderVersion) => {
    if (unsaved) return requireSave();
    setFolderId(f.id);
    setVersionId(v.id);
    setShots(v.shots);
    setPrompt(v.prompt);
    setObject(v.object);
    setLoc(v.loc);
    setRatio(v.ratio);
    setKeepDims(v.keepDims);
    setScan(null);
    setActive(0);
  };

  const newProject = () => {
    if (unsaved) return requireSave();
    setFolderId(null);
    setVersionId(null);
    setShots([]);
    setPrompt("");
    setObject(null);
    setLoc(null);
    setScan(null);
    setActive(0);
  };

  const onProfileSaved = (p: { name: string; location: string; leadId: string }) => {
    const vid = crypto.randomUUID();
    const f: RenderFolder = {
      id: crypto.randomUUID(),
      title: `${objectLabel} ${p.name}`,
      clientName: p.name,
      location: p.location,
      leadId: p.leadId,
      savedAt: Date.now(),
      versions: [],
    };
    setFolders((l) => [f, ...l].slice(0, 30));
    setFolderId(f.id);
    setVersionId(vid);
    setFormOpen(false);
    toast.success(`Tersimpan: ${f.title} · ${objectLabel} 1`);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    if (unsaved) return requireSave();
    // Changing photos after a render starts a new version (e.g. Backdrop TV 2).
    const base = hasResult ? [] : shots;
    if (hasResult) {
      setVersionId(folder ? crypto.randomUUID() : null);
      setActive(0);
    }
    const room = 5 - base.length;
    const list = Array.from(files).slice(0, room);
    if (files.length > room) toast.warning("Maksimal 5 gambar");
    const added = await Promise.all(
      list.map(async (f) => ({ id: crypto.randomUUID(), sketch: await fileToDataUrl(f) })),
    );
    const wasEmpty = base.length === 0;
    setShots([...base, ...added]);
    if (wasEmpty && added[0]) void doScan(added[0].sketch);
  };

  const doScan = async (sketch: string) => {
    setScanning(true);
    try {
      const r = await scanFn({ data: { sketch } });
      setScan(r);
      setUsedIdeas([]);
      const label = OBJECTS.find((o) => o.id === r.object)!.label;
      const l = LOCATIONS.find((x) => x.id === r.location)!;
      setObject(r.object);
      setLoc(l.id);
      setPrompt(basePrompt(label, l.text));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan gagal");
    } finally {
      setScanning(false);
    }
  };

  const toggleIdea = (idea: string) => {
    const sentence = idea.trim().replace(/\.?$/, ".");
    if (usedIdeas.includes(idea)) {
      setUsedIdeas((u) => u.filter((x) => x !== idea));
      setPrompt((p) => p.replace(` ${sentence}`, "").replace(sentence, "").trim());
    } else {
      setUsedIdeas((u) => [...u, idea]);
      setPrompt((p) => `${p.trim()} ${sentence}`.trim());
    }
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
      if (!p.trim())
        return basePrompt(OBJECTS.find((o) => o.id === object)?.label ?? "furnitur", l.text);
      return LOC_MARK.test(p)
        ? p.replace(LOC_MARK, `Lokasi: ${l.text}.`)
        : `${p} Lokasi: ${l.text}.`;
    });
  };

  const renderOne = async (idx: number, anchor: string | null) => {
    setShots((s) => s.map((x, i) => (i === idx ? { ...x, busy: true } : x)));
    try {
      const framed = await frameToRatio(shots[idx]!.sketch, ratio);
      const { image } = await run({
        data: { sketch: framed, anchor, scene: prompt, keepDimensions: keepDims, ratio },
      });
      const before = await cropToRatio(shots[idx]!.sketch, ratio);
      setShots((s) =>
        s.map((x, i) => (i === idx ? { ...x, result: image, before, busy: false } : x)),
      );
      return image;
    } catch (e) {
      setShots((s) => s.map((x, i) => (i === idx ? { ...x, busy: false } : x)));
      throw e;
    }
  };

  const renderAll = async () => {
    if (!shots.length) {
      toast.error("Upload gambar 3D dulu");
      return;
    }
    if (!prompt.trim()) {
      toast.error("Pilih objek atau isi prompt dulu");
      return;
    }
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

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-24">
      <PageHeader
        title="3D Render AI"
        subtitle="Gambar SketchUp → foto render realistis. Bentuk & warna dikunci."
      />

      <SectionCard title="Folder klien">
        <div className="space-y-2">
          {folders.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Belum ada folder. Simpan profil klien setelah render untuk membuat folder.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {folders.map((f) => (
              <Pill
                key={f.id}
                active={folderId === f.id}
                onClick={() => {
                  const v = f.versions[f.versions.length - 1];
                  if (v) openVersion(f, v);
                }}
              >
                📁 {f.title} · {f.location}
              </Pill>
            ))}
          </div>
          {folder && folder.versions.length > 0 && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-2">
              {folder.versions.map((v) => (
                <Pill key={v.id} active={versionId === v.id} onClick={() => openVersion(folder, v)}>
                  {v.name}
                </Pill>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" onClick={newProject}>
            <Plus className="size-4" /> Project baru
          </Button>
        </div>
      </SectionCard>

      <SectionCard title="1. Upload gambar 3D (1–5)">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {shots.map((s, i) => (
            <div
              key={s.id}
              className="relative aspect-square overflow-hidden rounded-xl border border-border"
            >
              <img
                src={s.result ?? s.sketch}
                alt={`Foto ${i + 1}`}
                className="size-full object-cover"
              />
              <span className="absolute bottom-1 left-1 rounded bg-background/80 px-1.5 text-[10px]">
                {i === 0 ? "Foto 1 · Master" : `Foto ${i + 1}`}
              </span>
              <button
                type="button"
                aria-label="Hapus"
                disabled={running}
                onClick={() =>
                  unsaved ? requireSave() : setShots((x) => x.filter((y) => y.id !== s.id))
                }
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
            <div className="rounded-xl border border-border bg-surface/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <ScanSearch className="size-4 text-primary" />
                  {scanning ? "AI sedang scan gambar 3D..." : "Hasil scan AI"}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={scanning || running}
                  onClick={() => shots[0] && void doScan(shots[0].sketch)}
                >
                  {scan ? "Scan ulang" : "Scan"}
                </Button>
              </div>
              {scan && !scanning && (
                <>
                  {scan.summary && (
                    <p className="mt-2 text-xs text-muted-foreground">{scan.summary}</p>
                  )}
                  {scan.ideas.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-medium">Ide tambahan (tap untuk masuk prompt)</p>
                      <div className="flex flex-col gap-1.5">
                        {scan.ideas.map((idea) => (
                          <button
                            key={idea}
                            type="button"
                            onClick={() => toggleIdea(idea)}
                            className={cn(
                              "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition",
                              usedIdeas.includes(idea)
                                ? "border-primary bg-primary/10"
                                : "border-border bg-background/40",
                            )}
                          >
                            <Plus className="mt-0.5 size-3 shrink-0" />
                            {idea}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
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
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Lokasi (ganti otomatis di prompt)
              </p>
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
              Tanpa ditulis, AI tidak akan menambah orang/barang. Bentuk, warna & tulisan selalu
              dikunci.
            </p>
            <label className="flex items-center justify-between gap-3 rounded-xl border border-border p-3 text-sm">
              <span>
                Pertahankan angka & garis ukuran
                <span className="block text-xs text-muted-foreground">
                  Default mati: render bersih
                </span>
              </span>
              <Switch checked={keepDims} onCheckedChange={setKeepDims} />
            </label>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Format foto (berlaku juga untuk Render ulang)
              </p>
              <div className="flex flex-wrap gap-2">
                {RATIOS.map((r) => (
                  <Pill key={r.id} active={ratio === r.id} onClick={() => setRatio(r.id)}>
                    {r.label}
                  </Pill>
                ))}
              </div>
            </div>
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
            <Compare before={current.before ?? current.sketch} after={current.result} />
          ) : (
            <div className="grid aspect-video place-items-center rounded-2xl border border-border text-sm text-muted-foreground">
              {current.busy ? "Sedang dirender…" : "Belum dirender"}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" disabled={running} onClick={() => rerender(active)}>
              <Wand2 className="size-4" /> Render ulang
            </Button>
            <Button disabled={!current.result} onClick={() => setWmOpen(true)}>
              <Share2 className="size-4" /> Download / Share
            </Button>
          </div>
        </GlassCard>
      )}

      {done.length > 0 && !folder && (
        <ClientForm
          workspaceId={workspaceId}
          shots={done}
          objectLabel={objectLabel}
          open={formOpen}
          setOpen={setFormOpen}
          onSaved={onProfileSaved}
        />
      )}
      {done.length > 0 && folder && (
        <p className="text-center text-xs text-muted-foreground">
          ✅ Auto-save ke folder {folder.title} ·{" "}
          {folder.versions.find((v) => v.id === versionId)?.name ??
            `${objectLabel} ${folder.versions.length + 1}`}
        </p>
      )}

      {current?.result && (
        <WatermarkDialog
          open={wmOpen}
          onOpenChange={setWmOpen}
          option={{
            id: current.id,
            name: `render-3d-foto-${active + 1}`,
            image: current.result,
            before: current.before ?? current.sketch,
            spec: "",
            createdAt: 0,
          }}
          before={current.before ?? current.sketch}
          brand={brand}
          workshopId={workshopQuery.data?.id ?? null}
          onBrandSaved={() => void workshopQuery.refetch()}
          videoKind="cinematic"
          storyImages={done.map((d) => d.result!).slice(0, 5)}
        />
      )}
    </div>
  );
}

function ClientForm({
  workspaceId,
  shots,
  objectLabel,
  open,
  setOpen,
  onSaved,
}: {
  workspaceId: string | null;
  shots: Shot[];
  objectLabel: string;
  open: boolean;
  setOpen: (v: boolean) => void;
  onSaved: (p: { name: string; location: string; leadId: string }) => void;
}) {
  const [f, setF] = useState({ name: "", location: "", phone: "", size: "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });
  const save = useMutation({
    mutationFn: async () => {
      if (!workspaceId) throw new Error("Workspace belum siap, coba lagi");
      if (!f.name.trim() || !f.location.trim()) throw new Error("Nama & lokasi wajib diisi");
      const lead = await data.leads.create(workspaceId, {
        clientName: f.name.trim(),
        location: f.location.trim(),
        phone: f.phone.trim() || null,
        source: "3D Render AI",
        status: "CONSULTATION",
      });
      const project = await data.projects.create(workspaceId, {
        leadId: lead.id,
        projectName: `${objectLabel} — ${f.name.trim()}`,
        projectType:
          objectLabel === "Kitchen set"
            ? "KITCHEN_SET"
            : objectLabel === "Lemari"
              ? "WARDROBE"
              : "OTHER",
      });
      for (const [i, s] of shots.entries())
        await data.assets.upload(
          workspaceId,
          project.id,
          "SKETCHUP_RENDER",
          await dataUrlToFile(s.result!, `render-${i + 1}.png`),
        );
      await data.activities.log(workspaceId, {
        leadId: lead.id,
        type: "AI_CONCEPT",
        title: `3D Render AI — ${shots.length} render`,
        body: f.size.trim() ? `Ukuran: ${f.size.trim()}` : null,
      });
      return lead.id;
    },
    onSuccess: (leadId) => onSaved({ name: f.name.trim(), location: f.location.trim(), leadId }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (!open)
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        💾 {save.data ? "Data klien tersimpan" : "Simpan data klien"}
      </Button>
    );
  return (
    <SectionCard title="💾 Simpan data klien" description="Nama & lokasi wajib, sisanya opsional.">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nama klien *" name="name" value={f.name} onChange={set("name")} />
          <TextField
            label="Lokasi proyek *"
            name="location"
            value={f.location}
            onChange={set("location")}
          />
        </div>
        <TextField
          label="No. WhatsApp (opsional)"
          name="phone"
          inputMode="tel"
          value={f.phone}
          onChange={set("phone")}
        />
        <TextField
          label="Catatan ukuran (opsional)"
          name="size"
          placeholder="300 × 225 × 120 cm"
          value={f.size}
          onChange={set("size")}
        />
        <Button
          className="w-full"
          disabled={!f.name.trim() || !f.location.trim() || save.isPending || !!save.data}
          onClick={() => save.mutate()}
        >
          {save.isPending ? "Menyimpan…" : `Simpan klien + ${shots.length} render`}
        </Button>
        {save.data && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/leads/$leadId" params={{ leadId: save.data }}>
              Buka data klien
            </Link>
          </Button>
        )}
      </div>
    </SectionCard>
  );
}
