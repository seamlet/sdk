import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";
import { tokensCss } from "./css";
import { colors, durations, themes, type ColorName } from "./tokens";

// What must stay readable on what (WCAG 2.2 AA): text at 4.5:1, the edges of controls, the seam
// and the focus ring at 3:1 (non-text contrast, 1.4.11).
const textOn: [ColorName, ColorName[]][] = [
  ["text", ["canvas", "surface", "sunken", "raised"]],
  ["muted", ["canvas", "surface", "sunken", "raised"]],
  ["faint", ["canvas", "surface", "raised"]],
  ["accent-text", ["canvas", "surface", "raised", "accent-soft"]],
  ["on-accent", ["accent", "accent-hover"]],
  ["on-inverse", ["inverse", "inverse-hover"]],
  ["danger", ["canvas", "surface", "raised", "danger-soft"]],
  ["warning", ["canvas", "surface", "raised", "warning-soft"]],
  ["success", ["canvas", "surface", "raised", "success-soft"]],
];

const marksOn: [ColorName, ColorName[]][] = [
  ["line-strong", ["canvas", "surface", "sunken", "raised"]],
  ["seam", ["canvas", "surface", "sunken"]],
  ["focus", ["canvas", "surface", "sunken", "raised"]],
  ["accent", ["canvas", "surface"]],
];

describe.each(themes)("the %s theme", (theme) => {
  const palette = colors[theme];

  it.each(textOn)("keeps %s readable as text", (foreground, grounds) => {
    for (const ground of grounds) {
      expect(
        contrastRatio(palette[foreground], palette[ground]),
        `${foreground} on ${ground}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each(marksOn)("keeps %s visible as a mark", (foreground, grounds) => {
    for (const ground of grounds) {
      expect(
        contrastRatio(palette[foreground], palette[ground]),
        `${foreground} on ${ground}`,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("tokens.css", () => {
  const css = tokensCss();

  it("defines every color for the light theme on :root and again for the dark theme", () => {
    for (const name of Object.keys(colors.light)) {
      expect(css.split(`--sl-color-${name}:`)).toHaveLength(4);
    }
  });

  it("follows the system and lets data-theme win over it", () => {
    expect(css).toContain(
      '@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {',
    );
    expect(css).toContain(':root[data-theme="dark"] {');
  });

  it("stops motion for people who ask for less of it", () => {
    const reduced = css.slice(css.indexOf("prefers-reduced-motion"));
    for (const name of Object.keys(durations)) {
      expect(reduced).toContain(`--sl-duration-${name}: 0ms;`);
    }
  });
});
