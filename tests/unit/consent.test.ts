import { describe, expect, it } from "vitest";
import { CONSENT_TEXTS, CURRENT_CONSENT, consentText } from "@/lib/consent";

describe("marketing consent wording", () => {
  it("resolves the current version to its exact text", () => {
    expect(consentText(CURRENT_CONSENT.version)).toBe(CURRENT_CONSENT.text);
  });
  it("rejects unknown versions", () => {
    expect(consentText("made-up")).toBeNull();
  });
  it("has unique versions and says how to withdraw", () => {
    expect(new Set(CONSENT_TEXTS.map((c) => c.version)).size).toBe(CONSENT_TEXTS.length);
    for (const c of CONSENT_TEXTS) expect(c.text).toMatch(/odvolat/);
  });
});
