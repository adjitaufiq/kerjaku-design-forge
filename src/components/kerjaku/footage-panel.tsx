import { useEffect, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  FOOTAGE_MODES,
  drawTake,
  loadImg,
  recordTake,
  slug,
  type FootageMode,
} from "@/lib/footage";

/** 6 camera takes per photo with live preview, speed setting and per-take download. */
export function FootagePanel({ image, name }: { image: string; name: string }) {
  const [seconds, setSeconds] = useState(8);
  const [open, setOpen] = useState<FootageMode | null>(null);
  const [busy, setBusy] = useState<FootageMode | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    let ok = true;
    void loadImg(image).then((i) => ok && setImg(i));
    return () => {
      ok = false;
    };
  }, [image]);

  const download = async (mode: FootageMode) => {
    setBusy(mode);
    try {
      const { blob, ext } = await recordTake(image, mode, seconds);
      const file = `${slug(name)}-${mode}-${seconds}s.${ext}`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.success(`Tersimpan: ${file}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal merekam");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">🎬 Footage · {name}</p>
        <span className="text-xs text-muted-foreground">0 kredit · tanpa suara</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Speed per take</span>
          <span className="font-semibold text-foreground">{seconds} detik</span>
        </div>
        <Slider
          min={3}
          max={15}
          step={1}
          value={[seconds]}
          onValueChange={(v) => setSeconds(v[0] ?? 8)}
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Cepat</span>
          <span>Lambat</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {FOOTAGE_MODES.map((m) => (
          <div key={m.id} className="space-y-1.5">
            <button
              type="button"
              className="block w-full"
              onClick={() => setOpen(m.id)}
              aria-label={`Preview ${m.label}`}
            >
              <TakePreview img={img} mode={m.id} seconds={seconds} />
            </button>
            <p className="text-xs font-medium">
              {m.emoji} {m.label}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              disabled={!!busy}
              onClick={() => void download(m.id)}
            >
              <Download className="size-3.5" />
              {busy === m.id ? `Merekam ${seconds}s…` : "Download"}
            </Button>
          </div>
        ))}
      </div>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-background/95 p-3 backdrop-blur"
          onClick={() => setOpen(null)}
        >
          <div className="flex items-center justify-between pb-2">
            <p className="text-sm font-semibold">
              {FOOTAGE_MODES.find((m) => m.id === open)?.emoji}{" "}
              {FOOTAGE_MODES.find((m) => m.id === open)?.label} · {seconds}s
            </p>
            <Button size="icon" variant="ghost" onClick={() => setOpen(null)} aria-label="Tutup">
              <X className="size-5" />
            </Button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="max-h-full w-full max-w-md" onClick={(e) => e.stopPropagation()}>
              <TakePreview img={img} mode={open} seconds={seconds} big />
            </div>
          </div>
          <div className="space-y-2 pt-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {FOOTAGE_MODES.map((m) => (
                <Button
                  key={m.id}
                  size="sm"
                  variant={m.id === open ? "default" : "outline"}
                  onClick={() => setOpen(m.id)}
                >
                  {m.emoji} {m.label}
                </Button>
              ))}
            </div>
            <Slider
              min={3}
              max={15}
              step={1}
              value={[seconds]}
              onValueChange={(v) => setSeconds(v[0] ?? 8)}
            />
            <Button className="w-full" disabled={!!busy} onClick={() => void download(open)}>
              <Download className="size-4" />
              {busy === open ? `Merekam ${seconds}s…` : `Download ${seconds}s`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TakePreview({
  img,
  mode,
  seconds,
  big,
}: {
  img: HTMLImageElement | null;
  mode: FootageMode;
  seconds: number;
  big?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c || !img) return;
    const w = big ? 900 : 360;
    c.width = w;
    c.height = Math.round((w * img.height) / img.width);
    const ctx = c.getContext("2d")!;
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const period = seconds * 1000 + 600;
      const p = ((performance.now() - t0) % period) / (seconds * 1000);
      drawTake(ctx, img, mode, p);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [img, mode, seconds, big]);
  return <canvas ref={ref} className={big ? "mx-auto max-h-[60vh] w-auto max-w-full rounded-xl bg-muted" : "w-full rounded-lg bg-muted"} />;
}
