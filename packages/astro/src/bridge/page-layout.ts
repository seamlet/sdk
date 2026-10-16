import { boxOf } from "./boxes";
import type { MarkerBox, PageLayout } from "./messages";
import { allMarkedElements, type PageLink } from "./page-markers";

/** Where the marked elements of the page and the link under the pointer are now. */
export function measureLayout(
  document: Document,
  link: PageLink | undefined,
): PageLayout {
  const markers = allMarkedElements(document).flatMap(
    ({ element, path }): MarkerBox[] => {
      const box = boxOf(element);
      return box === undefined ? [] : [{ path, box }];
    },
  );
  const root = document.documentElement;
  const linkBox = link === undefined ? undefined : boxOf(link.element);
  return {
    markers,
    viewport: { width: root.clientWidth, height: root.clientHeight },
    link:
      link === undefined || linkBox === undefined
        ? undefined
        : { href: link.href, box: linkBox },
  };
}

export interface LayoutReports {
  /** Reports the layout once, before the next frame is painted, however often it changed. */
  readonly schedule: () => void;
  readonly reportNow: () => void;
  readonly hoverLink: (link: PageLink | undefined) => void;
  readonly stop: () => void;
}

/** Tells the editor where things are whenever the page moves: scroll, resize, a new render. */
export function createLayoutReports(
  document: Document,
  report: (layout: PageLayout) => void,
): LayoutReports {
  const view = document.defaultView;
  let link: PageLink | undefined;
  let frame: number | undefined;

  const cancel = () => {
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
    frame = undefined;
  };
  const reportNow = () => {
    cancel();
    report(measureLayout(document, link));
  };
  const schedule = () => {
    if (frame !== undefined) return;
    frame = view?.requestAnimationFrame(reportNow);
  };

  return {
    schedule,
    reportNow,
    hoverLink: (hovered) => {
      if (hovered?.element === link?.element) return;
      link = hovered;
      schedule();
    },
    stop: cancel,
  };
}
