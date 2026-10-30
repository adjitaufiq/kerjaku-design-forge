import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { specHintsSchema, type SpecHints } from "@/lib/interior-spec";

const CHAT_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const SCAN_MODEL = "openai/gpt-6-astra";

const str = { type: "string" };
const schema = {
  type: "object",
  additionalProperties: false,
  required: ["outside", "inside", "hinge", "slide", "shape", "modules", "accessories"],
  properties: {
    outside: { type: "string", enum: ["hpl", "hpl_premium", "duco"] },
    inside: { type: "string", enum: ["blockmin", "tacosheet", "hpl"] },
    hinge: { type: "string", enum: ["slowmo", "biasa"] },
    slide: { type: "string", enum: ["dt_slowmo", "dt_biasa", "push", "tandem"] },
    shape: { type: "string", enum: ["single", "L", "U"] },
    modules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "level", "side", "fullCeiling", "finish", "contents"],
        properties: {
          label: str,
          level: { type: "string", enum: ["lower", "upper", "tall"] },
          side: { type: "string", enum: ["main", "wing", "wing2"] },
          fullCeiling: { type: "boolean" },
          finish: str,
          contents: str,
        },
      },
    },
    accessories: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "position"],
        properties: {
          id: {
            type: "string",
            enum: ["rak-piring", "rak-gelas", "rak-sayur", "rak-bumbu", "tray-sendok"],
          },
          position: str,
        },
      },
    },
  },
};

export const scanInterior = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string; summary?: string }) => {
    if (!input?.image?.startsWith("data:image")) throw new Error("Foto After tidak terbaca");
    return { image: input.image, summary: String(input.summary ?? "").slice(0, 4000) };
  })
  .handler(async ({ data: input }): Promise<SpecHints> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI belum dikonfigurasi.");
    const instruction = [
      "Kamu drafter kitchen set/lemari. Lihat foto After yang disetujui klien dan ringkasan konsultasi.",
      "Tentukan shape: single (lurus), L (siku), atau U.",
      "Pecah menjadi modul kabinet nyata. single: Kabinet bawah + Kabinet atas. L: Kabinet bawah (sisi utama), Kabinet bawah (sayap L), Kabinet atas (sisi utama), Kabinet atas (sayap L). Tambahkan kabinet tinggi (level tall) hanya jika terlihat.",
      "fullCeiling true hanya jika kabinet atas di foto benar-benar menyentuh plafon atau ringkasan memintanya.",
      "finish: motif/warna luar per modul dari foto & ringkasan (sebut kode HPL jika ada di ringkasan, misal TACO TH 887 JG). Jangan mengarang kode.",
      "contents: isi dalam modul dalam Bahasa Indonesia sesuai yang terlihat, misal 'pintu swing bawah sink, siphon', 'modul kompor', '3 laci susun di tengah', 'rak terbuka bumbu'.",
      "accessories: centang rak-piring (posisi kabinet atas tepat di atas sink jika ada sink), tray-sendok + rel laci jika ada laci, rak-bumbu jika ada rak bumbu/terbuka. position wajib diisi, menyebut modul dihitung dari kiri.",
      "slide dt_slowmo jika ada laci. hinge slowmo. outside hpl kecuali terlihat cat duco. inside blockmin kecuali disebut lain.",
      "DILARANG menulis ukuran/angka cm. Ini draft yang akan direview workshop.",
      `Ringkasan konsultasi: ${input.summary || "-"}`,
    ].join("\n");
    const res = await fetch(CHAT_GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: SCAN_MODEL,
        reasoning_effort: "low",
        response_format: {
          type: "json_schema",
          json_schema: { name: "interior_scan", strict: true, schema },
        },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: instruction },
              { type: "image_url", image_url: { url: input.image } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("AI sedang sibuk, coba lagi sebentar.");
      if (res.status === 402) throw new Error("Kredit AI habis. Tambah kredit untuk lanjut.");
      if (res.status === 403) throw new Error("Akses AI diblokir untuk workspace ini.");
      throw new Error(`Scan gagal (${res.status})`);
    }
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const raw = payload.choices?.[0]?.message?.content ?? "";
    let json: Record<string, unknown>;
    try {
      json = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error("Hasil scan tidak terbaca, coba scan ulang.");
    }
    const strip = (s: string) => s.replace(/\d+([.,]\d+)?\s*(cm|mm|m)\b/gi, "").trim();
    const mods = Array.isArray(json["modules"]) ? (json["modules"] as Record<string, unknown>[]) : [];
    const acc = Array.isArray(json["accessories"])
      ? (json["accessories"] as { id: string; position: string }[])
      : [];
    const seen = new Set<string>();
    const parsed = specHintsSchema.safeParse({
      ...json,
      modules: mods.slice(0, 12).map((m) => ({
        ...m,
        label: String(m["label"] ?? "Kabinet").slice(0, 80),
        finish: strip(String(m["finish"] ?? "")).slice(0, 160),
        contents: strip(String(m["contents"] ?? "")).slice(0, 300),
      })),
      accessories: acc
        .filter((a) => !seen.has(a.id) && seen.add(a.id))
        .map((a) => ({ id: a.id, position: strip(a.position || "Sesuai foto").slice(0, 300) || "Sesuai foto" })),
    });
    if (!parsed.success) throw new Error("Hasil scan tidak lengkap, coba scan ulang.");
    return parsed.data;
  });
