import { describe, expect, it } from "vitest";

import { findLeadByPhone, normalizePhone } from "./client-folder";
import type { Lead } from "@/services/domain/models";

describe("client folder", () => {
  it("treats 0812, +62812 and 62812 as the same WhatsApp number", () => {
    expect(normalizePhone("+62 812-3456")).toBe("08123456");
    expect(normalizePhone("628123456")).toBe("08123456");
    expect(normalizePhone("0812 3456")).toBe("08123456");
  });

  it("reuses the existing client with the same WhatsApp number", () => {
    const leads = [{ id: "malla", phone: "0812-111" }] as unknown as Lead[];
    expect(findLeadByPhone(leads, "+62812111")?.id).toBe("malla");
    expect(findLeadByPhone(leads, "0899")).toBeUndefined();
  });
});
