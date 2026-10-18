import type { ImageValue } from "./content";

// Where a site crops a photo: the point a person chose stays in view, whatever the shape the photo
// takes on a phone or a wide screen. The site puts it into `object-position` (or
// `background-position`) of the photo.

const PERCENT = 100;
/** Tenths of a percent: finer than a pixel of any photo on a site. */
const STEPS_PER_PERCENT = 10;
const MIDDLE = 0.5;

/** `object-position` of the photo: "50% 30%"; the middle when no point is chosen. */
export function imagePosition(image: ImageValue | null): string {
  const x = image?.focus?.x ?? MIDDLE;
  const y = image?.focus?.y ?? MIDDLE;
  return `${percentOf(x)} ${percentOf(y)}`;
}

function percentOf(fraction: number): string {
  const steps = Math.round(fraction * PERCENT * STEPS_PER_PERCENT);
  const rounded = steps / STEPS_PER_PERCENT;
  return `${String(rounded)}%`;
}
