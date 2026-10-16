// The design tokens of Seamlet: the one source of every color, size, shadow and motion the landing
// page and the CMS use. `css.ts` turns them into CSS custom properties (`--sl-…`); the values are
// also exported for code that needs a number (a duration in a script, a breakpoint in a test).
//
// The look: a white field on a visible grid, black type and one green signal. No rounded corners;
// the seam — the outline that marks an editable element — is a thin line with square handles.

export const themes = ["light", "dark"] as const;
export type Theme = (typeof themes)[number];

const lightColors = {
  // Grounds, from the page down to what floats over it.
  canvas: "#ffffff",
  surface: "#ffffff",
  sunken: "#f3f4f3",
  raised: "#ffffff",
  // Type.
  text: "#0b0c0b",
  muted: "#5c615d",
  faint: "#6f7470",
  // Lines: `line` divides, `line-strong` draws the edge of a control (3:1 against its ground).
  line: "#e3e5e3",
  "line-strong": "#858a86",
  // The one signal: actions, the seam, focus.
  accent: "#00874a",
  "accent-hover": "#00733f",
  "accent-text": "#00773f",
  "on-accent": "#ffffff",
  "accent-soft": "#e2f3e9",
  // The black of primary buttons.
  inverse: "#0b0c0b",
  "inverse-hover": "#2a2d2a",
  "on-inverse": "#ffffff",
  // States, apart from the accent.
  danger: "#c0281b",
  "danger-soft": "#fbe8e6",
  warning: "#8f5600",
  "warning-soft": "#fcf0d9",
  success: "#00773f",
  "success-soft": "#e2f3e9",
  // The editor's marks and what dims a page under a dialog.
  seam: "#00874a",
  focus: "#00874a",
  scrim: "rgb(11 12 11 / 0.4)",
} as const;

export type ColorName = keyof typeof lightColors;

const darkColors: Record<ColorName, string> = {
  canvas: "#0b0c0b",
  surface: "#131413",
  sunken: "#1b1c1b",
  raised: "#1e201e",
  text: "#f1f2f1",
  muted: "#a3a8a4",
  faint: "#8d928e",
  line: "#272927",
  "line-strong": "#6c716d",
  accent: "#2fd47f",
  "accent-hover": "#5ce09b",
  "accent-text": "#4ade8f",
  "on-accent": "#03140a",
  "accent-soft": "#10291b",
  inverse: "#f1f2f1",
  "inverse-hover": "#d4d7d4",
  "on-inverse": "#0b0c0b",
  danger: "#ff8173",
  "danger-soft": "#3a1814",
  warning: "#f0b44a",
  "warning-soft": "#33250b",
  success: "#4ade8f",
  "success-soft": "#10291b",
  seam: "#2fd47f",
  focus: "#2fd47f",
  scrim: "rgb(0 0 0 / 0.6)",
};

export const colors: Record<Theme, Record<ColorName, string>> = {
  light: lightColors,
  dark: darkColors,
};

export const shadows: Record<
  Theme,
  Record<"panel" | "popover" | "dock", string>
> = {
  light: {
    panel:
      "0 0 0 1px rgb(11 12 11 / 0.06), 0 12px 32px -20px rgb(11 12 11 / 0.3)",
    popover:
      "0 0 0 1px rgb(11 12 11 / 0.08), 0 16px 40px -16px rgb(11 12 11 / 0.32)",
    dock: "0 0 0 1px rgb(11 12 11 / 0.08), 0 20px 48px -18px rgb(11 12 11 / 0.4)",
  },
  dark: {
    panel:
      "0 0 0 1px rgb(255 255 255 / 0.05), 0 12px 32px -20px rgb(0 0 0 / 0.8)",
    popover:
      "0 0 0 1px rgb(255 255 255 / 0.08), 0 16px 40px -16px rgb(0 0 0 / 0.85)",
    dock: "0 0 0 1px rgb(255 255 255 / 0.08), 0 20px 48px -18px rgb(0 0 0 / 0.9)",
  },
};

/** The families `fonts.css` declares, with what stands in while they load or if they fail. */
export const fontFamilies = {
  display:
    '"Wix Madefor Display", system-ui, -apple-system, "Segoe UI", sans-serif',
  text: '"Wix Madefor Text", system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

/** The type scale, in rem of a 16 px root. */
export const fontSizes = {
  xs: "0.75rem",
  sm: "0.8125rem",
  md: "0.875rem",
  base: "1rem",
  lg: "1.125rem",
  xl: "1.25rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  "4xl": "2.75rem",
  "5xl": "3.75rem",
  "6xl": "4.75rem",
} as const;

export const fontWeights = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
  heavy: "800",
} as const;

export const lineHeights = {
  display: "1",
  tight: "1.15",
  snug: "1.3",
  normal: "1.5",
  relaxed: "1.6",
} as const;

export const letterSpacings = {
  display: "-0.035em",
  heading: "-0.02em",
  normal: "0",
  caps: "0.04em",
} as const;

/** A 4 px rhythm; the keys are multiples of 4 px. */
export const space = {
  "0": "0",
  "0-5": "0.125rem",
  "1": "0.25rem",
  "1-5": "0.375rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "8": "2rem",
  "10": "2.5rem",
  "12": "3rem",
  "16": "4rem",
  "20": "5rem",
  "24": "6rem",
  "32": "8rem",
} as const;

/** No rounded corners: controls and panels are square; only dots and status marks are round. */
export const radii = {
  none: "0",
  round: "999px",
} as const;

export const sizes = {
  "control-sm": "2rem",
  "control-md": "2.5rem",
  "control-lg": "3rem",
  // The smallest target a finger gets (WCAG 2.5.8 asks for 24 px; a touch screen wants 44).
  touch: "2.75rem",
  "content-max": "77.5rem",
  "text-max": "38rem",
  "seam-handle": "6px",
  "seam-line": "1px",
} as const;

/** Durations in milliseconds; `css.ts` sets them to 0 under `prefers-reduced-motion: reduce`. */
export const durations = {
  instant: 80,
  fast: 140,
  base: 200,
  slow: 320,
} as const;

export const easings = {
  // Things that move within the page: a panel's content, a value that changes.
  standard: "cubic-bezier(0.2, 0, 0, 1)",
  // Things that arrive: a popover, a panel, a toast.
  enter: "cubic-bezier(0.16, 1, 0.3, 1)",
  // Things that leave.
  exit: "cubic-bezier(0.4, 0, 1, 1)",
} as const;

export const layers = {
  overlay: "10",
  popover: "20",
  dock: "30",
  toast: "40",
  dialog: "50",
} as const;

/** Widths where layouts change, in px, mobile first. */
export const breakpoints = {
  sm: 480,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;
