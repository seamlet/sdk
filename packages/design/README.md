# @seamlet/design

The design tokens and fonts of Seamlet: the one source for the look of the landing page (seamlet.ru) and the CMS (cms.seamlet.ru). A site that uses Seamlet does not need this package; its look is its own.

## What is inside

- `@seamlet/design/tokens.css` — every token as a CSS custom property `--sl-…` on `:root`: colors and shadows for the light and the dark theme, type, spacing, radii, sizes, motion and layers. The theme follows the system (`prefers-color-scheme`); `data-theme="light"` or `data-theme="dark"` on the root element wins over it. Under `prefers-reduced-motion: reduce` every `--sl-duration-…` is `0ms`.
- `@seamlet/design/fonts.css` — `@font-face` for Wix Madefor Display, Wix Madefor Text and JetBrains Mono, variable, Cyrillic and Latin only, `font-display: swap`. The font files come with the package, so a page serves them itself and needs no font host in its Content-Security-Policy. The fonts are under the SIL Open Font License 1.1 (the license files are next to them).
- `@seamlet/design` — the same tokens as values for code (`colors`, `durations`, `breakpoints`, …) and `contrastRatio` (WCAG 2.2).

```css
@import "@seamlet/design/fonts.css";
@import "@seamlet/design/tokens.css";

body {
  background: var(--sl-color-canvas);
  color: var(--sl-color-text);
  font: var(--sl-text-base) / var(--sl-leading-normal) var(--sl-font-text);
}
```

## The look

A white field on a visible grid, black type and one green signal; no rounded corners. The seam — the outline the editor draws around an editable element — is a thin line with square handles in `--sl-color-seam`.

The tokens are written in `src/tokens.ts`; `tokens.css` is generated from them on build. The tests keep every pair of text and ground at 4.5:1 or more and every control edge, seam and focus ring at 3:1 or more, in both themes.
