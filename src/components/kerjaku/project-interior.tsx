import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { InteriorRender } from "@/components/kerjaku/interior-render";
import { SelectField } from "@/components/kerjaku/form-fields";
import { INTERIOR_ACTIVITY_TITLE, parseInteriorRecord } from "@/lib/interior-spec";
import { data } from "@/services/data";

export function ProjectInterior({ workspaceId, leadId, projectId }: { workspaceId: string; leadId: string; projectId: string }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState("");
  const query = useQuery({
    queryKey: ["interior-project", projectId],
    queryFn: async () => {
      const [assets, activities] = await Promise.all([data.assets.listByProject(projectId), data.activities.listByLead(leadId)]);
      const records = activities.filter(a => a.title === INTERIOR_ACTIVITY_TITLE).map(a => parseInteriorRecord(a.body)).filter(r => r !== null && r.projectId === projectId);
      const interiors = new Set(records.map(r => r?.interiorAssetId));
      return Promise.all(assets.filter(a => a.type === "SKETCHUP_RENDER" && !interiors.has(a.id)).map(async a => {
        const record = records.find(r => r?.baseAssetId === a.id);
        const inside = assets.find(x => x.id === record?.interiorAssetId);
        return { id: a.id, image: await data.assets.getViewUrl(a.url), record, interiorImage: inside ? await data.assets.getViewUrl(inside.url) : null };
      }));
    },
  });
  const options = query.data ?? [];
  const current = options.find(o => o.id === selected) ?? options[0];
  if (query.isPending) return <p className="text-sm text-muted-foreground">Membuka visual…</p>;
  if (query.isError) return <p role="alert" className="text-sm text-destructive">{query.error.message}</p>;
  if (!current?.image) return <p className="text-sm text-muted-foreground">Belum ada render After tersimpan untuk project ini.</p>;
  return <div className="space-y-4">
    <SelectField label="After acuan — pilih yang disetujui klien" value={current.id} onValueChange={setSelected} options={options.map((o, i) => ({ value: o.id, label: `After ${options.length - i}` }))} />
    <img src={current.image} alt="After acuan" className="max-h-72 w-full rounded-lg object-contain" />
    <InteriorRender key={current.id} image={current.image} name="Tampak dalam" initialSpec={current.record?.specHints} interiorImage={current.interiorImage ?? undefined} onSave={async (specHints, image) => {
      let interiorAssetId = current.record?.interiorAssetId;
      if (image && image !== current.interiorImage) {
        const blob = await (await fetch(image)).blob();
        interiorAssetId = (await data.assets.upload(workspaceId, projectId, "SKETCHUP_RENDER", new File([blob], "interior.png", { type: blob.type }))).id;
      }
      await data.activities.log(workspaceId, { leadId, type: "NOTE", title: INTERIOR_ACTIVITY_TITLE, body: JSON.stringify({ projectId, baseAssetId: current.id, ...(image && interiorAssetId ? { interiorAssetId } : {}), specHints }) });
      await qc.invalidateQueries({ queryKey: ["interior-project", projectId] });
      await qc.invalidateQueries({ queryKey: ["activities", leadId] });
    }} />
  </div>;
}