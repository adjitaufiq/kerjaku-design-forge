import { useEffect, useRef, useState } from "react";
import { Download, ScanSearch, Save, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import {
  ACCESSORIES,
  defaultModules,
  hplPurchaseList,
  missingFinalSpec,
  type HplCodes,
  SHAPE_LABEL,
  SHAPES,
  SPEC_OPTIONS,
  specHintsSchema,
  type CabinetModule,
  type SpecHints,
} from "@/lib/interior-spec";
import { scanInterior } from "@/lib/interior-scan.functions";
import { streamImage } from "@/lib/interior-stream";
import { supabase } from "@/integrations/supabase/client";

export function InteriorRender({
  image,
  name,
  initialSpec,
  interiorImage,
  summary,
  onSave,
}: {
  summary?: string | undefined;
  image: string;
  name: string;
  initialSpec?: SpecHints | undefined;
  interiorImage?: string | undefined;
  onSave: (spec: SpecHints, image?: string) => Promise<void>;
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
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const autoRan = useRef(false);
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
      setSpec(result);
      setPreview("");
      setScanned(true);
      toast.success("Spek terisi otomatis — cek dulu sebelum simpan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan gagal");
    } finally {
      setScanning(false);
    }
  };
  useEffect(() => {
    if (!initialSpec && !autoRan.current) {
      autoRan.current = true;
      void scan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const modules = spec.modules ?? [];
  const setModule = (i: number, patch: Partial<CabinetModule>) => {
    setPreview("");
    setSpec((s) => ({
      ...s,
      modules: (s.modules ?? []).map((m, j) => (j === i ? { ...m, ...patch } : m)),
    }));
  };
  const setValue = (
    key: "material" | "outside" | "inside" | "hinge" | "slide" | "glue" | "edge" | "handle" | "glass" | "lighting",
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
  const missing = missingFinalSpec(spec);
  const sheets = hplPurchaseList(spec.hplCodes);
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave(specHintsSchema.parse(spec), preview && final ? preview : undefined);
      toast.success("Spek tersimpan");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan spek");
    } finally {
      setSaving(false);
    }
  };
  const generate = async () => {
    setBusy(true);
    setError("");
    setPreview("");
    setFinal(false);
    try {
      const chosen = specHintsSchema.parse(spec);
      if (missing.length) throw new Error(`Lengkapi dulu: ${missing.join(", ")}`);
      if (scanning) throw new Error("Tunggu scan selesai.");
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("Silakan login kembali.");
      const source = await fetch(image);
      if (!source.ok) throw new Error("Foto After tidak bisa dibuka. Buka ulang data klien.");
      const form = new FormData();
      form.set(
        "image",
        new File([await source.blob()], "after.png", {
          type: source.headers.get("content-type")?.split(";")[0] ?? "image/png",
        }),
      );
      form.set("specHints", JSON.stringify(chosen));
      form.set("note", note);
      let result = "";
      await streamImage(
        "/api/render-interior",
        form,
        (url, done) => {
          setPreview(url);
          setFinal(done);
          if (done) result = url;
        },
        undefined,
        { Authorization: `Bearer ${data.session.access_token}` },
      );
      if (!result) throw new Error("Gambar belum selesai.");
      await onSave(chosen, result);
      toast.success("Tampak dalam tersimpan; After tetap utuh");
    } catch (e) {
      setPreview("");
      setError(e instanceof Error ? e.message : "Gagal membuat tampak dalam");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-foreground">{name}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" disabled={scanning || busy} onClick={() => void scan()}>
          <ScanSearch className="size-4" />
          {scanning ? "Memindai visual…" : "Scan otomatis dari After & summary"}
        </Button>
        {scanned && (
          <span className="text-xs text-muted-foreground">Hasil AI — review &amp; koreksi bila perlu</span>
        )}
      </div>
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
        {modules.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Modul kabinet ({modules.length})</p>
            {modules.map((m, i) => (
              <div key={i} className="space-y-2 rounded-lg border border-border/60 p-3">
                <div className="flex items-center gap-2">
                  <TextField
                    label="Nama modul"
                    name={`mod-${i}`}
                    maxLength={80}
                    value={m.label}
                    onChange={(e) => setModule(i, { label: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus modul"
                    onClick={() =>
                      setSpec((s) => ({ ...s, modules: (s.modules ?? []).filter((_, j) => j !== i) }))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <TextAreaField
                  label="Finishing / HPL (ikut slot kode di bawah)"
                  name={`fin-${i}`}
                  maxLength={160}
                  rows={2}
                  className="[&_textarea]:min-h-0"
                  value={m.finish}
                  onChange={(e) => setModule(i, { finish: e.target.value })}
                />
                <TextAreaField
                  label="Isi dalam"
                  name={`con-${i}`}
                  maxLength={300}
                  rows={3}
                  className="[&_textarea]:min-h-0"
                  value={m.contents}
                  onChange={(e) => setModule(i, { contents: e.target.value })}
                />
                {m.level === "upper" && (
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={m.fullCeiling}
                      onCheckedChange={(c) => setModule(i, { fullCeiling: !!c })}
                    />
                    Full plafon
                  </label>
                )}
              </div>
            ))}
          </div>
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
              <TextField label="Kabinet bawah *" name="hpl-lower" placeholder="TH 5022 NT" value={codes.lower} onChange={(e) => setCodes({ lower: e.target.value })} />
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={codes.upperSame} onCheckedChange={(c) => setCodes({ upperSame: !!c })} />
                Kabinet atas sama dengan bawah
              </label>
              {!codes.upperSame && (
                <TextField label="Kabinet atas *" name="hpl-upper" placeholder="TH 001 AA" value={codes.upper} onChange={(e) => setCodes({ upper: e.target.value })} />
              )}
            </>
          )}
          <TextField label="Top table *" name="hpl-top" placeholder="TH 003 AA" value={codes.top} onChange={(e) => setCodes({ top: e.target.value })} />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={codes.hasAccent} onCheckedChange={(c) => setCodes({ hasAccent: !!c })} />
            Ada aksen / kombinasi warna lain
          </label>
          {codes.hasAccent && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <TextField label="Kode HPL aksen *" name="hpl-accent" placeholder="TH 001 AA" value={codes.accent} onChange={(e) => setCodes({ accent: e.target.value })} />
              <TextField label="Aksen di bagian" name="hpl-accent-note" placeholder="Rak terbuka putih" value={codes.accentNote} onChange={(e) => setCodes({ accentNote: e.target.value })} />
            </div>
          )}
          {sheets.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {sheets.map((x) => (
                <li key={x.code} className="break-words">
                  {x.code} — min. 1 lembar · {x.parts.join(", ")}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["edge", "handle", "glass", "lighting"] as const).map((key) => (
            <SelectField
              key={key}
              label={{ edge: "Pinggiran *", handle: "Handle *", glass: "Kaca *", lighting: "Lampu *" }[key]}
              value={spec[key] ?? ""}
              onValueChange={(v) => setValue(key, v)}
              options={SPEC_OPTIONS[key]}
            />
          ))}
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
      <p className="text-xs text-muted-foreground">
        Konsep visual, bukan gambar kerja. Ukuran tetap dari ukur workshop. Periksa engsel, rel, dan
        posisi aksesori sebelum produksi.
      </p>
      {missing.length > 0 && (
        <p className="break-words text-xs text-destructive">Belum lengkap: {missing.join(", ")}</p>
      )}
      {error && (
        <p role="alert" className="break-words text-sm text-destructive">
          {error}
        </p>
      )}
      {preview && (
        <img
          src={preview}
          alt={`${name} — pintu terbuka`}
          className={`w-full rounded-lg object-contain transition-[filter] ${final ? "blur-0" : "blur-2xl"}`}
        />
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy || saving} onClick={() => void save()}>
          <Save className="size-4" />
          {saving ? "Menyimpan…" : "Simpan spek"}
        </Button>
        <Button disabled={busy || saving || missing.length > 0} onClick={() => void generate()}>
          <Wand2 className="size-4" />
          {busy ? "Membuka kabinet…" : "Buat tampak dalam (AI)"}
        </Button>
        {preview && final && !busy && (
          <Button variant="outline" asChild>
            <a href={preview} download={`${name}-tampak-dalam.png`}>
              <Download className="size-4" />
              Download
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
