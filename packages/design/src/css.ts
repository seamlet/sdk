// Turns the tokens into the stylesheet `tokens.css`: every token as a custom property `--sl-…` on
// `:root` (except the breakpoints, which a media query cannot read from a property). The theme follows the system; `data-theme="light"` or `"dark"` on the root element wins
// over it. Under `prefers-reduced-motion: reduce` every duration is 0.

import {
  colors,
  durations,
  easings,
  fontFamilies,
  fontSizes,
  fontWeights,
  layers,
  letterSpacings,
  lineHeights,
  radii,
  shadows,
  sizes,
  space,
  type Theme,
} from "./tokens";

type Declarations = Record<string, string>;

function prefixed(
  group: string,
  values: Record<string, string | number>,
): Declarations {
  return Object.fromEntries(
    Object.entries(values).map(([name, value]) => [
      `--sl-${group}-${name}`,
      String(value),
    ]),
  );
}

/** The properties that differ between the themes. */
export function themeDeclarations(theme: Theme): Declarations {
  return {
    ...prefixed("color", colors[theme]),
    ...prefixed("shadow", shadows[theme]),
  };
}

/** The properties both themes share. */
export function sharedDeclarations(): Declarations {
  return {
    ...prefixed("font", fontFamilies),
    ...prefixed("text", fontSizes),
    ...prefixed("weight", fontWeights),
    ...prefixed("leading", lineHeights),
    ...prefixed("tracking", letterSpacings),
    ...prefixed("space", space),
    ...prefixed("radius", radii),
    ...prefixed("size", sizes),
    ...prefixed(
      "duration",
      Object.fromEntries(
        Object.entries(durations).map(([name, ms]) => [
          name,
          `${String(ms)}ms`,
        ]),
      ),
    ),
    ...prefixed("ease", easings),
    ...prefixed("layer", layers),
  };
}

function block(
  selector: string,
  declarations: Declarations,
  indent = "",
): string {
  const lines = Object.entries(declarations).map(
    ([property, value]) => `${indent}  ${property}: ${value};`,
  );
  return `${indent}${selector} {\n${lines.join("\n")}\n${indent}}`;
}

export function tokensCss(): string {
  const dark = { ...themeDeclarations("dark"), "color-scheme": "dark" };
  const zeroDurations = Object.fromEntries(
    Object.keys(durations).map((name) => [`--sl-duration-${name}`, "0ms"]),
  );
  return [
    "/* Seamlet design tokens. Generated from src/tokens.ts; do not edit. */",
    block(":root", {
      "color-scheme": "light",
      ...sharedDeclarations(),
      ...themeDeclarations("light"),
    }),
    `@media (prefers-color-scheme: dark) {\n${block(':root:not([data-theme="light"])', dark, "  ")}\n}`,
    block(':root[data-theme="dark"]', dark),
    `@media (prefers-reduced-motion: reduce) {\n${block(":root", zeroDurations, "  ")}\n}`,
    "",
  ].join("\n\n");
}
