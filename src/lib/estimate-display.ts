import type { ShoppingItem } from "@/lib/material-estimator";

/** Kaca dipotong sesuai pesanan per m², selain itu toko jual satuan utuh. */
const isArea = (unit?: string) => /m\s*(2|²)/i.test(unit ?? "");

/** Pembelian bahan selalu dibulatkan ke atas ke satuan utuh (3,2 lembar → 4 lembar). */
export function buyQty(qty: number, unit?: string): number {
  const n = Number(qty) || 0;
  if (isArea(unit)) return Math.round(n * 100) / 100;
  return Math.ceil(n - 1e-9);
}

export type ShopGroup = "Bahan & HPL" | "Finishing Khusus & List" | "Hardware & Aksesoris";
export const SHOP_GROUPS: ShopGroup[] = ["Bahan & HPL", "Finishing Khusus & List", "Hardware & Aksesoris"];

export function shopGroup(it: Pick<ShoppingItem, "name" | "unit">): ShopGroup {
  const s = `${it.name} ${it.unit ?? ""}`.toLowerCase();
  if (/kaca|cermin|mirror|list|profil|gold|edging|tusir|pvc edge/.test(s)) return "Finishing Khusus & List";
  if (/hpl|board|triplek|plywood|multiplek|blockmin|mdf|partikel|lembar|lbr/.test(s)) return "Bahan & HPL";
  return "Hardware & Aksesoris";
}

/** Baris belanja dengan qty utuh dan subtotal dihitung ulang dari qty utuh. */
export function normalizeShopItem(it: ShoppingItem) {
  const qty = buyQty(it.qty, it.unit);
  const subtotal = it.unitPrice != null ? qty * it.unitPrice : it.subtotal;
  return { ...it, qty, subtotal };
}
