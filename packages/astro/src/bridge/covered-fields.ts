import type { Box, Viewport } from "./boxes";
import type { Point } from "./messages";

// The fields of a page a click cannot reach: another element lies over every point of a field's
// element (a link of a card stretched over the whole card, a block of text over a photo), so a
// click there chooses that element in the editor instead. Only a page laid out by a browser tells
// what lies on top, so the check asks it through `isFieldAt` and `whatIsAt`.

/** A marked element of the page and where it is. */
export interface PlacedField {
  readonly path: string;
  readonly box: Box;
}

/** What a click at a point of the page lands on. */
export interface PageHits<F extends PlacedField> {
  readonly viewport: Viewport;
  /** Whether a click at the point lands on the field's element or inside it. */
  readonly isFieldAt: (field: F, point: Point) => boolean;
  /** What a click at the point lands on, as a report names it: a field's path or an element. */
  readonly whatIsAt: (point: Point) => string;
}

/** A field covered at every point a click could take, and what lies over its middle. */
export interface CoveredField {
  readonly path: string;
  readonly coveredBy: string;
}

/** A point of a box as shares of its width and its height. */
type Shares = readonly [across: number, down: number];

const MIDDLE: Shares = [0.5, 0.5];
/** Where a field is tried: its middle, then the middles of its four quarters. */
const PROBE_SHARES: readonly Shares[] = [
  MIDDLE,
  [0.25, 0.25],
  [0.75, 0.25],
  [0.25, 0.75],
  [0.75, 0.75],
];

/**
 * The fields shown in the viewport that a click reaches at none of the points tried. A field out
 * of the viewport is left for a later check: a browser tells what lies at a point on screen only.
 */
export function coveredFieldsOf<F extends PlacedField>(
  fields: readonly F[],
  hits: PageHits<F>,
): CoveredField[] {
  return fields.flatMap((field) => {
    const shown = shownPartOf(field.box, hits.viewport);
    if (shown === undefined) return [];

    const points = PROBE_SHARES.map(([across, down]) =>
      pointIn(shown, across, down),
    );
    const isReached = points.some((point) => hits.isFieldAt(field, point));
    if (isReached) return [];

    const middle = pointIn(shown, ...MIDDLE);
    return [{ path: field.path, coveredBy: hits.whatIsAt(middle) }];
  });
}

/** Whether the box is in the viewport whole enough to be clicked: some of it on screen. */
export function isShownIn(box: Box, viewport: Viewport): boolean {
  return shownPartOf(box, viewport) !== undefined;
}

/** The part of the box inside the viewport, or undefined when none of it is. */
function shownPartOf(box: Box, viewport: Viewport): Box | undefined {
  const left = Math.max(box.left, 0);
  const top = Math.max(box.top, 0);
  const right = Math.min(box.left + box.width, viewport.width);
  const bottom = Math.min(box.top + box.height, viewport.height);
  const hasArea = right > left && bottom > top;
  if (!hasArea) return undefined;

  return { left, top, width: right - left, height: bottom - top };
}

function pointIn(box: Box, across: number, down: number): Point {
  return { x: box.left + box.width * across, y: box.top + box.height * down };
}
