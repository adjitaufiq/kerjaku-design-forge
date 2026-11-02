import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FRONT_LABEL, FRONT_TYPES, layoutCounts, type FrontLayout, type FrontType } from "@/lib/interior-spec";

type Row = "upper" | "lower";
const ROW_LABEL: Record<Row, string> = { upper: "Kabinet atas", lower: "Kabinet bawah" };

/** Workshop types each column left-to-right, fronts top-to-bottom; the AI prompt follows this exactly. */
export function FrontLayoutEditor({ value, onChange }: { value: FrontLayout | undefined; onChange: (v: FrontLayout) => void }) {
  const layout: FrontLayout = value ?? { upper: [], lower: [] };
  const set = (row: Row, cols: FrontLayout["upper"]) => onChange({ ...layout, [row]: cols });
  const c = layoutCounts(layout);
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">Struktur pintu per kolom</p>
        <p className="text-xs text-muted-foreground">Isi dari kiri ke kanan sesuai celah pintu di foto After. Dalam satu kolom, isi dari atas ke bawah.</p>
      </div>
      {(["upper", "lower"] as const).map((row) => {
        const cols = layout[row];
        return (
          <div key={row} className="space-y-2">
            <p className="text-xs font-semibold">{ROW_LABEL[row]} · {cols.length} kolom</p>
            {cols.map((col, i) => (
              <div key={i} className="space-y-1 rounded-md bg-muted/50 p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">Kolom {i + 1}</span>
                  <Button type="button" size="icon" variant="ghost" className="size-7" aria-label={`Hapus kolom ${i + 1}`} onClick={() => set(row, cols.filter((_, j) => j !== i))}>
                    <X className="size-3" />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {col.fronts.map((f, k) => (
                    <button
                      key={k}
                      type="button"
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                      onClick={() => {
                        const fronts = col.fronts.filter((_, j) => j !== k);
                        set(row, fronts.length ? cols.map((x, j) => (j === i ? { fronts } : x)) : cols.filter((_, j) => j !== i));
                      }}
                    >
                      {FRONT_LABEL[f]} <X className="size-3" />
                    </button>
                  ))}
                  {col.fronts.length < 8 && (
                    <select
                      aria-label={`Tambah bagian ke kolom ${i + 1}`}
                      className="rounded-full border bg-background px-2 py-0.5 text-xs"
                      value=""
                      onChange={(e) => {
                        const f = e.target.value as FrontType;
                        if (f) set(row, cols.map((x, j) => (j === i ? { fronts: [...x.fronts, f] } : x)));
                      }}
                    >
                      <option value="">+ bagian di bawahnya</option>
                      {FRONT_TYPES.map((t) => <option key={t} value={t}>{FRONT_LABEL[t]}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
            {cols.length < 16 && (
              <Button type="button" size="sm" variant="outline" onClick={() => set(row, [...cols, { fronts: ["swing"] }])}>
                <Plus className="size-3" /> Kolom {ROW_LABEL[row].toLowerCase()}
              </Button>
            )}
          </div>
        );
      })}
      {c.swing + c.drawers + c.lift > 0 && (
        <p className="text-xs text-muted-foreground">
          Total: {c.swing} pintu swing → engsel {c.hingeSets} set ({c.hingeSets * 2} pcs) · {c.drawers} laci → rel {c.slideSets} set · {c.lift} pintu angkat → hidrolik {c.gasSpringPcs} pcs
        </p>
      )}
    </div>
  );
}
