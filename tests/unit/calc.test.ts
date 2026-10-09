import { describe, expect, it } from "vitest";
import { compareFees, futureValue } from "@/lib/calc";
import { czk, pct } from "@/lib/format";

describe("fee calculator", () => {
  it("matches the number used in ad A (5 000 Kč, 20 let, 1,9 % vs 0,07 %)", () => {
    const r = compareFees(5000, 20, 1.9, 0.07);
    expect(czk(r.loss)).toBe(czk(466_000));
    expect(Math.round(r.fund / 1000)).toBe(2052);
    expect(Math.round(r.etf / 1000)).toBe(2518);
    expect(r.paid).toBe(1_200_000);
  });

  it("with zero net return, the value is just what was paid in", () => {
    expect(futureValue(1000, 10, 7)).toBe(120_000);
  });

  it("never reports a negative loss when the fund is cheaper", () => {
    expect(compareFees(5000, 20, 0.05, 0.07).loss).toBe(0);
  });

  it("formats Czech style", () => {
    expect(pct(0.07)).toBe("0,07 %");
    expect(czk(466_103).replace(/\s/g, " ")).toBe("466 000 Kč");
  });
});
