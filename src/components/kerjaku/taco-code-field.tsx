import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { TextField } from "@/components/kerjaku/form-fields";
import { Button } from "@/components/ui/button";
import { lookupTacoCode } from "@/lib/taco.functions";
import { normTacoCode, type TacoInfo } from "@/lib/interior-spec";

/** Kode TACO wajib dicek ke katalog resmi; hasil (nama + tekstur) disimpan di spek. */
export function TacoCodeField({
  label,
  name,
  placeholder,
  value,
  info,
  onChange,
  onInfo,
}: {
  label: string;
  name: string;
  placeholder: string;
  value: string;
  info: TacoInfo | undefined;
  onChange: (v: string) => void;
  onInfo: (key: string, info: TacoInfo | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = normTacoCode(value);
  const check = async () => {
    if (!key) {
      setError("Format kode belum benar, contoh TH 1205 FC");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const r = await lookupTacoCode({ data: { code: value } });
      if (r.found) onInfo(key, r.info);
      else {
        onInfo(key, null);
        setError("Kode tidak ada di katalog resmi TACO");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal cek TACO");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            label={label}
            name={name}
            placeholder={placeholder}
            value={value}
            onChange={(e) => {
              setError("");
              onChange(e.target.value);
            }}
            onBlur={() => key && !info && void check()}
          />
        </div>
        <Button type="button" variant="outline" className="h-10 shrink-0" disabled={busy || !value.trim()} onClick={check}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : "Cek TACO"}
        </Button>
      </div>
      {info && (
        <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/40 p-2">
          {info.image && <img src={info.image} alt={info.name} className="size-12 shrink-0 rounded object-cover" />}
          <div className="min-w-0 text-sm">
            <p className="flex items-center gap-1 font-medium break-words">
              <CheckCircle2 className="size-4 shrink-0 text-primary" /> {info.code} — {info.name}
            </p>
            <p className="text-muted-foreground capitalize">{info.texture} · katalog resmi TACO</p>
          </div>
        </div>
      )}
      {error && (
        <p className="flex items-center gap-1 text-sm text-destructive">
          <XCircle className="size-4 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}
