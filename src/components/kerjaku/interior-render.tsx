import { useEffect, useRef, useState } from "react";
import { Download, ScanSearch, Save, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import {
  ACCESSORIES,
  defaultModules,
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
  const setValue = (key: "material" | "outside" | "inside" | "hinge" | "slide", value: string) => {
    const selected = specHintsSchema.shape[key].parse(value);
    setSpec((s) => ({ ...s, [key]: selected }));
    setPreview("");
  };
__MIDDLE__
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Aksesori dalam</p>
          {ACCESSORIES.map((a) => {
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
        <Button disabled={busy || saving} onClick={() => void generate()}>
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

        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Aksesori dalam</p>
          {ACCESSORIES.map((a) => {
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
        <Button disabled={busy || saving} onClick={() => void generate()}>
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
