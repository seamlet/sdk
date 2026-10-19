// The listeners the bridge holds for a while and lets go of together: a typing, the page it is
// connected to. Each is written with the type of its event, and added and removed the same way.

export interface EventListening {
  readonly target: EventTarget;
  readonly type: string;
  readonly listener: EventListener;
  /** Heard on the way down, before the site's own listeners can stop the event. */
  readonly isCapturing: boolean;
}

/** A listener of an event of the element. */
export function onElement<K extends keyof HTMLElementEventMap>(
  element: HTMLElement,
  type: K,
  listener: (event: HTMLElementEventMap[K]) => void,
): EventListening {
  // The element sends events of the type K only: the listener gets the event it expects.
  return {
    target: element,
    type,
    listener: listener as EventListener,
    isCapturing: false,
  };
}

/** A listener of an event anywhere in the document, heard before the site's own. */
export function onDocument<K extends keyof DocumentEventMap>(
  document: Document,
  type: K,
  listener: (event: DocumentEventMap[K]) => void,
): EventListening {
  return {
    target: document,
    type,
    listener: listener as EventListener,
    isCapturing: true,
  };
}

/** A listener of an event of the window, if the document has one. */
export function onWindow<K extends keyof WindowEventMap>(
  view: Window | null,
  type: K,
  listener: (event: WindowEventMap[K]) => void,
): readonly EventListening[] {
  if (view === null) return [];
  return [
    {
      target: view,
      type,
      listener: listener as EventListener,
      isCapturing: false,
    },
  ];
}

/** Adds every listener; returns what removes them all. */
export function listenToAll(listenings: readonly EventListening[]): () => void {
  for (const { target, type, listener, isCapturing } of listenings) {
    target.addEventListener(type, listener, isCapturing);
  }
  return () => {
    for (const { target, type, listener, isCapturing } of listenings) {
      target.removeEventListener(type, listener, isCapturing);
    }
  };
}
