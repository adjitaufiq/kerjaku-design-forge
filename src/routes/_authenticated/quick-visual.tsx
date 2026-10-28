import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Download, ImagePlus, Palette, Plus, Save, Share2, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import { PageHeader } from "@/components/kerjaku/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  ALL_ITEMS,
  EXTRAS,
  RESKIN_TARGETS,
  ROOMS,
  type ReskinTarget,
} from "@/lib/quick-visual-catalog";
import { quickReskin, quickVisualize } from "@/lib/quick-visual.functions";
import {
  loadSession,
  loadWatermark,
  renderWithWatermark,
  saveSession,
  saveWatermark,
  type QuickSession,
  type VisualOption,
  type WatermarkPrefs,
} from "@/lib/quick-visual-store";
import { toWhatsAppNumber } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";
import { data } from "@/services/data";
import type { ProjectType } from "@/services/domain/models";

export const Route = createFileRoute("/_authenticated/quick-visual")({
  head: () => ({
    meta: [
      { title: "Quick Visual — KERJAKU" },
      {
        name: "description",
        content: "Upload a client room photo and a reference, and see the new furniture installed.",
      },
      { property: "og:title", content: "Quick Visual — KERJAKU" },
      {
        property: "og:description",
        content: "Install a reference kitchen set into a real client room photo with AI.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuickVisualPage,
});

const ROOM_PROJECT_TYPE: Record<string, ProjectType> = {
  KITCHEN: "KITCHEN_SET",
  BEDROOM: "BEDROOM_INTERIOR",
  OFFICE: "OFFICE_INTERIOR",
  LIVING: "OTHER",
};

const EMPTY_SESSION: QuickSession = { roomImage: null, options: [], activeId: null, saved: true };

/** Shrink the photo before sending so uploads stay fast. */
async function toCompressedDataUrl(file: File, max = 1536): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.88);
}

async function ensureDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const blob = await (await fetch(src)).blob();
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.readAsDataURL(blob);
  });
}

async function dataUrlToFile(src: string, name: string): Promise<File> {
  const blob = await (await fetch(src)).blob();
  return new File([blob], name, { type: blob.type || "image/png" });
}

function PhotoPicker({
  label,
  hint,
  src,
  onPick,
}: {
  label: string;
  hint: string;
  src: string | null;
  onPick: (f: File) => void;
}) {
  return (
    <label className="block cursor-pointer">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <div className="relative grid aspect-4/3 place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface/40 text-center text-sm text-muted-foreground">
        {src ? (
          <img src={src} alt={label} className="absolute inset-0 size-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 p-4">
            <ImagePlus className="size-6" />
            {hint}
          </div>
        )}
      </div>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function useFileUrl(file: File | null) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return url;
}

function CompareSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setPos(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)));
  };

  return (
    <div
      ref={boxRef}
      className="relative w-full touch-none select-none overflow-hidden rounded-2xl border border-border bg-surface"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
    >
      <img src={after} alt="Sesudah" className="block w-full" draggable={false} />
      <img
        src={before}
        alt="Sebelum"
        draggable={false}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      />
      <div className="absolute inset-y-0 w-0.5 bg-primary" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 size-8 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-background" />
      </div>
      <span className="absolute top-3 left-3 rounded-md bg-background/70 px-2 py-1 text-xs">
        Before
      </span>
      <span className="absolute top-3 right-3 rounded-md bg-background/70 px-2 py-1 text-xs">
        After
      </span>
    </div>
  );
}

function Chip({
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
        "inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-surface/40 text-muted-foreground hover:text-foreground",
      )}
    >
      {active ? <Check className="size-3" /> : <Plus className="size-3" />}
      {children}
    </button>
  );
}

function QuickVisualPage() {
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

  const [session, setSession] = useState<QuickSession>(EMPTY_SESSION);
  const [loaded, setLoaded] = useState(false);
  const [reference, setReference] = useState<File | null>(null);
  const referenceUrl = useFileUrl(reference);
  const [roomId, setRoomId] = useState(ROOMS[0]!.id);
  const [items, setItems] = useState<string[]>(["KITCHEN_SET"]);
  const [note, setNote] = useState("");
  const [pendingRoom, setPendingRoom] = useState<File | null>(null);
  const [wmOpen, setWmOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Restore the last session after hydration.
  useEffect(() => {
    void loadSession().then((s) => {
      if (s) setSession(s);
      setLoaded(true);
    });
  }, []);
  useEffect(() => {
    if (loaded) void saveSession(session);
  }, [session, loaded]);

  // Warn before leaving the page with unsaved visuals.
  useEffect(() => {
    if (session.saved || !session.options.length) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [session.saved, session.options.length]);

  const room = ROOMS.find((r) => r.id === roomId)!;
  const active = session.options.find((o) => o.id === session.activeId) ?? null;

  const applyRoom = async (file: File) => {
    const img = await toCompressedDataUrl(file);
    setSession({ roomImage: img, options: [], activeId: null, saved: true });
  };

  const pickRoom = (file: File) => {
    if (session.options.length && !session.saved) setPendingRoom(file);
    else void applyRoom(file);
  };

  const toggleItem = (id: string) =>
    setItems((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const toggleTag = (tag: string) => {
    const parts = note
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    const next = parts.includes(tag) ? parts.filter((p) => p !== tag) : [...parts, tag];
    setNote(next.join(", "));
  };
  const noteParts = note.split(",").map((p) => p.trim());

  const addOption = (image: string, spec: string, prefix?: string) => {
    const n = session.options.length + 1;
    const opt: VisualOption = {
      id: crypto.randomUUID(),
      name: prefix ? `Visual ${n} · ${prefix}` : `Visual ${n}`,
      image,
      spec,
      createdAt: Date.now(),
    };
    setSession((s) => ({ ...s, options: [...s.options, opt], activeId: opt.id, saved: false }));
  };

  const updateOption = (id: string, patch: Partial<VisualOption>) =>
    setSession((s) => ({
      ...s,
      saved: false,
      options: s.options.map((o) => (o.id === id ? { ...o, ...patch } : o)),
    }));

  const removeOption = (id: string) =>
    setSession((s) => {
      const options = s.options.filter((o) => o.id !== id);
      return { ...s, options, activeId: options.at(-1)?.id ?? null };
    });

  const run = useMutation({
    mutationFn: async () => {
      if (!session.roomImage || !reference)
        throw new Error("Upload foto ruangan dan foto referensi dulu");
      if (!items.length) throw new Error("Centang minimal satu item yang dipasang");
      const referenceImage = await toCompressedDataUrl(reference);
      const res = await quickVisualize({
        data: { roomImage: session.roomImage, referenceImage, items, note: note || null },
      });
      return res.image;
    },
    onSuccess: async (image) => {
      const labels = ALL_ITEMS.filter((i) => items.includes(i.id)).map((i) => i.label);
      addOption(await ensureDataUrl(image), [labels.join(" + "), note].filter(Boolean).join(" — "));
      toast.success("Tersimpan sebagai visual baru — geser untuk membandingkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quick Visual"
        subtitle="Tanpa isi data klien. Upload foto ruangan + referensi, AI hanya memasang furniturnya — tembok, lampu, lantai tetap."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionCard title="1. Upload foto" description="Foto asli klien dan contoh produk">
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <PhotoPicker
                label="Foto ruangan klien"
                hint="Foto ruangan asli (Before)"
                src={session.roomImage}
                onPick={pickRoom}
              />
              <PhotoPicker
                label="Foto referensi"
                hint="Contoh model (Pinterest)"
                src={referenceUrl}
                onPick={setReference}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Ruangan
              </p>
              <div className="flex flex-wrap gap-2">
                {ROOMS.map((r) => (
                  <Button
                    key={r.id}
                    type="button"
                    size="sm"
                    variant={r.id === roomId ? "default" : "outline"}
                    onClick={() => {
                      setRoomId(r.id);
                      setItems([r.items[0]!.id]);
                    }}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Yang dipasang (boleh lebih dari satu)
              </p>
              <div className="flex flex-wrap gap-2">
                {room.items.map((i) => (
                  <Chip key={i.id} active={items.includes(i.id)} onClick={() => toggleItem(i.id)}>
                    {i.label}
                  </Chip>
                ))}
              </div>
              <p className="pt-1 text-xs text-muted-foreground">Pintu & plafon (opsional)</p>
              <div className="flex flex-wrap gap-2">
                {EXTRAS.map((i) => (
                  <Chip key={i.id} active={items.includes(i.id)} onClick={() => toggleItem(i.id)}>
                    {i.label}
                  </Chip>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {items.includes("CEILING")
                  ? "Plafon akan diganti baru. Tembok, lantai, jendela tetap dikunci."
                  : "🔒 Plafon & lampu asli dikunci. Selain yang dicentang, semua bagian ruangan dikunci."}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Catatan cepat (klik)
              </p>
              <div className="flex flex-wrap gap-2">
                {room.tags.map((t) => (
                  <Chip key={t} active={noteParts.includes(t)} onClick={() => toggleTag(t)}>
                    {t}
                  </Chip>
                ))}
              </div>
            </div>

            <TextAreaField
              label="Catatan (bisa ketik tambahan)"
              name="note"
              placeholder="contoh: sisakan space kulkas 2 pintu di kiri"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!session.roomImage || !reference || !items.length || run.isPending}
              onClick={() => run.mutate()}
            >
              <Wand2 className="size-4" />
              {run.isPending ? "AI sedang memasang… (±30 detik)" : "Pasang dengan AI"}
            </Button>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <GlassCard>
            {session.options.length > 0 && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {session.options.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setSession((s) => ({ ...s, activeId: o.id }))}
                    className={cn(
                      "flex shrink-0 items-center gap-2 rounded-xl border p-1 pr-3 text-xs",
                      o.id === session.activeId
                        ? "border-primary bg-primary/15 text-foreground"
                        : "border-border text-muted-foreground",
                    )}
                  >
                    <img src={o.image} alt={o.name} className="size-9 rounded-lg object-cover" />
                    {o.name}
                  </button>
                ))}
              </div>
            )}
            {session.roomImage && active ? (
              <div className="space-y-3">
                <CompareSlider before={session.roomImage} after={active.image} />
                <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                  <TextField
                    label="Nama visual"
                    name="optName"
                    value={active.name}
                    onChange={(e) => updateOption(active.id, { name: e.target.value })}
                  />
                  <TextField
                    label="Spesifikasi"
                    name="optSpec"
                    value={active.spec}
                    onChange={(e) => updateOption(active.id, { spec: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => removeOption(active.id)}>
                    <Trash2 className="size-4" />
                    Hapus
                  </Button>
                  <Button variant="outline" onClick={() => setWmOpen(true)}>
                    <Download className="size-4" />
                    Download / Share
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid aspect-4/3 place-items-center rounded-2xl border border-dashed border-border bg-surface/40 p-6 text-center text-sm text-muted-foreground">
                {run.isPending ? "AI sedang memproses…" : "Hasil Before / After akan muncul di sini"}
              </div>
            )}
          </GlassCard>

          {active && <ReskinCard option={active} onResult={addOption} />}

          <div ref={formRef}>
            <SurveyForm
              session={session}
              roomId={roomId}
              workspaceId={workspaceId}
              onSaved={() => setSession((s) => ({ ...s, saved: true }))}
            />
          </div>
        </div>
      </div>

      {active && (
        <WatermarkDialog
          open={wmOpen}
          onOpenChange={setWmOpen}
          option={active}
          brand={brand}
        />
      )}

      <AlertDialog open={!!pendingRoom} onOpenChange={(o) => !o && setPendingRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Visual belum disimpan</AlertDialogTitle>
            <AlertDialogDescription>
              Ada {session.options.length} visual yang belum disimpan ke data klien. Kalau ganti
              foto ruangan, visual ini akan hilang. Isi nama & lokasi klien untuk simpan dulu?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const f = pendingRoom;
                setPendingRoom(null);
                if (f) void applyRoom(f);
              }}
            >
              Ganti tanpa simpan
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPendingRoom(null);
                formRef.current?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Simpan dulu
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReskinCard({
  option,
  onResult,
}: {
  option: VisualOption;
  onResult: (image: string, spec: string, prefix?: string) => void;
}) {
  const [target, setTarget] = useState<ReskinTarget>("ALL");
  const [swatch, setSwatch] = useState<File | null>(null);
  const swatchUrl = useFileUrl(swatch);
  const [colorText, setColorText] = useState("");

  const run = useMutation({
    mutationFn: async () => {
      const swatchImage = swatch ? await toCompressedDataUrl(swatch, 1024) : null;
      const res = await quickReskin({
        data: { baseImage: option.image, target, swatchImage, colorText: colorText || null },
      });
      return res.image;
    },
    onSuccess: async (image) => {
      const t = RESKIN_TARGETS.find((x) => x.value === target)!.label;
      const finish = colorText || "motif HPL upload";
      onResult(await ensureDataUrl(image), `${option.spec} | ${t}: ${finish}`, `${t} ${finish}`);
      toast.success("Motif baru tersimpan sebagai visual baru");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SectionCard
      title="🎨 Ganti warna / motif HPL"
      description={`Dari ${option.name} — desain kabinet tetap, hanya permukaan yang berubah`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {RESKIN_TARGETS.map((t) => (
            <Button
              key={t.value}
              type="button"
              size="sm"
              variant={t.value === target ? "default" : "outline"}
              onClick={() => setTarget(t.value)}
            >
              {t.label}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-[96px_1fr] items-start gap-3">
          <label className="block cursor-pointer">
            <div className="relative grid aspect-square place-items-center overflow-hidden rounded-xl border border-dashed border-border bg-surface/40 text-center text-[11px] text-muted-foreground">
              {swatchUrl ? (
                <img src={swatchUrl} alt="Sampel HPL" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="p-2">Foto HPL</span>
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setSwatch(e.target.files?.[0] ?? null)}
            />
          </label>
          <TextField
            label="Atau ketik warna / kode HPL"
            name="colorText"
            placeholder="contoh: putih matte, marmer carrara, TACO walnut"
            value={colorText}
            onChange={(e) => setColorText(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          disabled={(!swatch && !colorText.trim()) || run.isPending}
          onClick={() => run.mutate()}
        >
          <Palette className="size-4" />
          {run.isPending ? "AI mengganti motif…" : "Terapkan motif"}
        </Button>
      </div>
    </SectionCard>
  );
}

function SurveyForm({
  session,
  roomId,
  workspaceId,
  onSaved,
}: {
  session: QuickSession;
  roomId: string;
  workspaceId: string | null;
  onSaved: () => void;
}) {
  const [f, setF] = useState({ name: "", location: "", phone: "", p: "", l: "", t: "" });
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
        source: "Quick Visual",
        status: "CONSULTATION",
      });
      const roomLabel = ROOMS.find((r) => r.id === roomId)?.label.replace(/^\S+\s/, "") ?? "";
      const project = await data.projects.create(workspaceId, {
        leadId: lead.id,
        projectName: `${roomLabel} — ${f.name.trim()}`,
        projectType: ROOM_PROJECT_TYPE[roomId] ?? "OTHER",
      });
      const dims = [f.p && `P ${f.p} m`, f.l && `L ${f.l} m`, f.t && `T ${f.t} m`]
        .filter(Boolean)
        .join(" × ");
      const specs = session.options.map((o) => `• ${o.name}: ${o.spec}`).join("\n");
      await data.consultations.create(workspaceId, {
        projectId: project.id,
        clientRequirement: specs || null,
        notes: dims ? `Ukuran survei: ${dims}` : null,
      });
      if (session.roomImage)
        await data.assets.upload(
          workspaceId,
          project.id,
          "CLIENT_PHOTO",
          await dataUrlToFile(session.roomImage, "before.jpg"),
        );
      for (const [i, o] of session.options.entries())
        await data.assets.upload(
          workspaceId,
          project.id,
          "SKETCHUP_RENDER",
          await dataUrlToFile(o.image, `visual-${i + 1}.png`),
        );
      await data.activities.log(workspaceId, {
        leadId: lead.id,
        type: "AI_CONCEPT",
        title: `Survei Quick Visual — ${session.options.length} visual`,
        body: [dims && `Ukuran: ${dims}`, specs].filter(Boolean).join("\n") || null,
      });
      return lead.id;
    },
    onSuccess: () => {
      onSaved();
      toast.success("Data klien & semua visual tersimpan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const savedLeadId = save.data;

  return (
    <SectionCard
      title="💾 Simpan hasil survei"
      description="Isi setelah visual oke. Nama & lokasi wajib, sisanya opsional."
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nama klien *" name="name" placeholder="Ibu Malla" value={f.name} onChange={set("name")} />
          <TextField label="Lokasi proyek *" name="location" placeholder="Cibubur" value={f.location} onChange={set("location")} />
        </div>
        <TextField label="No. WhatsApp (opsional)" name="phone" inputMode="tel" placeholder="0812…" value={f.phone} onChange={set("phone")} />
        <div className="grid grid-cols-3 gap-2">
          <TextField label="Panjang (m)" name="p" inputMode="decimal" value={f.p} onChange={set("p")} />
          <TextField label="Lebar (m)" name="l" inputMode="decimal" value={f.l} onChange={set("l")} />
          <TextField label="Tinggi (m)" name="t" inputMode="decimal" value={f.t} onChange={set("t")} />
        </div>
        <Button
          className="w-full"
          disabled={!f.name.trim() || !f.location.trim() || save.isPending || session.saved && !!savedLeadId}
          onClick={() => save.mutate()}
        >
          <Save className="size-4" />
          {save.isPending ? "Menyimpan…" : `Simpan klien + ${session.options.length} visual`}
        </Button>
        {savedLeadId && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/leads/$leadId" params={{ leadId: savedLeadId }}>
              Buka data klien
            </Link>
          </Button>
        )}
      </div>
    </SectionCard>
  );
}

function WatermarkDialog({
  open,
  onOpenChange,
  option,
  brand,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  option: VisualOption;
  brand: { name: string | null; logo: string | null };
}) {
  const [prefs, setPrefs] = useState<WatermarkPrefs>(loadWatermark);
  const [phone, setPhone] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const update = (p: Partial<WatermarkPrefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      saveWatermark(next);
      return next;
    });

  const moveTo = (x: number, y: number) => {
    const b = boxRef.current?.getBoundingClientRect();
    if (!b) return;
    update({
      x: Math.min(100, Math.max(0, ((x - b.left) / b.width) * 100)),
      y: Math.min(100, Math.max(0, ((y - b.top) / b.height) * 100)),
    });
  };

  const hasLogo = !!brand.logo;
  const hasName = !!brand.name;
  const showLogo = prefs.showLogo && hasLogo;
  const showName = prefs.showName && hasName;

  const exportBlob = () =>
    renderWithWatermark(option.image, { ...prefs, showLogo, showName }, brand);
  const fileName = `${option.name.replace(/[^\w-]+/g, "-")}.png`;

  const download = async () => {
    try {
      const blob = await exportBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const share = async () => {
    const text = `Halo, berikut preview konsep ${option.name}${option.spec ? ` (${option.spec})` : ""} dari ${brand.name ?? "workshop kami"}.`;
    try {
      const blob = await exportBlob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return;
      }
      await download();
      const num = toWhatsAppNumber(phone);
      window.open(`https://wa.me/${num ?? ""}?text=${encodeURIComponent(text)}`, "_blank");
      toast.info("Gambar sudah terunduh — lampirkan di chat WhatsApp");
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Download / Share</DialogTitle>
          <DialogDescription>Atur watermark workshop sebelum dikirim ke klien.</DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between rounded-xl border border-border p-3">
          <span className="text-sm">Pasang watermark workshop</span>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => update({ enabled: v })} />
        </div>

        {prefs.enabled && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={showLogo}
                  disabled={!hasLogo}
                  onCheckedChange={(v) => update({ showLogo: !!v })}
                />
                Logo
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={showName}
                  disabled={!hasName}
                  onCheckedChange={(v) => update({ showName: !!v })}
                />
                Nama workshop
              </label>
            </div>
            {(!hasLogo || !hasName) && (
              <p className="rounded-lg bg-surface/60 p-2 text-xs text-muted-foreground">
                {!hasLogo && !hasName
                  ? "Nama & logo workshop belum diisi."
                  : !hasLogo
                    ? "Logo workshop belum ada — watermark hanya nama. Mau tambah logo?"
                    : "Nama workshop belum diisi — watermark hanya logo. Mau lengkapi nama?"}{" "}
                <Link to="/settings" className="text-primary underline">
                  Lengkapi di Settings
                </Link>
              </p>
            )}

            <div
              ref={boxRef}
              className="relative touch-none overflow-hidden rounded-xl border border-border"
              onPointerDown={(e) => {
                dragging.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                moveTo(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => dragging.current && moveTo(e.clientX, e.clientY)}
              onPointerUp={() => (dragging.current = false)}
            >
              <img src={option.image} alt="Preview" className="block w-full" draggable={false} />
              {(showLogo || showName) && (
                <div
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                  style={{
                    left: `${prefs.x}%`,
                    top: `${prefs.y}%`,
                    width: `${prefs.size}%`,
                    opacity: prefs.opacity,
                  }}
                >
                  {showLogo && (
                    <img src={brand.logo!} alt="Logo" className="max-h-12 w-auto object-contain" />
                  )}
                  {showName && (
                    <span className="text-center text-[10px] font-semibold text-foreground drop-shadow">
                      {brand.name}
                    </span>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Sentuh / geser di gambar untuk pindah posisi.</p>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Ukuran</p>
              <Slider min={8} max={50} step={1} value={[prefs.size]} onValueChange={([v]) => update({ size: v! })} />
              <p className="text-xs text-muted-foreground">Transparansi</p>
              <Slider min={10} max={100} step={5} value={[Math.round(prefs.opacity * 100)]} onValueChange={([v]) => update({ opacity: v! / 100 })} />
            </div>
          </div>
        )}

        <TextField
          label="No. WA klien (opsional, untuk share)"
          name="waPhone"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={download}>
            <Download className="size-4" />
            Download
          </Button>
          <Button onClick={share}>
            <Share2 className="size-4" />
            Share WA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
