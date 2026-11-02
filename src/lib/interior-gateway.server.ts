import { createClient } from "@supabase/supabase-js";
import {
  blueprintHash,
  buildExteriorPrompt,
  buildInteriorPrompt,
  layoutCounts,
  specHintsSchema,
  validateInteriorBlueprint,
} from "@/lib/interior-spec";

export async function renderInterior(request: Request): Promise<Response> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) return Response.json({ message: "Silakan login dulu." }, { status: 401 });
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const aiKey = process.env["LOVABLE_API_KEY"];
  if (!url || !key || !aiKey)
    return Response.json({ message: "Konfigurasi AI belum siap." }, { status: 500 });
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
  const { data: user, error: authError } = await client.auth.getUser(token);
  if (authError || !user.user)
    return Response.json({ message: "Sesi berakhir. Login kembali." }, { status: 401 });
  const form = await request.formData();
  let spec;
  try {
    spec = specHintsSchema.parse(JSON.parse(String(form.get("specHints"))));
  } catch {
    return Response.json({ message: "Lengkapi spek dan posisi aksesori." }, { status: 400 });
  }
  const image = form.get("image");
  if (
    !(image instanceof File) ||
    !["image/png", "image/jpeg", "image/webp"].includes(image.type) ||
    image.size > 20 * 1024 * 1024
  )
    return Response.json({ message: "Gunakan foto PNG/JPG/WebP maksimal 20 MB." }, { status: 400 });
  const note = String(form.get("note") ?? "");
  if (note.length > 2000)
    return Response.json({ message: "Catatan maksimal 2.000 karakter." }, { status: 400 });
  const { data: membership } = await client
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) return Response.json({ message: "Workshop belum tersedia." }, { status: 403 });
  // A terminal provider denial is persisted, not reset by a page reload or worker restart.
  const marker = `${membership.workspace_id}/ai-access/interior-denied.json`;
  const { data: denied } = await client.storage.from("kerjaku-assets").download(marker);
  if (denied)
    return new Response(await denied.text(), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  const payload = new FormData();
  payload.set("model", "openai/gpt-image-2.5-sunburst");
  const view = form.get("view");
  if (view !== "exterior") {
    // Backend is the authoritative gate: no interior image without a valid blueprint.
    const gate = validateInteriorBlueprint(spec.frontLayout);
    if (!gate.valid) return Response.json({ message: gate.error }, { status: 400 });
    const hash = blueprintHash(gate.layout);
    const sent = String(form.get("blueprintHash") ?? "");
    if (sent && sent !== hash)
      return Response.json({ message: "Struktur pintu berubah saat dikirim. Coba lagi." }, { status: 400 });
    const c = layoutCounts(gate.layout);
    console.log(
      `[render-interior] view=${view} generation=${String(form.get("generationId") ?? "")} blueprint=${hash} v=${spec.version ?? "-"} upper=${gate.layout.upper.length} lower=${gate.layout.lower.length} swing=${c.swing} drawers=${c.drawers} lift=${c.lift}`,
    );
  }
  payload.set(
    "prompt",
    view === "exterior"
      ? buildExteriorPrompt(spec, note)
      : buildInteriorPrompt(spec, note, view === "interior_side" ? "side" : "front"),
  );
  payload.set("image", image);
  if (form.get("stream") !== "false") {
    payload.set("stream", "true");
    payload.set("partial_images", "1");
  }
  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${aiKey}` },
    body: payload,
  });
  if (upstream.status === 403) {
    const body = await upstream
      .clone()
      .json()
      .catch(() => null);
    const type = body?.error?.type ?? body?.type;
    if (type === "provider_access_denied" || type === "provider_denied") {
      const message = body?.error?.message ?? body?.message ?? "Akses penyedia AI ditolak.";
      const { error } = await client.storage
        .from("kerjaku-assets")
        .upload(marker, new Blob([JSON.stringify({ message })], { type: "application/json" }), {
          upsert: true,
        });
      if (error) throw new Error("Gagal menyimpan status akses AI; proses dihentikan.");
    }
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store",
    },
  });
}
