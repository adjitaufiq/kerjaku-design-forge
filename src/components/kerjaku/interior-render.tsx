import { useState } from "react";
import { Download, Save, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SelectField, TextAreaField, TextField } from "@/components/kerjaku/form-fields";
import { ACCESSORIES, SPEC_OPTIONS, specHintsSchema, type SpecHints } from "@/lib/interior-spec";
import { streamImage } from "@/lib/interior-stream";
import { supabase } from "@/integrations/supabase/client";

export function InteriorRender({
  image,
  name,
  initialSpec,
  interiorImage,
  onSave,
}: {
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
  const setValue = (key: "outside" | "inside" | "hinge" | "slide", value: string) => {
    const selected = specHintsSchema.shape[key].parse(value);
    setSpec((s) => ({ ...s, [key]: selected }));
    setPreview("");
  };
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
      <fieldset disabled={busy || saving} className="space-y-4 disabled:opacity-60">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {(["outside", "inside", "hinge", "slide"] as const).map((key) => (
            <SelectField
              key={key}
              label={
                {
                  outside: "Finishing luar",
                  inside: "Finishing dalam",
                  hinge: "Engsel",
                  slide: "Rel laci",
                }[key]
              }
              value={spec[key]}
              onValueChange={(v) => setValue(key, v)}
              options={SPEC_OPTIONS[key]}
            />
          ))}
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
