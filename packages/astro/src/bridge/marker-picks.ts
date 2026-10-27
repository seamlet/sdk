import { FIELD_PATH_SEPARATOR } from "../schema";
import type { Box } from "./boxes";
import { seenBoxOf, type MarkerBox, type Point } from "./messages";

// Which marked element a click chooses. The element on top is not always the one meant: a card's
// name is often a link stretched over the whole card, so a click on its price or photo lands on the
// link. The choice is made by the boxes instead: the smallest marked element whose box holds the
// point, by the part of it a person sees. The bridge chooses so, to give the focus to the right element at once, and the editor by
// the same rule from the boxes the page reported, with a bridge of any version.

/** Where a click landed: the marked element the page names (the closest around the top one). */
export interface MarkerClick {
  readonly path: string;
  readonly point: Point;
}

/**
 * The marked elements a click may choose, the chosen one first: those whose box holds the point,
 * in the block around the element the click landed on (its parent's path), so a sticky header
 * never hands the click to a field scrolled under it. The smaller box comes first, then the deeper
 * path, then the element the page named.
 */
export function rankedMarkersAt<M extends MarkerBox>(
  markers: readonly M[],
  click: MarkerClick,
): M[] {
  const scope = parentPathOf(click.path) ?? click.path;
  const candidates = markers.filter((marker) => {
    const seen = seenBoxOf(marker);
    const isHit = seen !== undefined && holdsPoint(seen, click.point);
    return isWithin(marker.path, scope) && isHit;
  });
  return candidates.sort(
    (first, second) =>
      areaOf(first.box) - areaOf(second.box) ||
      depthOf(second.path) - depthOf(first.path) ||
      Number(second.path === click.path) - Number(first.path === click.path),
  );
}

/** The path a click chooses: the first of `rankedMarkersAt`, or the one the page named. */
export function pickedPathAt(
  markers: readonly MarkerBox[],
  click: MarkerClick,
): string {
  return rankedMarkersAt(markers, click)[0]?.path ?? click.path;
}

function parentPathOf(path: string): string | undefined {
  const segments = path.split(FIELD_PATH_SEPARATOR);
  const hasParent = segments.length > 1;
  return hasParent
    ? segments.slice(0, -1).join(FIELD_PATH_SEPARATOR)
    : undefined;
}

function isWithin(path: string, scope: string): boolean {
  return path === scope || path.startsWith(`${scope}${FIELD_PATH_SEPARATOR}`);
}

function holdsPoint(box: Box, point: Point): boolean {
  const isAcross = point.x >= box.left && point.x <= box.left + box.width;
  const isAlong = point.y >= box.top && point.y <= box.top + box.height;
  return isAcross && isAlong;
}

function areaOf(box: Box): number {
  return box.width * box.height;
}

function depthOf(path: string): number {
  return path.split(FIELD_PATH_SEPARATOR).length;
}
