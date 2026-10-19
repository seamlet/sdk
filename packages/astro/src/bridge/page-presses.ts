import { listenToAll, onDocument, onWindow } from "./event-listening";

// Whether a person presses on the site's page: from a pointer going down until it goes up. The
// editor's draft must not replace the page in between, or the click is lost.

export interface PagePresses {
  readonly isPressed: () => boolean;
  readonly stop: () => void;
}

/**
 * Follows the presses on the page; `onRelease` runs once a press is over and its click, which the
 * browser sends right after the release, has been heard.
 */
export function followPresses(
  document: Document,
  onRelease: () => void,
): PagePresses {
  const view = document.defaultView;
  let isPressed = false;
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;

  const press = () => {
    clearTimeout(releaseTimer);
    isPressed = true;
  };
  const release = () => {
    if (!isPressed) return;
    isPressed = false;
    releaseTimer = setTimeout(onRelease, 0);
  };
  // A button released outside the frame sends no pointerup here: the next move shows no button.
  const releaseOnMove = (event: PointerEvent) => {
    if (event.buttons === 0) release();
  };

  const stopListening = listenToAll([
    onDocument(document, "pointerdown", press),
    onDocument(document, "pointerup", release),
    onDocument(document, "pointercancel", release),
    onDocument(document, "pointermove", releaseOnMove),
    ...onWindow(view, "blur", release),
  ]);

  return {
    isPressed: () => isPressed,
    stop: () => {
      clearTimeout(releaseTimer);
      stopListening();
    },
  };
}
