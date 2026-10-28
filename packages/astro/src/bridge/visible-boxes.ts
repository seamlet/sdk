import { boxOf, type Box } from "./boxes";

// The part of an element a person sees on the page: its box cut by the parts around it that clip
// what overflows them (a strip that scrolls sideways, a card with rounded corners) and by the parts
// fixed over it (a sticky header, a bar at the bottom of the screen). The editor draws its outlines
// and picks a click by these boxes, so an outline never lies over a header the element went under.

/** How far apart two edges may be and still be the same edge, in pixels. */
const EDGE_TOLERANCE = 1;

interface Edges {
  readonly top: number;
  readonly left: number;
  readonly right: number;
  readonly bottom: number;
}

/** What one measurement of the page knows of an element, asked of the browser once. */
interface Placement {
  readonly position: string;
  readonly clipsAcross: boolean;
  readonly clipsDown: boolean;
  readonly edges: Edges;
}

/** Finds the visible boxes of the page's elements as it is laid out now. */
export type VisibleBoxes = (element: Element) => Box | undefined;

/**
 * Measures what is seen of the page's elements as it is now. One measurement asks the browser of
 * every element once, so take a new one whenever the page may have moved.
 */
export function measureVisibleBoxes(document: Document): VisibleBoxes {
  const placementOf = cachedPlacements(document);
  const overlays = fixedPartsOf(document, placementOf);
  const screen = screenOf(document);

  return (element) => {
    const box = boxOf(element);
    if (box === undefined) return undefined;

    const clipped = clippedByAncestors(element, edgesOf(box), placementOf);
    const covering = { element, placementOf, screen };
    const uncovered = overlays.reduce<Edges | undefined>(
      (edges, overlay) =>
        edges === undefined ? undefined : uncoveredBy(edges, overlay, covering),
      clipped,
    );
    return uncovered === undefined ? undefined : boxFromEdges(uncovered);
  };
}

function cachedPlacements(document: Document): (element: Element) => Placement {
  const view = document.defaultView;
  const placements = new Map<Element, Placement>();
  return (element) => {
    const known = placements.get(element);
    if (known !== undefined) return known;

    const style = view?.getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    const placement = {
      position: style?.position ?? "static",
      clipsAcross: (style?.overflowX ?? "visible") !== "visible",
      clipsDown: (style?.overflowY ?? "visible") !== "visible",
      edges: {
        top: rectangle.top,
        left: rectangle.left,
        right: rectangle.right,
        bottom: rectangle.bottom,
      },
    };
    placements.set(element, placement);
    return placement;
  };
}

/**
 * The box cut by every ancestor that clips it. An element positioned absolutely is clipped only
 * from its containing block up, and one fixed to the screen by none of its ancestors.
 */
function clippedByAncestors(
  element: Element,
  box: Edges,
  placementOf: (element: Element) => Placement,
): Edges | undefined {
  const root = element.ownerDocument;
  let edges: Edges = box;
  let isSkippingStatic = placementOf(element).position === "absolute";
  if (placementOf(element).position === "fixed") return edges;

  for (
    let ancestor = element.parentElement;
    ancestor !== null && !isPageRoot(ancestor, root);
    ancestor = ancestor.parentElement
  ) {
    const placement = placementOf(ancestor);
    const isStatic = placement.position === "static";
    if (isSkippingStatic && isStatic) continue;
    isSkippingStatic = placement.position === "absolute";

    edges = clippedBy(edges, placement);
    const isGone = edges.right <= edges.left || edges.bottom <= edges.top;
    if (isGone) return undefined;
    if (placement.position === "fixed") return edges;
  }
  return edges;
}

/** The body and the root scroll with the viewport: what they hold is clipped by the screen only. */
function isPageRoot(element: Element, document: Document): boolean {
  return element === document.body || element === document.documentElement;
}

function clippedBy(edges: Edges, ancestor: Placement): Edges {
  const across = ancestor.clipsAcross
    ? {
        left: Math.max(edges.left, ancestor.edges.left),
        right: Math.min(edges.right, ancestor.edges.right),
      }
    : { left: edges.left, right: edges.right };
  const down = ancestor.clipsDown
    ? {
        top: Math.max(edges.top, ancestor.edges.top),
        bottom: Math.min(edges.bottom, ancestor.edges.bottom),
      }
    : { top: edges.top, bottom: edges.bottom };
  return { ...across, ...down };
}

/** The parts of the page that stay on the screen while it scrolls, a sticky header among them. */
function fixedPartsOf(
  document: Document,
  placementOf: (element: Element) => Placement,
): readonly Element[] {
  const elements = [...document.body.querySelectorAll("*")];
  return elements.filter((element) => {
    const { position } = placementOf(element);
    return position === "fixed" || position === "sticky";
  });
}

/** The top and the bottom of the screen, in the coordinates of the page's boxes. */
interface Screen {
  readonly top: number;
  readonly bottom: number;
}

function screenOf(document: Document): Screen {
  return { top: 0, bottom: document.defaultView?.innerHeight ?? Infinity };
}

/** What a fixed part is held against: the element, the page's measurement and the screen. */
interface Covering {
  readonly element: Element;
  readonly placementOf: (element: Element) => Placement;
  readonly screen: Screen;
}

/**
 * The edges without the band a fixed part covers across their whole width, at the top or the
 * bottom of what the screen shows of them; a part over the element's middle or over some of its
 * width leaves it as it is, since what stays seen is then no box. A part the element holds, or one
 * holding it, covers nothing.
 */
function uncoveredBy(
  edges: Edges,
  overlay: Element,
  covering: Covering,
): Edges | undefined {
  const { element, placementOf, screen } = covering;
  const isRelated = overlay.contains(element) || element.contains(overlay);
  if (isRelated) return edges;

  const cover = placementOf(overlay).edges;
  const overlap = overlapOf(edges, cover);
  if (overlap === undefined) return edges;

  const isAcrossWhole =
    cover.left <= edges.left + EDGE_TOLERANCE &&
    cover.right >= edges.right - EDGE_TOLERANCE;
  if (!isAcrossWhole || !isOnTop(overlay, overlap)) return edges;

  // A section scrolled half above the screen goes on under a header stuck to its top: the header
  // covers the top of what is seen of it, not of the section.
  const seenTop = Math.max(edges.top, screen.top);
  const seenBottom = Math.min(edges.bottom, screen.bottom);
  const coversTop = cover.top <= seenTop + EDGE_TOLERANCE;
  const coversBottom = cover.bottom >= seenBottom - EDGE_TOLERANCE;
  if (coversTop && coversBottom) return undefined;
  if (coversTop) return { ...edges, top: cover.bottom };
  if (coversBottom) return { ...edges, bottom: cover.top };
  return edges;
}

function overlapOf(one: Edges, other: Edges): Edges | undefined {
  const overlap = {
    top: Math.max(one.top, other.top),
    left: Math.max(one.left, other.left),
    right: Math.min(one.right, other.right),
    bottom: Math.min(one.bottom, other.bottom),
  };
  const hasArea = overlap.right > overlap.left && overlap.bottom > overlap.top;
  return hasArea ? overlap : undefined;
}

/** Whether the part is what a person sees in the middle of the overlap, painted over the rest. */
function isOnTop(overlay: Element, overlap: Edges): boolean {
  const x = (overlap.left + overlap.right) / 2;
  const y = (overlap.top + overlap.bottom) / 2;
  const seen = overlay.ownerDocument.elementFromPoint(x, y);
  return seen !== null && overlay.contains(seen);
}

function edgesOf(box: Box): Edges {
  return {
    top: box.top,
    left: box.left,
    right: box.left + box.width,
    bottom: box.top + box.height,
  };
}

function boxFromEdges(edges: Edges): Box {
  return {
    top: edges.top,
    left: edges.left,
    width: edges.right - edges.left,
    height: edges.bottom - edges.top,
  };
}
