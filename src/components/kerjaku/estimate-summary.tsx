import { Calculator, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { EstimatePayload } from "@/lib/material-estimator";
import { formatIDR } from "@/services/domain/models";

const label = (k: string) => k.replace(/_/g, " ");

export function EstimateSummary({ estimate }: { estimate: EstimatePayload }) {
  const sheets = Object.entries(estimate.summary?.sheetCount ?? {});
  const hardware = Object.entries(estimate.summary?.hardwareCount ?? {});
  return (
    <div className="mt-3 rounded-xl border border-border bg-background/40 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Calculator className="size-3.5" /> Estimasi material · {estimate.status ?? "—"}
        </span>
        <span className="text-sm font-semibold text-foreground">
          {estimate.estimatedMaterialCost != null ? formatIDR(estimate.estimatedMaterialCost) : "—"}
        </span>
      </div>
      {(sheets.length > 0 || hardware.length > 0) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[
            ["Lembaran", sheets],
            ["Hardware", hardware],
          ].map(([title, rows]) => (
            <div key={title as string}>
              <p className="mb-1 tracking-wide text-muted-foreground uppercase">{title as string}</p>
              {(rows as [string, number][]).map(([k, v]) => (
                <div key={k} className="flex justify-between capitalize">
                  <span className="text-muted-foreground">{label(k)}</span>
                  <span className="text-foreground">{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
        <span>
          {estimate.summary?.estimatedDays ? `±${estimate.summary.estimatedDays} hari kerja` : ""}
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
