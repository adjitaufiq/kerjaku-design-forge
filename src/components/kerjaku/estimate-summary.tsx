import { Calculator, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EstimatePayload } from "@/lib/material-estimator";
import { formatIDR } from "@/services/domain/models";

const label = (k: string) => k.replace(/_/g, " ");

export function EstimateSummary({ estimate }: { estimate: EstimatePayload }) {
  const sheets = Object.entries(estimate.summary?.sheetCount ?? {});
  const hardware = Object.entries(estimate.summary?.hardwareCount ?? {});
  const shop = Array.isArray(estimate.shoppingList) ? estimate.shoppingList : [];
  const cost = estimate.estimatedMaterialCost ?? estimate.materialCost;
  const days = estimate.summary?.estimatedDays ?? estimate.workdays;
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Calculator className="size-3.5" /> Estimasi material · {estimate.status ?? "—"}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {cost != null ? formatIDR(cost) : "—"}
        </span>
      </div>
      {(sheets.length > 0 || hardware.length > 0) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ["Lembaran", sheets],
            ["Hardware", hardware],
          ].map(([title, rows]) => (
            <div key={title as string}>
              <p className="mb-1 tracking-wide text-muted-foreground uppercase">
                {title as string}
              </p>
              {(rows as [string, number][]).map(([k, v]) => (
                <div key={k} className="flex justify-between capitalize">
                  <span className="text-muted-foreground">{label(k)}</span>
                  <span className="shrink-0 text-foreground">
                    {Math.round(Number(v) * 10) / 10}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {shop.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 tracking-wide text-muted-foreground uppercase">Daftar belanja TACO (HET)</p>
          {shop.map((it, i) => (
            <div key={i} className="flex justify-between gap-2 border-b border-border/50 py-1 last:border-0">
              <span className="min-w-0 break-words text-foreground">
                {it.name}
                {it.code ? ` · ${it.code}` : ""}
                <span className="block text-muted-foreground">
                  {Math.round(Number(it.qty) * 10) / 10} {it.unit ?? ""}
                  {it.unitPrice != null ? ` × ${formatIDR(it.unitPrice)}` : ""}
                </span>
              </span>
              <span className="shrink-0 text-foreground">
                {it.subtotal != null ? formatIDR(it.subtotal) : ""}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
        <span>
          {days ? `±${days} hari kerja` : ""}
        </span>
        {estimate.deepLinkUrl && (
          <Button variant="ghost" size="sm" asChild>
            <a href={estimate.deepLinkUrl} target="_blank" rel="noopener noreferrer">
              Rincian cut-list & RAB <ExternalLink className="size-3" />
            </a>
          </Button>
        )}
      </div>
    </div>
  );
}
