import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface TacoSwatch {
  code: string;
  name: string;
  link: string;
  image: string; // remote source URL on manage.taco.co.id
}

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

function decode(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").trim();
}

/** Search the TACO catalogue by HPL code (e.g. "887 jg"). */
export const searchTaco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { query: string }) => {
    const q = input?.query?.trim();
    if (!q || q.length > 40) throw new Error("Ketik kode HPL Taco");
    return { query: q };
  })
  .handler(async ({ data }) => {
    const url = `https://taco.co.id/en/search?keywords=${encodeURIComponent(data.query)}&from=%2Fcatalog`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Website Taco tidak merespons (${res.status})`);
    const html = await res.text();
    const out: TacoSwatch[] = [];
    const seen = new Set<string>();
    const parts = html.split('href="/en/products/laminates/').slice(1);
    for (const part of parts) {
      const chunk = part.slice(0, 6000);
      const path = chunk.slice(0, chunk.indexOf('"'));
      const img = /url=(https%3A%2F%2Fmanage\.taco\.co\.id[^&"]+)/.exec(chunk);
      const ps = [...chunk.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map((m) => decode(m[1] ?? ""));
      if (!img || !ps[0]) continue;
      if (seen.has(path)) continue;
      seen.add(path);
      out.push({
        code: ps[0],
        name: ps[1] ?? "",
        link: `https://taco.co.id/en/products/laminates/${path}`,
        image: decodeURIComponent(img[1] ?? "").replace("/thumbnail_", "/"),
      });
      if (out.length >= 12) break;
    }
    // Prefer real HPL sheets (TH ...) before PVC edging
    out.sort((a, b) => Number(b.code.startsWith("TH")) - Number(a.code.startsWith("TH")));
    return { results: out };
  });

/** Download a TACO swatch (resized via their image CDN) as a data URL. */
export const fetchTacoSwatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { image: string }) => {
    if (!/^https:\/\/manage\.taco\.co\.id\/uploads\/[\w.\-%]+$/.test(input?.image ?? ""))
      throw new Error("Gambar Taco tidak valid");
    return input;
  })
  .handler(async ({ data }) => {
    const proxied = `https://taco.co.id/_next/image?url=${encodeURIComponent(data.image)}&w=1080&q=75`;
    let res = await fetch(proxied, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/png" } });
    if (!res.ok) res = await fetch(data.image, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`Gagal ambil motif Taco (${res.status})`);
    const type = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    const bytes = new Uint8Array(await res.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000)
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { dataUrl: `data:${type};base64,${btoa(bin)}` };
  });

/** Validate one HPL / TACO Sheet code against the official catalogue (exact code match). */
export const lookupTacoCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const m = /(\d{3,5})[\s-]*([A-Za-z]{1,3})\b/.exec(input?.code ?? "");
    if (!m) throw new Error("Format kode TACO tidak dikenali");
    return { num: m[1]!, suffix: m[2]!.toUpperCase() };
  })
  .handler(async ({ data }) => {
    const res = await fetch(
      `https://taco.co.id/en/search?keywords=${encodeURIComponent(data.num)}&from=%2Fcatalog`,
      { headers: { "User-Agent": UA } },
    );
    if (!res.ok) throw new Error(`Website TACO tidak merespons (${res.status})`);
    const html = await res.text();
    for (const part of html.split('href="/en/products/laminates/').slice(1)) {
      const chunk = part.slice(0, 6000);
      const path = chunk.slice(0, chunk.indexOf('"'));
      const ps = [...chunk.matchAll(/<p[^>]*>([^<]*)<\/p>/g)].map((x) => decode(x[1] ?? ""));
      const code = ps[0] ?? "";
      const norm = code.toUpperCase().replace(/[\s-]+/g, " ");
      if (!new RegExp(`(^|\\D)${data.num} ${data.suffix}$`).test(norm)) continue;
      // Sheets only (TH = HPL, TS = TACO Sheet); skip edging.
      if (!/^(TH|TS|TI)\b/.test(norm)) continue;
      const img = /url=(https%3A%2F%2Fmanage\.taco\.co\.id[^&"]+)/.exec(chunk);
      const seg = path.split("/");
      const texture = (seg[seg.length - 2] ?? "").replace(/-/g, " ");
      return {
        found: true as const,
        info: {
          code,
          name: ps[1] ?? "",
          texture: texture || "motif",
          image: img ? decodeURIComponent(img[1] ?? "") : undefined,
        },
      };
    }
    return { found: false as const };
  });
