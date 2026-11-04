// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { freezeMotion } from "./frozen-motion";

const frozenRules = (): string =>
  [...document.querySelectorAll("style")]
    .map((style) => style.textContent)
    .join("\n");

describe("the motion of a page in the editor", () => {
  let thaw: (() => void) | undefined;

  afterEach(() => {
    thaw?.();
  });

  it("ends every animation and transition at once, and smooths no scrolling", () => {
    thaw = freezeMotion(document);

    const rules = frozenRules();
    expect(rules).toContain("animation-duration: 0s !important");
    expect(rules).toContain("transition-duration: 0s !important");
    expect(rules).toContain("scroll-behavior: auto !important");
  });

  it("lets the motion go again once the editor leaves", () => {
    const release = freezeMotion(document);

    release();

    expect(frozenRules()).not.toContain("animation-duration");
  });
});
