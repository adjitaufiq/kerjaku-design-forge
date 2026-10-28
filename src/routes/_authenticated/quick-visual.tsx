import { useMutation } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, ImagePlus, Wand2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { GlassCard, SectionCard } from "@/components/kerjaku/glass-card";
import { SelectField, TextAreaField } from "@/components/kerjaku/form-fields";
import { PageHeader } from "@/components/kerjaku/page-header";
import { Button } from "@/components/ui/button";
import { quickVisualize, type QuickItem } from "@/lib/quick-visual.functions";

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

const ITEMS: { value: QuickItem; label: string }[] = [
  { value: "KITCHEN_SET", label: "Kitchen set" },
  { value: "WARDROBE", label: "Lemari / wardrobe" },
  { value: "TV_CABINET", label: "Kabinet TV" },
  { value: "BACKDROP", label: "Backdrop dinding" },
];

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

function PhotoPicker({
  label,
  hint,
  file,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return (
    <label className="block cursor-pointer">
      <span className="mb-1.5 block text-sm font-medium text-foreground">{label}</span>
      <div className="relative grid aspect-4/3 place-items-center overflow-hidden rounded-2xl border border-dashed border-border bg-surface/40 text-center text-sm text-muted-foreground">
        {url ? (
          <img src={url} alt={label} className="absolute inset-0 size-full object-cover" />
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
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
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

function QuickVisualPage() {
  const [room, setRoom] = useState<File | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  const [item, setItem] = useState<QuickItem>("KITCHEN_SET");
  const [note, setNote] = useState("");
  const [before, setBefore] = useState<string | null>(null);
  const [after, setAfter] = useState<string | null>(null);

  const run = useMutation({
    mutationFn: async () => {
      if (!room || !reference) throw new Error("Upload foto ruangan dan foto referensi dulu");
      const [roomImage, referenceImage] = await Promise.all([
        toCompressedDataUrl(room),
        toCompressedDataUrl(reference),
      ]);
      const res = await quickVisualize({
        data: { roomImage, referenceImage, item, note: note || null },
      });
      return { roomImage, image: res.image };
    },
    onSuccess: ({ roomImage, image }) => {
      setBefore(roomImage);
      setAfter(image);
      toast.success("Hasil siap — geser untuk membandingkan");
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
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <PhotoPicker
                label="Foto ruangan klien"
                hint="Foto dapur asli (Before)"
                file={room}
                onChange={setRoom}
              />
              <PhotoPicker
                label="Foto referensi"
                hint="Contoh kitchen set (Pinterest)"
                file={reference}
                onChange={setReference}
              />
            </div>
            <SelectField
              label="Yang dipasang"
              value={item}
              onValueChange={(v) => setItem(v as QuickItem)}
              options={ITEMS}
              hint="Selain ini, semua bagian ruangan dikunci"
            />
            <TextAreaField
              label="Catatan (opsional)"
              name="note"
              placeholder="contoh: bentuk L, kabinet atas sampai plafon"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button
              className="w-full bg-cta text-cta-foreground hover:bg-cta/90"
              disabled={!room || !reference || run.isPending}
              onClick={() => run.mutate()}
            >
              <Wand2 className="size-4" />
              {run.isPending ? "AI sedang memasang… (±30 detik)" : "Pasang dengan AI"}
            </Button>
          </div>
        </SectionCard>

        <GlassCard>
          {before && after ? (
            <div className="space-y-3">
              <CompareSlider before={before} after={after} />
              <div className="flex justify-end">
                <Button asChild variant="outline">
                  <a href={after} download="kerjaku-after.png">
                    <Download className="size-4" />
                    Download hasil
                  </a>
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
      </div>
    </div>
  );
}
