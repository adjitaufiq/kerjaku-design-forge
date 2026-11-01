import { describe, expect, it } from "vitest";

import { buyQty, normalizeShopItem, shopGroup } from "./estimate-display";

describe("pembelian bahan satuan utuh", () => {
  it("3,2 lembar dibeli 4 lembar", () => expect(buyQty(3.2, "lembar")).toBe(4));
  it("10,4 meter list dibeli 11 meter", () => expect(buyQty(10.4, "m'")).toBe(11));
  it("subtotal dihitung dari qty utuh", () =>
    expect(normalizeShopItem({ name: "PVC Board 18mm", qty: 3.2, unit: "lembar", unitPrice: 420000 }).subtotal).toBe(1680000));
  it("kaca gelap masuk finishing", () => expect(shopGroup({ name: "Kaca Tempered Dark" })).toBe("Finishing Khusus & List"));
});
