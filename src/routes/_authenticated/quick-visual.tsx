import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  Lock,
  LockOpen,
  Palette,
  Plus,
  Save,
  Share2,
  Trash2,
  Wand2,
} from "lucide-react";
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
import { ALL_ITEMS, RESKIN_TARGETS, ROOMS, type ReskinTarget } from "@/lib/quick-visual-catalog";
import { quickReskin, quickVisualize } from "@/lib/quick-visual.functions";
import {
  loadSession,
  loadWatermark,
  renderWithWatermark,
  processLogo,
  fontWeightOf,
  WATERMARK_COLORS,
  WATERMARK_FONTS,
  saveSession,
  saveWatermark,
  loadHistory,
  putHistory,
  type SavedSession,
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
  DOOR: "OTHER",
  CEILING_ROOM: "OTHER",
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
  const [locked, setLocked] = useState(false);

  const move = (clientX: number) => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return;
    setPos(Math.min(100, Math.max(0, ((clientX - box.left) / box.width) * 100)));
  };

  return (
    <div
      ref={boxRef}
      className={cn(
        "relative w-full select-none overflow-hidden rounded-2xl border border-border bg-surface",
        !locked && "touch-none",
      )}
      onPointerDown={(e) => {
        if (locked) return;
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e.clientX);
      }}
      onPointerMove={(e) => !locked && dragging.current && move(e.clientX)}
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
      <button
        type="button"
        aria-label={locked ? "Buka kunci slider" : "Kunci slider"}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => {
          dragging.current = false;
          setLocked((v) => !v);
        }}
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
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [history, setHistory] = useState<SavedSession[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [surveyOpen, setSurveyOpen] = useState(false);
  const [wmOpen, setWmOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Restore the last session and saved clients after hydration.
  useEffect(() => {
    void loadSession().then((s) => {
      if (s) setSession(s);
      setLoaded(true);
    });
    void loadHistory().then(setHistory);
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

  // Changing the client photo keeps earlier visuals (each keeps its own Before photo).
  const pickRoom = async (file: File) => {
    const img = await toCompressedDataUrl(file);
    setSession((s) => ({ ...s, roomImage: img }));
  };

  const switchRoom = (id: string) => {
    const r = ROOMS.find((x) => x.id === id)!;
    setRoomId(id);
    setItems([r.items[0]!.id]);
    setNote("");
    setReference(null);
    setCurrentId(null);
    setSession(EMPTY_SESSION);
  };

  const pickCategory = (id: string) => {
    if (id === roomId) return setShowItems((v) => !v);
    setShowItems(true);
    if (session.options.length && !session.saved) setPendingRoomId(id);
    else switchRoom(id);
  };

  const openSaved = (h: SavedSession) => {
    const r = ROOMS.find((x) => x.id === h.roomId) ?? ROOMS[0]!;
    setRoomId(r.id);
    setItems([r.items[0]!.id]);
    setNote("");
    setReference(null);
    setCurrentId(h.id);
    setSession({ ...h.session, saved: true });
    toast.success(`Data ${h.clientName} dibuka`);
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
  const pickedTags = room.tags.filter((t) => noteParts.includes(t)).length;
  const [showItems, setShowItems] = useState(false);

  const addOption = (image: string, spec: string, label: string) => {
    setSession((s) => {
      const n = s.options.filter((o) => o.name.startsWith(`Visual ${label} `)).length + 1;
      const opt: VisualOption = {
        id: crypto.randomUUID(),
        name: `Visual ${label} ${n}`,
        image,
        ...(s.roomImage ? { before: s.roomImage } : {}),
        spec,
        createdAt: Date.now(),
      };
      return { ...s, options: [...s.options, opt], activeId: opt.id, saved: false };
    });
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
      addOption(
        await ensureDataUrl(image),
        [labels.join(" + "), note].filter(Boolean).join(" — "),
        labels[0] ?? "Visual",
      );
      toast.success("Tersimpan otomatis — geser untuk membandingkan");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const roomName = (id: string) =>
    ROOMS.find((r) => r.id === id)?.label.replace(/^\S+\s/, "") ?? id;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quick Visual"
        subtitle="Pilih project → upload foto → konfirmasi. Tembok, lampu, lantai tetap."
      />

      {history.length > 0 && (
        <Fold title={`📂 Klien tersimpan (${history.length})`}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {history.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => openSaved(h)}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl border p-1 pr-3 text-left text-xs",
                  h.id === currentId
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground",
                )}
              >
                {h.session.options[0] && (
                  <img
                    src={h.session.options[0].image}
                    alt=""
                    className="size-10 rounded-lg object-cover"
                  />
                )}
                <span>
                  <span className="block font-medium text-foreground">{h.clientName}</span>
                  {roomName(h.roomId)} · {h.location} · {h.session.options.length} visual
                </span>
              </button>
            ))}
          </div>
        </Fold>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <SectionCard title="1. Pilih project" description="Lalu upload foto dan konfirmasi">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {ROOMS.map((r) => (
                <Button
                  key={r.id}
                  type="button"
                  size="sm"
                  variant={r.id === roomId ? "default" : "outline"}
                  onClick={() => pickCategory(r.id)}
                >
                  {r.label}
                </Button>
              ))}
            </div>

            {showItems && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {room.items.map((i) => (
                    <Chip key={i.id} active={items.includes(i.id)} onClick={() => toggleItem(i.id)}>
                      {i.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <PhotoPicker
                label="Foto klien"
                hint="Foto ruangan asli"
                src={session.roomImage}
                onPick={(f) => void pickRoom(f)}
              />
              <PhotoPicker
                label="Foto referensi"
                hint="Contoh model"
                src={referenceUrl}
                onPick={setReference}
              />
            </div>

            <div className="space-y-2">
              <Fold title={`📝 Catatan${pickedTags ? ` (${pickedTags})` : ""}`}>
                <div className="flex flex-wrap gap-2">
                  {room.tags.map((t) => (
                    <Chip key={t} active={noteParts.includes(t)} onClick={() => toggleTag(t)}>
                      {t}
                    </Chip>
                  ))}
                </div>
                <TextAreaField
                  label="Ketik tambahan"
                  name="note"
                  placeholder="contoh: sisakan space kulkas 2 pintu di kiri"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </Fold>
            </div>

            <Button
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!session.roomImage || !reference || !items.length || run.isPending}
              onClick={() => run.mutate()}
            >
              <Wand2 className="size-4" />
              {run.isPending ? "AI sedang memasang… (±30 detik)" : "Konfirmasi & pasang dengan AI"}
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
            {active && (active.before ?? session.roomImage) ? (
              <div className="space-y-3">
                <CompareSlider
                  before={(active.before ?? session.roomImage)!}
                  after={active.image}
                />
                <Fold title="✏️ Nama & spesifikasi">
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
                </Fold>
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
                {run.isPending
                  ? "AI sedang memproses…"
                  : "Hasil Before / After akan muncul di sini"}
              </div>
            )}
          </GlassCard>

          {active && (
            <Fold title="🎨 Ganti warna / motif HPL">
              <ReskinCard
                option={active}
                onResult={(img, spec) =>
                  addOption(
                    img,
                    spec,
                    active.name.replace(/^Visual\s+/, "").replace(/\s+\d+$/, "") + " HPL",
                  )
                }
              />
            </Fold>
          )}

          {session.options.length > 0 && (
            <div ref={formRef}>
              <Fold
                title={
                  session.saved && currentId ? "💾 Data klien tersimpan" : "💾 Simpan data klien"
                }
                open={surveyOpen}
                onOpenChange={setSurveyOpen}
              >
                <SurveyForm
                  session={session}
                  roomId={roomId}
                  workspaceId={workspaceId}
                  onSaved={async (info) => {
                    const id = currentId ?? crypto.randomUUID();
                    const saved = { ...session, saved: true };
                    setSession(saved);
                    setCurrentId(id);
                    setHistory(
                      await putHistory({
                        id,
                        clientName: info.name,
                        location: info.location,
                        roomId,
                        leadId: info.leadId,
                        savedAt: Date.now(),
                        session: saved,
                      }),
                    );
                    if (pendingRoomId) {
                      const next = pendingRoomId;
                      setPendingRoomId(null);
                      switchRoom(next);
                    }
                  }}
                />
              </Fold>
            </div>
          )}
        </div>
      </div>

      {active && (
        <WatermarkDialog
          open={wmOpen}
          onOpenChange={setWmOpen}
          option={active}
          brand={brand}
          workshopId={workshopQuery.data?.id ?? null}
          onBrandSaved={() => void workshopQuery.refetch()}
        />
      )}

      <AlertDialog
        open={!!pendingRoomId && !surveyOpen}
        onOpenChange={(o) => !o && setPendingRoomId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Simpan dulu sebelum ganti project</AlertDialogTitle>
            <AlertDialogDescription>
              Ada {session.options.length} visual {roomName(roomId)} yang belum disimpan. Isi nama &
              lokasi klien dulu supaya tidak hilang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const id = pendingRoomId;
                setPendingRoomId(null);
                if (id) switchRoom(id);
              }}
            >
              Ganti tanpa simpan
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSurveyOpen(true);
                setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
              }}
            >
              Isi data klien
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fold({
  title,
  children,
  open: openProp,
  onOpenChange,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  const [inner, setInner] = useState(false);
  const open = openProp ?? inner;
  const toggle = () => (onOpenChange ? onOpenChange(!open) : setInner(!open));
  return (
    <div className="rounded-2xl border border-border bg-surface/30">
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-foreground"
      >
        {title}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
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
                <img
                  src={swatchUrl}
                  alt="Sampel HPL"
                  className="absolute inset-0 size-full object-cover"
                />
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
  onSaved: (info: { leadId: string; name: string; location: string }) => void;
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
    onSuccess: (leadId) => {
      onSaved({ leadId, name: f.name.trim(), location: f.location.trim() });
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
          <TextField
            label="Nama klien *"
            name="name"
            placeholder="Ibu Malla"
            value={f.name}
            onChange={set("name")}
          />
          <TextField
            label="Lokasi proyek *"
            name="location"
            placeholder="Cibubur"
            value={f.location}
            onChange={set("location")}
          />
        </div>
        <TextField
          label="No. WhatsApp (opsional)"
          name="phone"
          inputMode="tel"
          placeholder="0812…"
          value={f.phone}
          onChange={set("phone")}
        />
        <Fold title="📏 Ukuran survei (opsional)">
          <div className="grid grid-cols-3 gap-2">
            <TextField
              label="Panjang (m)"
              name="p"
              inputMode="decimal"
              value={f.p}
              onChange={set("p")}
            />
            <TextField
              label="Lebar (m)"
              name="l"
              inputMode="decimal"
              value={f.l}
              onChange={set("l")}
            />
            <TextField
              label="Tinggi (m)"
              name="t"
              inputMode="decimal"
              value={f.t}
              onChange={set("t")}
            />
          </div>
        </Fold>
        <Button
          className="w-full"
          disabled={
            !f.name.trim() ||
            !f.location.trim() ||
            save.isPending ||
            (session.saved && !!savedLeadId)
          }
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
  workshopId,
  onBrandSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  option: VisualOption;
  brand: { name: string | null; logo: string | null };
  workshopId: string | null;
  onBrandSaved: () => void;
}) {
  const [prefs, setPrefs] = useState<WatermarkPrefs>(loadWatermark);
  const [phone, setPhone] = useState("");
  const [brandOpen, setBrandOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; size: number } | null>(null);
  const [wmLocked, setWmLocked] = useState(false);
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
  const pinchDist = () => {
    const [a, b] = [...pointers.current.values()];
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
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
            <div className="flex flex-wrap items-center gap-4 text-sm">
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
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                onClick={() => setBrandOpen(true)}
              >
                ✏️ Nama & logo
              </Button>
            </div>
            {(!hasLogo || !hasName) && (
              <p className="rounded-lg bg-surface/60 p-2 text-xs text-muted-foreground">
                {!hasLogo && !hasName
                  ? "Nama & logo workshop belum diisi."
                  : !hasLogo
                    ? "Logo workshop belum ada — watermark hanya nama. Mau tambah logo?"
                    : "Nama workshop belum diisi — watermark hanya logo. Mau lengkapi nama?"}{" "}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => setBrandOpen(true)}
                >
                  Lengkapi di sini
                </button>
              </p>
            )}

            <div
              ref={boxRef}
              className={cn(
                "relative select-none overflow-hidden rounded-xl border border-border",
                !wmLocked && "touch-none",
              )}
              onPointerDown={(e) => {
                if (wmLocked) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pointers.current.size === 2)
                  pinch.current = { dist: pinchDist(), size: prefs.size };
                else moveTo(e.clientX, e.clientY);
              }}
              onPointerMove={(e) => {
                if (wmLocked || !pointers.current.has(e.pointerId)) return;
                pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
                if (pinch.current && pointers.current.size >= 2) {
                  const d = pinchDist();
                  if (pinch.current.dist > 0)
                    update({
                      size: Math.min(
                        80,
                        Math.max(5, pinch.current.size * (d / pinch.current.dist)),
                      ),
                    });
                } else if (!pinch.current) moveTo(e.clientX, e.clientY);
              }}
              onPointerUp={(e) => {
                pointers.current.delete(e.pointerId);
                if (pointers.current.size === 0) pinch.current = null;
              }}
              onPointerCancel={(e) => {
                pointers.current.delete(e.pointerId);
                if (pointers.current.size === 0) pinch.current = null;
              }}
            >
              <button
                type="button"
                aria-label={wmLocked ? "Buka kunci watermark" : "Kunci watermark"}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  pointers.current.clear();
                  pinch.current = null;
                  setWmLocked((v) => !v);
                }}
                className={cn(
                  "absolute top-3 left-1/2 z-10 grid size-9 -translate-x-1/2 place-items-center rounded-full border",
                  wmLocked
                    ? "border-cta bg-cta text-cta-foreground"
                    : "border-border bg-background/70 text-foreground",
                )}
              >
                {wmLocked ? <Lock size={16} /> : <LockOpen size={16} />}
              </button>
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
                    <img
                      src={brand.logo!}
                      alt="Logo"
                      className="max-w-none object-contain"
                      style={{
                        width: `${prefs.logoScale ?? 100}%`,
                        aspectRatio: "1 / 0.45",
                      }}
                    />
                  )}
                  {showName && <WatermarkText name={brand.name!} prefs={prefs} />}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Geser 1 jari untuk pindah posisi · cubit 2 jari untuk perbesar / perkecil · kunci
              gembok di atas biar touchscreen aman.
            </p>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Ukuran</span>
                <span className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => update({ size: Math.max(5, prefs.size - 2) })}
                  >
                    −
                  </Button>
                  {Math.round(prefs.size)}%
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => update({ size: Math.min(80, prefs.size + 2) })}
                  >
                    +
                  </Button>
                </span>
              </div>
              <Slider
                min={5}
                max={80}
                step={1}
                value={[prefs.size]}
                onValueChange={([v]) => update({ size: v! })}
              />
              {showLogo && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Ukuran logo ({prefs.logoScale ?? 100}%)
                  </p>
                  <Slider
                    min={20}
                    max={300}
                    step={5}
                    value={[prefs.logoScale ?? 100]}
                    onValueChange={([v]) => update({ logoScale: v! })}
                  />
                </>
              )}
              {showName && (
                <>
                  <p className="text-xs text-muted-foreground">
                    Ukuran teks ({prefs.textScale ?? 100}%)
                  </p>
                  <Slider
                    min={20}
                    max={300}
                    step={5}
                    value={[prefs.textScale ?? 100]}
                    onValueChange={([v]) => update({ textScale: v! })}
                  />
                </>
              )}
              <p className="text-xs text-muted-foreground">
                Transparansi ({Math.round(prefs.opacity * 100)}%)
              </p>
              <Slider
                min={10}
                max={100}
                step={5}
                value={[Math.round(prefs.opacity * 100)]}
                onValueChange={([v]) => update({ opacity: v! / 100 })}
              />
            </div>

            {showName && (
              <Fold title="🔤 Font & warna nama">
                <div className="grid grid-cols-2 gap-2">
                  {WATERMARK_FONTS.map((f) => (
                    <button
                      key={f.label}
                      type="button"
                      onClick={() => update({ font: f.family })}
                      className={cn(
                        "truncate rounded-lg border px-2 py-2 text-sm",
                        prefs.font === f.family
                          ? "border-primary bg-primary/15 text-foreground"
                          : "border-border text-muted-foreground",
                      )}
                      style={{ fontFamily: f.family, fontWeight: f.weight }}
                    >
                      {brand.name || f.label}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {WATERMARK_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Warna ${c}`}
                      onClick={() => update({ color: c })}
                      className={cn(
                        "size-7 rounded-full border-2",
                        prefs.color === c ? "border-primary" : "border-border",
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="color"
                      value={prefs.color}
                      onChange={(e) => update({ color: e.target.value })}
                      className="h-8 w-12 cursor-pointer rounded border border-border bg-transparent"
                    />
                    Warna bebas
                  </label>
                </div>
              </Fold>
            )}
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
      <BrandDialog
        open={brandOpen}
        onOpenChange={setBrandOpen}
        brand={brand}
        workshopId={workshopId}
        onSaved={onBrandSaved}
      />
    </Dialog>
  );
}

function WatermarkText({ name, prefs }: { name: string; prefs: WatermarkPrefs }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [w, setW] = useState(80);
  useEffect(() => {
    const el = ref.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const px = Math.max(5, w * 0.12 * ((prefs.textScale ?? 100) / 100));
  return (
    <span
      ref={ref}
      className="text-center whitespace-pre"
      style={{
        fontFamily: prefs.font,
        fontWeight: fontWeightOf(prefs.font),
        fontSize: px,
        lineHeight: 1.2,
        color: prefs.color,
        textShadow: `0 0 ${px * 0.3}px rgba(0,0,0,0.55)`,
      }}
    >
      {name}
    </span>
  );
}

function BrandDialog({
  open,
  onOpenChange,
  brand,
  workshopId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  brand: { name: string | null; logo: string | null };
  workshopId: string | null;
  onSaved: () => void;
}) {
  const [name, setName] = useState(brand.name ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [logo, setLogo] = useState<string | null>(brand.logo);

  useEffect(() => {
    if (open) {
      setName(brand.name ?? "");
      setLogo(brand.logo);
      setFile(null);
    }
  }, [open, brand.name, brand.logo]);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    void processLogo(file, removeBg).then((url) => alive && setLogo(url));
    return () => {
      alive = false;
    };
  }, [file, removeBg]);

  const save = useMutation({
    mutationFn: async () => {
      if (!workshopId) throw new Error("Data workshop belum siap, coba lagi sebentar");
      await data.workspaces.updateWorkshop(workshopId, {
        name: name.trim() || brand.name || "",
        logo: logo || null,
      });
    },
    onSuccess: () => {
      toast.success("Nama & logo workshop tersimpan");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nama & logo workshop</DialogTitle>
          <DialogDescription>Otomatis tersimpan juga di Settings.</DialogDescription>
        </DialogHeader>
        <TextField
          label="Nama workshop"
          name="wsName"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <label className="block cursor-pointer">
          <span className="mb-1.5 block text-sm font-medium text-foreground">Logo</span>
          <div
            className="grid h-36 place-items-center overflow-hidden rounded-2xl border border-dashed border-border text-sm text-muted-foreground"
            style={{
              backgroundImage:
                "repeating-conic-gradient(var(--color-muted) 0% 25%, transparent 0% 50%)",
              backgroundSize: "16px 16px",
            }}
          >
            {logo ? (
              <img src={logo} alt="Logo" className="max-h-32 max-w-[90%] object-contain" />
            ) : (
              <span className="flex flex-col items-center gap-2">
                <ImagePlus className="size-6" />
                Upload logo
              </span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) setFile(f);
              e.target.value = "";
            }}
          />
        </label>
        {file && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={removeBg ? "default" : "outline"}
              size="sm"
              onClick={() => setRemoveBg(true)}
            >
              ✨ Hapus latar
            </Button>
            <Button
              variant={!removeBg ? "default" : "outline"}
              size="sm"
              onClick={() => setRemoveBg(false)}
            >
              🖼️ Original
            </Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ← Kembali
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="size-4" />
            {save.isPending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
