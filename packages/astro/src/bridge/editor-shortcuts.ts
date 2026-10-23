// The keyboard shortcuts of the editor. Keys are read by their place on the keyboard, not by the
// letter they type, so ⌘Z works the same with the Russian layout, where that key types «я».

import type { EditorKey, Shortcut } from "./messages";

/** The keys that take a typing to the next or the previous field of the page. */
export type FieldStep = Extract<EditorKey, "next-field" | "previous-field">;

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

/** Tab goes to the next field, Shift+Tab to the previous one; with a command key it is the browser's. */
export function fieldStepOf(event: KeyboardEvent): FieldStep | undefined {
  const hasOtherKey = event.metaKey || event.ctrlKey || event.altKey;
  if (event.key !== "Tab" || hasOtherKey) return undefined;

  return event.shiftKey ? "previous-field" : "next-field";
}
