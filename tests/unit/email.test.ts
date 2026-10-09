import { describe, expect, it } from "vitest";
import { isEmail, suggestEmail } from "@/lib/email";

describe("email validation", () => {
  it.each(["jana@seznam.cz", "a.b+c@firma.co.uk"])("accepts %s", (e) => expect(isEmail(e)).toBe(true));
  it.each(["", "jana", "jana@", "jana@seznam", "ja na@seznam.cz"])("rejects %j", (e) => expect(isEmail(e)).toBe(false));
});

describe("typo suggestion", () => {
  it.each([
    ["jana@sezanm.cz", "jana@seznam.cz"],
    ["jana@seznam.com", "jana@seznam.cz"],
    ["jana@gmail.cz", "jana@gmail.com"],
    ["jana@gmial.com", "jana@gmail.com"],
    ["jana@centrum.c", "jana@centrum.cz"],
  ])("%s -> %s", (typed, expected) => expect(suggestEmail(typed)).toBe(expected));

  it.each(["jana@seznam.cz", "jana@email.cz", "jana@mojefirma.cz"])("leaves %s alone", (e) => expect(suggestEmail(e)).toBeNull());
});
