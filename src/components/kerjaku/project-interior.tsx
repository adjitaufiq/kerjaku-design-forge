import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { InteriorRender } from "@/components/kerjaku/interior-render";
import { SelectField } from "@/components/kerjaku/form-fields";
import { INTERIOR_ACTIVITY_TITLE, parseInteriorRecord } from "@/lib/interior-spec";
import { data } from "@/services/data";

export function ProjectInterior({
  workspaceId,
  leadId,
  projectId,
  summary,
}: {
  summary?: string;
  workspaceId: string;
  leadId: string;
  projectId: string;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const query = useQuery({
    queryKey: ["interior-project", projectId],
    queryFn: async () => {
      const [assets, activities] = await Promise.all([
        data.assets.listByProject(projectId),
        data.activities.listByLead(leadId),
      ]);
      const records = activities
        .filter((a) => a.title === INTERIOR_ACTIVITY_TITLE)
        .map((a) => parseInteriorRecord(a.body))
        .filter((r) => r !== null && r.projectId === projectId);
      const interiors = new Set(
        records.flatMap((r) => [r?.interiorAssetId, r?.exteriorAssetId, r?.interiorSideAssetId]),
      );
      return Promise.all(
        assets
          .filter((a) => a.type === "SKETCHUP_RENDER" && !interiors.has(a.id))
          .map(async (a) => {
            const record = records.find((r) => r?.baseAssetId === a.id);
            const inside = assets.find((x) => x.id === record?.interiorAssetId);
            const sideA = assets.find((x) => x.id === record?.interiorSideAssetId);
            const outside = assets.find((x) => x.id === record?.exteriorAssetId);
            return {
              id: a.id,
              image: await data.assets.getViewUrl(a.url),
              record,
              interiorImage: inside ? await data.assets.getViewUrl(inside.url) : null,
              interiorSideImage: sideA ? await data.assets.getViewUrl(sideA.url) : null,
              exteriorImage: outside ? await data.assets.getViewUrl(outside.url) : null,
            };
          }),
      );
    },
  });
  const options = query.data ?? [];
  const current = options.find((o) => o.id === selected) ?? options[0];
  if (query.isPending) return <p className="text-sm text-muted-foreground">Membuka visual…</p>;
  if (query.isError)
    return (
      <p role="alert" className="text-sm text-destructive">
        {query.error.message}
      </p>
    );
  if (!current?.image)
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada render After tersimpan untuk project ini.
      </p>
    );
  return (
    <div className="space-y-4">
      <SelectField
        label="After acuan — pilih yang disetujui klien"
        value={current.id}
        onValueChange={setSelected}
        options={options.map((o, i) => ({ value: o.id, label: `After ${options.length - i}` }))}
      />
      <img
        src={current.image}
        alt="After acuan"
        className="max-h-72 w-full rounded-lg object-contain"
      />
      <InteriorRender
        key={current.id}
        image={current.image}
        name="Tampak dalam"
        summary={summary}
        initialSpec={current.record?.specHints}
        interiorImage={current.interiorImage ?? undefined}
        interiorSideImage={current.interiorSideImage ?? undefined}
        exteriorImage={current.exteriorImage ?? undefined}
        onSave={async (specHints, image, exterior, side) => {
          const keep = async (url: string | undefined, prev: string | null, id: string | undefined, file: string) => {
            if (!url) return undefined;
            if (url === prev) return id;
            const blob = await (await fetch(url)).blob();
            return (
              await data.assets.upload(workspaceId, projectId, "SKETCHUP_RENDER", new File([blob], file, { type: blob.type }))
            ).id;
          };
          const interiorAssetId = await keep(image, current.interiorImage, current.record?.interiorAssetId, "final-tampak-dalam.png");
          const interiorSideAssetId = await keep(side, current.interiorSideImage, current.record?.interiorSideAssetId, "final-tampak-dalam-serong.png");
          const exteriorAssetId = await keep(exterior, current.exteriorImage, current.record?.exteriorAssetId, "final-tampak-luar.png");
          await data.activities.log(workspaceId, {
            leadId,
            type: "NOTE",
            title: INTERIOR_ACTIVITY_TITLE,
            body: JSON.stringify({
              projectId,
              baseAssetId: current.id,
              ...(interiorAssetId ? { interiorAssetId } : {}),
              ...(interiorSideAssetId ? { interiorSideAssetId } : {}),
              ...(exteriorAssetId ? { exteriorAssetId } : {}),
              specHints,
            }),
          });
          await qc.invalidateQueries({ queryKey: ["interior-project", projectId] });
          await qc.invalidateQueries({ queryKey: ["activities", leadId] });
        }}
      />
    </div>
  );
}
