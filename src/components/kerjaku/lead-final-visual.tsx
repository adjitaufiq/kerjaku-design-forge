import { useQuery } from "@tanstack/react-query";
import {
  INTERIOR_ACTIVITY_TITLE,
  parseInteriorRecord,
  specReviewRows,
  specVersionLabel,
} from "@/lib/interior-spec";
import { data } from "@/services/data";

/** Clean lead view: final exterior, final interior and the material recap of one project. */
export function LeadFinalVisual({ leadId, projectId }: { leadId: string; projectId: string }) {
  const query = useQuery({
    queryKey: ["interior-project-final", projectId],
    queryFn: async () => {
      const [assets, activities] = await Promise.all([
        data.assets.listByProject(projectId),
        data.activities.listByLead(leadId),
      ]);
      const record = activities
        .filter((a) => a.title === INTERIOR_ACTIVITY_TITLE)
        .map((a) => parseInteriorRecord(a.body))
        .find((r) => r !== null && r.projectId === projectId);
      const url = async (id?: string) => {
        const a = id ? assets.find((x) => x.id === id) : undefined;
        return a ? data.assets.getViewUrl(a.url) : null;
      };
      const fallback = assets.find((a) => a.type === "SKETCHUP_RENDER");
      const outside =
        (await url(record?.exteriorAssetId)) ??
        (await url(record?.baseAssetId)) ??
        (fallback ? await data.assets.getViewUrl(fallback.url) : null);
      return {
        record,
        outside,
        inside: await url(record?.interiorAssetId),
        side: await url(record?.interiorSideAssetId),
      };
    },
  });
  if (query.isPending) return <p className="text-sm text-muted-foreground">Membuka visual…</p>;
  if (query.isError || !query.data)
    return <p className="text-sm text-destructive">Visual gagal dibuka</p>;
  const { record, outside, inside, side } = query.data;
  const rows = record?.specHints ? specReviewRows(record.specHints) : [];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          ["Final tampak luar", outside],
          ["Tampak dalam depan", inside],
          ["Tampak dalam serong 3/4", side],
        ].map(([label, src]) => (
          <figure key={label} className="min-w-0">
            <figcaption className="mb-1 text-xs text-muted-foreground">{label}</figcaption>
            {src ? (
              <a href={src} target="_blank" rel="noreferrer">
                <img
                  src={src}
                  alt={label ?? ""}
                  className="aspect-[4/5] w-full rounded-lg object-cover"
                />
              </a>
            ) : (
              <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                Belum ada
              </div>
            )}
          </figure>
        ))}
      </div>
      {rows.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface/40 p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            Rekap spek material — {specVersionLabel(record?.specHints?.version)}
          </p>
          <dl className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.label} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
                <dt className="text-muted-foreground">{r.label}</dt>
                <dd className="min-w-0 break-words whitespace-pre-line text-foreground">
                  {r.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Spek material belum disimpan.</p>
      )}
    </div>
  );
}
