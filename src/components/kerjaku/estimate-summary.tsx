import { Calculator, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buyQty, normalizeShopItem, SHOP_GROUPS, shopGroup } from "@/lib/estimate-display";
import type { EstimatePayload } from "@/lib/material-estimator";
import { formatIDR } from "@/services/domain/models";

const label = (k: string) => k.replace(/_/g, " ");

export function EstimateSummary({ estimate }: { estimate: EstimatePayload }) {
  const sheets = Object.entries(estimate.summary?.sheetCount ?? {});
  const hardware = Object.entries(estimate.summary?.hardwareCount ?? {});
  const shop = (Array.isArray(estimate.shoppingList) ? estimate.shoppingList : []).map(normalizeShopItem);
  const shopTotal = shop.reduce((s, it) => s + (it.subtotal ?? 0), 0);
  const cost = shop.length > 0 && shopTotal > 0 ? shopTotal : (estimate.estimatedMaterialCost ?? estimate.materialCost);
  const days = estimate.summary?.estimatedDays ?? estimate.workdays;
  let n = 0;
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 text-sm">
      <p className="flex items-center gap-1.5 font-semibold text-foreground">
        <Calculator className="size-4" /> Estimasi material (SME)
      </p>
      <p className="mt-1 text-muted-foreground">
        Total HPP material: <span className="font-semibold text-foreground">{cost != null ? formatIDR(cost) : "—"}</span>
        {days ? ` · ±${Math.ceil(days)} hari kerja` : ""}
      </p>

      {(sheets.length > 0 || hardware.length > 0) && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Rekap lembaran & hardware</p>
          <div className="grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
            {[...sheets, ...hardware].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 capitalize">
                <span className="min-w-0 break-words text-muted-foreground">{label(k)}</span>
                <span className="shrink-0 text-foreground">{buyQty(Number(v))}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {shop.length > 0 && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Rincian belanja (HET)</p>
          {SHOP_GROUPS.map((g) => {
            const rows = shop.filter((it) => shopGroup(it) === g);
            if (rows.length === 0) return null;
            return (
              <div key={g} className="mt-2">
                <p className="text-xs font-semibold text-foreground">{g}</p>
                {rows.map((it, i) => (
                  <div key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0">
                    <span className="min-w-0 break-words text-foreground">
                      {++n}. {it.name}
                      {it.code ? ` · ${it.code}` : ""}
                      <span className="block text-xs text-muted-foreground">
                        {it.qty} {it.unit ?? ""}
                        {it.unitPrice != null ? ` × ${formatIDR(it.unitPrice)}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-foreground">{it.subtotal != null ? formatIDR(it.subtotal) : ""}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {estimate.deepLinkUrl && (
        <Button variant="outline" size="sm" className="mt-3 w-full" asChild>
          <a href={estimate.deepLinkUrl} target="_blank" rel="noopener noreferrer">
            Buka diagram cut-list di SME <ExternalLink className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}
