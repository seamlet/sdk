// Where the elements of the site's page are. The editor's overlay lies exactly over the frame of
// the page, so a box in the page's viewport is a box in the overlay too.

export interface Box {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** The box of an element in its viewport, or undefined for an element that takes no space. */
export function boxOf(element: Element): Box | undefined {
  const rectangle = element.getBoundingClientRect();
  const isShown = rectangle.width > 0 || rectangle.height > 0;
  if (!isShown) {
    return undefined;
  }
  return {
    top: rectangle.top,
    left: rectangle.left,
    width: rectangle.width,
    height: rectangle.height,
  };
}
