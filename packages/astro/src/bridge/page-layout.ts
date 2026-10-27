import { boxOf, type Box } from "./boxes";
import type { LinkBox, MarkerBox, PageLayout } from "./messages";
import { allMarkedElements, type PageLink } from "./page-markers";
import { measureVisibleBoxes, type VisibleBoxes } from "./visible-boxes";

/** Where the marked elements of the page and the link under the pointer are now. */
export function measureLayout(
  document: Document,
  link: PageLink | undefined,
): PageLayout {
  const visibleBoxOf = measureVisibleBoxes(document);
  const markers = allMarkedElements(document).flatMap(
    ({ element, path }): MarkerBox[] => {
      const box = boxOf(element);
      const shown = visibleBoxOf(element) ?? null;
      return box === undefined ? [] : [{ path, box, shown }];
    },
  );
  const root = document.documentElement;
  return {
    markers,
    viewport: { width: root.clientWidth, height: root.clientHeight },
    link: link === undefined ? undefined : linkBoxOf(link, visibleBoxOf),
  };
}

/** Where the link is seen, or undefined for a link that takes no space or is hidden. */
function linkBoxOf(
  link: PageLink,
  visibleBoxOf: VisibleBoxes,
): LinkBox | undefined {
  const box = visibleBoxOf(link.element);
  return box === undefined ? undefined : { href: link.href, box };
}

export interface LayoutReports {
  /** Reports the layout once, before the next frame is painted, however often it changed. */
  readonly schedule: () => void;
  readonly reportNow: () => void;
  readonly hoverLink: (link: PageLink | undefined) => void;
  /** The text of the site's own under the pointer, or none: its box is reported now and on moves. */
  readonly hoverStaticText: (text: Element | undefined) => void;
  readonly stop: () => void;
}

export interface LayoutReporters {
  readonly onLayout: (layout: PageLayout) => void;
  /** Where the hovered text of the site's own is, or that none is hovered (undefined). */
  readonly onStaticText: (box: Box | undefined) => void;
}

/** Tells the editor where things are whenever the page moves: scroll, resize, a new render. */
export function createLayoutReports(
  document: Document,
  reporters: LayoutReporters,
): LayoutReports {
  const view = document.defaultView;
  let link: PageLink | undefined;
  let staticText: Element | undefined;
  let frame: number | undefined;

  const cancel = () => {
    if (frame !== undefined) view?.cancelAnimationFrame(frame);
    frame = undefined;
  };
  const reportStaticText = () => {
    // A render replaced the hovered text: it is gone from the page.
    if (staticText?.isConnected === false) staticText = undefined;
    reporters.onStaticText(
      staticText === undefined
        ? undefined
        : measureVisibleBoxes(document)(staticText),
    );
  };
  const reportNow = () => {
    cancel();
    reporters.onLayout(measureLayout(document, link));
    if (staticText !== undefined) reportStaticText();
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
    hoverStaticText: (hovered) => {
      if (hovered === staticText) return;
      staticText = hovered;
      reportStaticText();
    },
    stop: cancel,
  };
}
