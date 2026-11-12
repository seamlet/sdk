import { describe, expect, it } from "vitest";
import {
  contentDecisionOf,
  copyIssuesWarning,
  isCopyOnly,
  publishedOn,
  readContentCopy,
} from "./content-copies";

const problem = new Error("the CMS did not answer");

describe("contentDecisionOf", () => {
  it("shows what the CMS published", () => {
    const decision = contentDecisionOf(
      { status: "published", content: { title: "Кофейня" } },
      true,
    );

    expect(decision).toEqual({ source: "cms", content: { title: "Кофейня" } });
  });

  it("shows the initial content of a site the CMS does not know, copy or not", () => {
    expect(contentDecisionOf({ status: "unknown-site" }, true)).toEqual({
      source: "initial",
    });
    expect(contentDecisionOf({ status: "unknown-site" }, false)).toEqual({
      source: "initial",
    });
  });

  it("falls back to the copy when the CMS cannot answer and the site has one", () => {
    const answer = { status: "unavailable", problem } as const;

    expect(contentDecisionOf(answer, true)).toEqual({
      source: "copy",
      problem,
    });
  });

  it("stops the build when the CMS cannot answer and the site has no copy", () => {
    const answer = { status: "unavailable", problem } as const;

    expect(contentDecisionOf(answer, false)).toEqual({
      source: "stop",
      problem,
    });
  });
});

describe("isCopyOnly", () => {
  it("is on for copy only", () => {
    expect(isCopyOnly("copy")).toBe(true);
  });

  it("is off when the variable is unset or empty", () => {
    expect(isCopyOnly(undefined)).toBe(false);
    expect(isCopyOnly("")).toBe(false);
  });

  it("refuses any other value rather than guess", () => {
    expect(() => isCopyOnly("cms")).toThrow(/SEAMLET_CONTENT is "cms"/u);
  });
});

describe("readContentCopy", () => {
  const copy = {
    site: "my-site",
    version: 3,
    publishedAt: "2026-11-01T10:00:00.000Z",
    content: { title: "Кофейня" },
  };

  it("reads what the CMS commits", () => {
    expect(readContentCopy(JSON.stringify(copy), "my-site")).toEqual({
      content: { title: "Кофейня" },
      publishedAt: "2026-11-01T10:00:00.000Z",
    });
  });

  it("reads a copy that does not say when it was published", () => {
    const withoutDate = { ...copy, publishedAt: undefined };
    const read = readContentCopy(JSON.stringify(withoutDate), "my-site");

    expect(read.publishedAt).toBeUndefined();
    expect(publishedOn(read)).toBe("at an unknown date");
  });

  it("says the date it was published on", () => {
    expect(publishedOn(readContentCopy(JSON.stringify(copy), "my-site"))).toBe(
      "on 2026-11-01T10:00:00.000Z",
    );
  });

  it("refuses a text that is not JSON", () => {
    expect(() => readContentCopy("{", "my-site")).toThrow(
      "seamlet/content.json is not JSON",
    );
  });

  it("refuses JSON that is not an object", () => {
    expect(() => readContentCopy("[]", "my-site")).toThrow(
      "seamlet/content.json is not an object",
    );
  });

  it("refuses the copy of another site", () => {
    expect(() =>
      readContentCopy(JSON.stringify({ ...copy, site: "cafe" }), "my-site"),
    ).toThrow('is the copy of "cafe", not of "my-site"');
    expect(() =>
      readContentCopy(JSON.stringify({ content: {} }), "my-site"),
    ).toThrow("is the copy of no site");
  });

  it("refuses a copy without content", () => {
    expect(() =>
      readContentCopy(JSON.stringify({ ...copy, content: 5 }), "my-site"),
    ).toThrow("has no `content` object");
  });
});

describe("copyIssuesWarning", () => {
  it("says nothing of a copy that fits the schema", () => {
    expect(copyIssuesWarning([])).toBeUndefined();
  });

  it("names the fields that do not fit, a few of them", () => {
    const issues = Array.from({ length: 7 }, (_, index) => ({
      path: ["menu", index, "price"],
      code: "invalid-type" as const,
    }));

    const warning = copyIssuesWarning(issues);

    expect(warning).toContain("menu.0.price (invalid-type)");
    expect(warning).toContain("and 2 more");
    expect(warning).not.toContain("menu.6.price");
  });
});
