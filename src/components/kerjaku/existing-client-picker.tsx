import { useQuery } from "@tanstack/react-query";

import { data } from "@/services/data";
import type { Lead } from "@/services/domain/models";

/** Toggle between "Klien baru" and an existing client from Leads. */
export function ExistingClientPicker({
  workspaceId,
  value,
  onChange,
}: {
  workspaceId: string | null;
  value: string | null;
  onChange: (lead: Lead | null) => void;
}) {
  const leads = useQuery({
    queryKey: ["leads", workspaceId],
    queryFn: () => data.leads.list(workspaceId!),
    enabled: !!workspaceId,
  });
  const list = leads.data ?? [];
  const mode = value ? "existing" : "new";
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {(["new", "existing"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (m === "new") onChange(null);
              else if (list[0]) onChange(list[0]);
            }}
            disabled={m === "existing" && list.length === 0}
            className={`rounded-xl border px-3 py-2 text-sm transition disabled:opacity-40 ${
              mode === m
                ? "border-primary bg-primary/15 text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {m === "new" ? "+ Klien baru" : "Klien existing"}
          </button>
        ))}
      </div>
      {mode === "existing" && (
        <select
          aria-label="Pilih klien existing"
          className="h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-foreground"
          value={value ?? ""}
          onChange={(e) => onChange(list.find((l) => l.id === e.target.value) ?? null)}
        >
          {list.map((l) => (
            <option key={l.id} value={l.id}>
              {l.clientName}
              {l.location ? ` · ${l.location}` : ""}
              {l.phone ? ` · ${l.phone}` : ""}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
