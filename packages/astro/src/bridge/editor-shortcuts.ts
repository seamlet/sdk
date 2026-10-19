// The keyboard shortcuts of the editor. Keys are read by their place on the keyboard, not by the
// letter they type, so ⌘Z works the same with the Russian layout, where that key types «я».

import type { Shortcut } from "./messages";

export function shortcutOf(event: KeyboardEvent): Shortcut | undefined {
  const hasCommandKey = event.metaKey || event.ctrlKey;
  if (!hasCommandKey || event.altKey) {
    return undefined;
  }

  switch (event.code) {
    case "KeyS":
      return "save";
    case "KeyZ":
      return event.shiftKey ? "redo" : "undo";
    case "KeyY":
      return "redo";
    default:
      return undefined;
  }
}
