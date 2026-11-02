import { useState } from "react";
import { CheckCircle2, Download, Loader2, Pencil, ScanSearch, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import {
  ACCESSORIES,
  defaultModules,
  hplPurchaseList,
  missingFinalSpec,
  nextSpecVersion,
  type HplCodes,
  SHAPE_LABEL,
  SHAPES,
  SPEC_OPTIONS,
  specHintsSchema,
  specReviewRows,
  specVersionLabel,
  type SpecHints,
} from "@/lib/interior-spec";
import { TacoCodeField } from "@/components/kerjaku/taco-code-field";
import { tacoInfoFor, type TacoInfo } from "@/lib/interior-spec";
import { scanInterior } from "@/lib/interior-scan.functions";
import { streamImage } from "@/lib/interior-stream";
import { supabase } from "@/integrations/supabase/client";

export function InteriorRender({
  image,
  name,
  initialSpec,
  interiorImage,
  exteriorImage,
  interiorSideImage,
  summary,
  onSave,
}: {
  summary?: string | undefined;
  image: string;
  name: string;
  initialSpec?: SpecHints | undefined;
  interiorImage?: string | undefined;
  exteriorImage?: string | undefined;
  interiorSideImage?: string | undefined;
  onSave: (spec: SpecHints, interior?: string, exterior?: string, interiorSide?: string) => Promise<void>;
}) {
  const [spec, setSpec] = useState<SpecHints>(
    initialSpec ?? {
      outside: "hpl",
      inside: "blockmin",
      hinge: "slowmo",
      slide: "dt_slowmo",
      accessories: [],
    },
  );
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState(interiorImage ?? "");
  const [final, setFinal] = useState(true);
  const [side, setSide] = useState(interiorSideImage ?? "");
  const [sideFinal, setSideFinal] = useState(true);
  const [outside, setOutside] = useState(exteriorImage ?? "");
  const [outsideFinal, setOutsideFinal] = useState(true);
  const [view, setView] = useState<"interior" | "exterior" | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(!!initialSpec);
  // Master spec yang terakhir disimpan; review mode bila ada.
  const [saved, setSaved] = useState<SpecHints | undefined>(initialSpec);
  const [editing, setEditing] = useState(!initialSpec);
  const scan = async () => {
    setScanning(true);
    setError("");
    try {
      const blob = await (await fetch(image)).blob();
      const dataUrl = await new Promise<string>((ok, bad) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result));
        r.onerror = () => bad(new Error("Foto After tidak bisa dibaca"));
        r.readAsDataURL(blob);
      });
      const result = await scanInterior({ data: { image: dataUrl, summary: summary ?? "" } });
      // Kode HPL yang sudah diisi manual tidak ditimpa scan ulang.
      setSpec((s) => ({ ...result, hplCodes: s.hplCodes?.lower ? s.hplCodes : result.hplCodes }));
      setPreview("");
      setScanned(true);
      toast.success("Layout terdeteksi — lengkapi spek material");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan gagal");
    } finally {
      setScanning(false);
    }
  };
  const modules = spec.modules ?? [];
  const setValue = (
    key: "material" | "outside" | "inside" | "hinge" | "slide" | "glue" | "edge" | "handle" | "glass" | "lighting" | "topLayers",
    value: string,
  ) => {
    const selected = specHintsSchema.shape[key].parse(value);
    setSpec((s) => ({ ...s, [key]: selected }));
    setPreview("");
  };
  const codes: HplCodes = spec.hplCodes ?? {
    lower: "", upperSame: true, upper: "", top: "", hasAccent: false, accent: "", accentNote: "",
  };
  const setCodes = (patch: Partial<HplCodes>) => {
    setPreview("");
    setSpec((s) => {
      const next = { ...codes, ...(s.hplCodes ?? {}), ...patch };
      const upper = next.upperSame ? next.lower : next.upper;
      return {
        ...s,
        hplCodes: next,
        // Kode modul ikut slot agar SME memakai satu sumber.
        modules: (s.modules ?? []).map((m) =>
          m.level === "upper" ? { ...m, finish: upper } : { ...m, finish: next.lower },
        ),
      };
    });
  };
  const setInfo = (key: string, info: TacoInfo | null) => {
    setPreview("");
    setSpec((s) => {
      const next = { ...(s.hplInfo ?? {}) };
      if (info) next[key] = info;
      else delete next[key];
      return { ...s, hplInfo: next };
    });
  };
  const codeProps = (field: "lower" | "upper" | "top" | "accent") => ({
    value: codes[field],
    info: tacoInfoFor(spec, codes[field]),
    onChange: (v: string) => setCodes({ [field]: v }),
    onInfo: setInfo,
  });
  const pickDuco = async (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((ok, bad) => {
        img.onload = ok;
        img.onerror = bad;
        img.src = url;
      });
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      // Centre crop only: edges of a paint-sample photo are usually background.
      const w = img.width * 0.5, h = img.height * 0.5;
      ctx.drawImage(img, img.width * 0.25, img.height * 0.25, w, h, 0, 0, 32, 32);
      const d = ctx.getImageData(0, 0, 32, 32).data;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]!; g += d[i + 1]!; b += d[i + 2]!; }
      const n = d.length / 4;
      const hex = "#" + [r, g, b].map((v) => Math.round(v / n).toString(16).padStart(2, "0")).join("");
      setSpec((s) => ({ ...s, ducoHex: hex }));
      setPreview("");
    } catch {
      toast.error("Foto warna tidak bisa dibaca");
    } finally {
      URL.revokeObjectURL(url);
    }
  };
  const missing = missingFinalSpec(spec);
  const sheets = hplPurchaseList(spec.hplCodes);
  const strip = (s: SpecHints | undefined) => (s ? JSON.stringify({ ...s, version: undefined }) : "");
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (missing.length) throw new Error(`Lengkapi dulu: ${missing.join(", ")}`);
      const changed = strip(spec) !== strip(saved);
      const version = nextSpecVersion(saved, changed);
      const master = specHintsSchema.parse({ ...spec, version });
      // Spek berubah = gambar lama tidak berlaku lagi.
      const keepImage = !changed && preview && final ? preview : undefined;
      const keepOut = !changed && outside && outsideFinal ? outside : undefined;
      const keepSide = !changed && side && sideFinal ? side : undefined;
      await onSave(master, keepImage, keepOut, keepSide);
      setSpec(master);
      setSaved(master);
      if (changed) {
        setPreview("");
        setOutside("");
        setSide("");
      }
      setEditing(false);
      toast.success(`${specVersionLabel(version)} tersimpan — tanpa kredit AI`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan spek");
    } finally {
      setSaving(false);
    }
  };
  const generate = async (kind: "interior" | "exterior") => {
    setBusy(true);
    setView(kind);
    setError("");
    if (kind === "exterior") setOutside("");
    else {
      setPreview("");
      setSide("");
    }
    try {
      if (!saved || editing) throw new Error("Simpan data spek master dulu.");
      const chosen = specHintsSchema.parse(saved);
      if (missingFinalSpec(chosen).length) throw new Error("Spek master belum lengkap.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Silakan login kembali.");
      const source = await fetch(image);
      if (!source.ok) throw new Error("Foto After tidak bisa dibuka. Buka ulang data klien.");
      const file = new File([await source.blob()], "after.png", {
        type: source.headers.get("content-type")?.split(";")[0] ?? "image/png",
      });
      const run = async (
        v: "interior" | "interior_side" | "exterior",
        setImg: (u: string) => void,
        setDone: (d: boolean) => void,
      ) => {
        const form = new FormData();
        form.set("image", file);
        form.set("specHints", JSON.stringify(chosen));
        form.set("note", note);
        form.set("view", v);
        let result = "";
        await streamImage(
          "/api/render-interior",
          form,
          (url, done) => {
            setImg(url);
            setDone(done);
            if (done) result = url;
          },
          undefined,
          { Authorization: `Bearer ${data.session.access_token}` },
        );
        if (!result) throw new Error("Gambar belum selesai.");
        return result;
      };
      if (kind === "exterior") {
        const out = await run("exterior", setOutside, setOutsideFinal);
        await onSave(chosen, final && preview ? preview : undefined, out, sideFinal && side ? side : undefined);
        toast.success("Final tampak luar tersimpan");
      } else {
        // Tampak dalam selalu 2 sudut: depan wide-angle + serong 3/4 untuk QC hardware.
        const front = await run("interior", setPreview, setFinal);
        const angle = await run("interior_side", setSide, setSideFinal);
        await onSave(chosen, front, outsideFinal && outside ? outside : undefined, angle);
        toast.success("2 foto tampak dalam tersimpan (depan + serong)");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat gambar");
    } finally {
      setBusy(false);
      setView(null);
    }
  };
  const review = saved && !editing ? saved : undefined;
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">{name}</p>
      {!review && (
        <div className="space-y-2">
          <Button
            type="button"
            disabled={scanning || busy}
            onClick={() => void scan()}
            className="h-auto w-full justify-start gap-3 rounded-xl border border-primary/40 bg-gradient-to-b from-primary/25 to-primary/10 px-4 py-3 text-left text-foreground shadow-[0_4px_0_0_hsl(var(--primary)/0.35),0_8px_18px_-6px_hsl(var(--primary)/0.5)] transition-all hover:from-primary/30 active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--primary)/0.35)] disabled:opacity-100"
          >
            {scanning ? (
              <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
            ) : scanned ? (
              <CheckCircle2 className="size-5 shrink-0 text-primary" />
            ) : (
              <ScanSearch className="size-5 shrink-0 text-primary" />
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold">
                {scanning ? "Sedang memindai layout kitchen set…" : scanned ? "Layout terdeteksi" : "Scan layout kitchen set"}
              </span>
              <span className="block text-xs font-normal text-muted-foreground">
                {scanning
                  ? "Tunggu sebentar"
                  : scanned
                    ? `${spec.shape ? SHAPE_LABEL[spec.shape] : ""} · ${modules.length} modul — tap untuk scan ulang`
                    : "Dari foto After & catatan konsultasi"}
              </span>
            </span>
          </Button>
          {!scanned && !scanning && (
            <p className="text-xs text-muted-foreground">Isian spek material muncul setelah scan.</p>
          )}
        </div>
      )}
      {review && (
        <div className="space-y-3 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">
              Rekap spek material — {specVersionLabel(review.version)}
            </p>
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs text-primary">Data master</span>
          </div>
          <dl className="divide-y divide-border/60 text-sm">
            {specReviewRows(review).map((r) => (
              <div key={r.label} className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="min-w-0 whitespace-pre-line break-words text-foreground">{r.value || "—"}</dd>
              </div>
            ))}
            {modules.some((m) => m.fullCeiling) && (
              <div className="grid grid-cols-[7.5rem_1fr] gap-2 py-1.5">
                <dt className="text-muted-foreground">Kabinet atas</dt>
                <dd className="text-foreground">Full plafon</dd>
              </div>
            )}
          </dl>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
            Edit / revisi spek
          </Button>
        </div>
      )}
      {!review && scanned && (
      <fieldset disabled={busy || saving || scanning} className="space-y-4 disabled:opacity-60">
        <SelectField
          label="Bentuk layout"
          value={spec.shape ?? ""}
          onValueChange={(v) => {
            const shape = SHAPES.find((x) => x === v);
            if (!shape) return;
            setPreview("");
            setSpec((s) => ({ ...s, shape, modules: defaultModules(shape) }));
          }}
          options={SHAPES.map((x) => ({ value: x, label: SHAPE_LABEL[x] }))}
        />
        {modules.some((m) => m.level === "upper") && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={modules.filter((m) => m.level === "upper").every((m) => m.fullCeiling)}
              onCheckedChange={(c) =>
                setSpec((s) => ({
                  ...s,
                  modules: (s.modules ?? []).map((m) => (m.level === "upper" ? { ...m, fullCeiling: !!c } : m)),
                }))
              }
            />
            Kabinet atas full plafon
          </label>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["material", "outside", "inside", "hinge", "slide", "glue"] as const).map((key) => (
            <SelectField
              key={key}
              label={
                {
                  material: "Bahan bodi *",
                  outside: "Finishing luar",
                  inside: "Finishing dalam",
                  hinge: "Engsel",
                  slide: "Rel laci",
                  glue: "Lem HPL *",
                }[key]
              }
              value={spec[key] ?? ""}
              onValueChange={(v) => setValue(key, v)}
              options={SPEC_OPTIONS[key]}
            />
          ))}
        </div>
        <div className="space-y-3 rounded-lg border border-border/60 p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Kode HPL TACO * — tiap kode beda dibeli minimal 1 lembar utuh
          </p>
          {spec.outside !== "duco" && (
            <>
              <TacoCodeField label="Kabinet bawah *" name="hpl-lower" placeholder="TH 1205 FC" {...codeProps("lower")} />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={codes.upperSame} onCheckedChange={(c) => setCodes({ upperSame: !!c })} />
                Kabinet atas sama dengan bawah
              </label>
              {!codes.upperSame && (
                <TacoCodeField label="Kabinet atas *" name="hpl-upper" placeholder="TH 001 AA" {...codeProps("upper")} />
              )}
            </>
          )}
          {spec.outside === "duco" && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Foto sampel warna Duco *</p>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm"
                onChange={(e) => void pickDuco(e.target.files?.[0])}
              />
              {spec.ducoHex && (
                <div className="flex items-center gap-3">
                  <span className="size-10 shrink-0 rounded border border-border" style={{ backgroundColor: spec.ducoHex }} />
                  <span className="text-sm text-muted-foreground">Warna terbaca {spec.ducoHex}</span>
                </div>
              )}
              <TextField
                label="Nama warna (opsional)"
                name="duco-color"
                placeholder="Sage green doff"
                value={spec.ducoColor ?? ""}
                onChange={(e) => setSpec((s) => ({ ...s, ducoColor: e.target.value }))}
              />
            </div>
          )}
          <SelectField
            label="Bahan top table *"
            value={spec.topMaterial ?? "hpl"}
            onValueChange={(v) => {
              const topMaterial = v === "granite" ? "granite" : "hpl";
              if (topMaterial === "granite") setCodes({ top: "" });
              setSpec((s) => ({ ...s, topMaterial }));
              setPreview("");
            }}
            options={[
              { value: "hpl", label: "HPL TACO (pakai kode)" },
              { value: "granite", label: "Granit (vendor batu, bukan HPL)" },
            ]}
          />
          {spec.topMaterial !== "granite" && (
            <TacoCodeField label="Top table *" name="hpl-top" placeholder="TH 001 AA" {...codeProps("top")} />
          )}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={codes.hasAccent} onCheckedChange={(c) => setCodes({ hasAccent: !!c })} />
            Ada aksen / kombinasi warna lain
          </label>
          {codes.hasAccent && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TacoCodeField label="Kode HPL aksen *" name="hpl-accent" placeholder="TH 001 AA" {...codeProps("accent")} />
              <TextField label="Aksen di bagian" name="hpl-accent-note" placeholder="Rak terbuka putih" value={codes.accentNote} onChange={(e) => setCodes({ accentNote: e.target.value })} />
            </div>
          )}
          {sheets.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="font-medium">{sheets.length} motif HPL dipakai:</li>
              {sheets.map((x) => (
                <li key={x.code} className="break-words">
                  {x.code} — {x.parts.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["topLayers", "edge", "handle", "glass", "lighting"] as const).map((key) => (
            <SelectField
              key={key}
              label={{ topLayers: "Top table 1 / 2 lapis *", edge: "Pinggiran *", handle: "Handle *", glass: "Kaca *", lighting: "Lampu *" }[key]}
              value={spec[key] ?? ""}
              onValueChange={(v) => setValue(key, v)}
              options={SPEC_OPTIONS[key]}
            />
          ))}
          {(spec.lighting === "spot" || spec.lighting === "led_spot") && (
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Jumlah titik lampu sorot (pcs) *
              <input
                type="number"
                min={1}
                max={50}
                inputMode="numeric"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={spec.spotlightCount ?? ""}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setPreview("");
                  setSpec((s) => ({ ...s, spotlightCount: Number.isInteger(n) && n >= 1 ? n : undefined }));
                }}
              />
            </label>
          )}
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Aksesori dalam *</p>
          <div className="flex flex-wrap gap-2">
            {(["plain", "selected"] as const).map((mode) => (
              <Button
                key={mode}
                type="button"
                size="sm"
                variant={spec.accessoryMode === mode ? "default" : "outline"}
                onClick={() => {
                  setPreview("");
                  setSpec((s) => ({
                    ...s,
                    accessoryMode: mode,
                    accessories: mode === "plain" ? [] : s.accessories,
                  }));
                }}
              >
                {mode === "plain" ? "Polos (tanpa aksesori)" : "Pakai aksesori"}
              </Button>
            ))}
          </div>
          {spec.accessoryMode === "selected" && ACCESSORIES.map((a) => {
            const chosen = spec.accessories.find((x) => x.id === a.id);
            return (
              <div key={a.id} className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={!!chosen}
                    onCheckedChange={(checked) => {
                      setPreview("");
                      setSpec((s) => ({
                        ...s,
                        accessories: checked
                          ? [...s.accessories, { id: a.id, position: "" }]
                          : s.accessories.filter((x) => x.id !== a.id),
                      }));
                    }}
                  />
                  {a.label}
                </label>
                {chosen && (
                  <TextField
                    label={`Posisi ${a.label}`}
                    name={`pos-${a.id}`}
                    maxLength={300}
                    placeholder="Kabinet bawah ke-2 dari kiri"
                    value={chosen.position}
                    onChange={(e) => {
                      setPreview("");
                      setSpec((s) => ({
                        ...s,
                        accessories: s.accessories.map((x) =>
                          x.id === a.id ? { ...x, position: e.target.value } : x,
                        ),
                      }));
                    }}
                  />
                )}
                {chosen && a.id === "hidrolik" && (
                  <TextField
                    label="Jumlah daun pintu angkat (1 daun = 2 pcs hidrolik)"
                    name="hidrolik-doors"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={20}
                    value={chosen.doors ? String(chosen.doors) : ""}
                    onChange={(e) => {
                      const n = Math.min(20, Math.max(0, Math.floor(Number(e.target.value) || 0)));
                      setPreview("");
                      setSpec((s) => ({
                        ...s,
                        accessories: s.accessories.map((x) =>
                          x.id === a.id ? { ...x, doors: n || undefined } : x,
                        ),
                      }));
                    }}
                  />
                )}
                {chosen?.doors && a.id === "hidrolik" ? (
                  <p className="text-sm text-muted-foreground">Belanja: {chosen.doors * 2} pcs hidrolik</p>
                ) : null}
              </div>
            );
          })}
        </div>
        <TextAreaField
          label="Catatan tampak dalam"
          name="interior-note"
          maxLength={2000}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Rak piring di kabinet atas tepat di atas sink"
        />
      </fieldset>
      )}
      {!review && scanned && missing.length > 0 && (
        <p className="break-words text-xs text-destructive">Belum lengkap: {missing.join(", ")}</p>
      )}
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      )}
      {(outside || preview || side) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {outside && (
            <figure className="space-y-1">
              <figcaption className="text-xs font-medium text-muted-foreground">Final tampak luar</figcaption>
              <img
                src={outside}
                alt={`${name} — final tampak luar`}
                className={`w-full rounded-lg object-contain transition-[filter] ${outsideFinal ? "blur-0" : "blur-2xl"}`}
              />
              {outsideFinal && !busy && (
                <a href={outside} download={`${name}-final-tampak-luar.png`} className="inline-flex items-center gap-1 text-xs text-primary">
                  <Download className="size-3" /> Download
                </a>
              )}
            </figure>
          )}
          {preview && (
            <figure className="space-y-1">
              <figcaption className="text-xs font-medium text-muted-foreground">Final tampak dalam</figcaption>
              <img
                src={preview}
                alt={`${name} — pintu terbuka`}
                className={`w-full rounded-lg object-contain transition-[filter] ${final ? "blur-0" : "blur-2xl"}`}
              />
              {final && !busy && (
                <a href={preview} download={`${name}-final-tampak-dalam.png`} className="inline-flex items-center gap-1 text-xs text-primary">
                  <Download className="size-3" /> Download
                </a>
              )}
            </figure>
          )}
          {side && (
            <figure className="space-y-1">
              <figcaption className="text-xs font-medium text-muted-foreground">Tampak dalam serong 3/4 (rel & engsel)</figcaption>
              <img
                src={side}
                alt={`${name} — serong 3/4`}
                className={`w-full rounded-lg object-contain transition-[filter] ${sideFinal ? "blur-0" : "blur-2xl"}`}
              />
              {sideFinal && !busy && (
                <a href={side} download={`${name}-tampak-dalam-serong.png`} className="inline-flex items-center gap-1 text-xs text-primary">
                  <Download className="size-3" /> Download
                </a>
              )}
            </figure>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {!review && scanned && (
          <>
            <Button disabled={busy || saving || missing.length > 0} onClick={() => void save()}>
              <Save className="size-4" />
              {saving ? "Menyimpan…" : "Simpan data spek master"}
            </Button>
            {saved && (
              <Button variant="ghost" onClick={() => { setSpec(saved); setEditing(false); }}>
                Batal
              </Button>
            )}
          </>
        )}
        {review && (
          <>
            <Button disabled={busy || saving} onClick={() => void generate("exterior")}>
              <Wand2 className="size-4" />
              {view === "exterior" ? "Menerapkan spek…" : outside ? "Buat ulang tampak luar (AI)" : "Buat tampak luar (AI)"}
            </Button>
            <Button disabled={busy || saving} onClick={() => void generate("interior")}>
              <Wand2 className="size-4" />
              {view === "interior" ? "Membuat 2 sudut tampak dalam…" : preview ? "Buat ulang tampak dalam — 2 sudut (AI)" : "Buat tampak dalam — 2 sudut (AI)"}
            </Button>
          </>
        )}
      </div>
      {review && (
        <p className="text-xs text-muted-foreground">
          Tampak luar menerapkan spek yang terlihat (HPL, kaca, handle, lampu) tanpa mengubah Before/After di atas. Gambar opsional (pakai kredit AI) dan hanya mengikuti {specVersionLabel(review.version)}. Ukuran tetap dari ukur workshop.
        </p>
      )}
    </div>
  );
}
