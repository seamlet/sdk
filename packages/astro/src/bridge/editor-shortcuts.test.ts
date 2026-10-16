// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { shortcutOf } from "./editor-shortcuts";

function keyDown(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent("keydown", init);
}

describe("shortcutOf", () => {
  it("reads ⌘ and Ctrl shortcuts by the key's place, whatever the layout", () => {
    expect(shortcutOf(keyDown({ code: "KeyS", key: "ы", metaKey: true }))).toBe(
      "save",
    );
    expect(shortcutOf(keyDown({ code: "KeyZ", key: "z", ctrlKey: true }))).toBe(
      "undo",
    );
    expect(
      shortcutOf(
        keyDown({ code: "KeyZ", key: "Я", metaKey: true, shiftKey: true }),
      ),
    ).toBe("redo");
    expect(shortcutOf(keyDown({ code: "KeyY", key: "y", ctrlKey: true }))).toBe(
      "redo",
    );
  });

  it("ignores keys without ⌘ or Ctrl and other keys", () => {
    expect(shortcutOf(keyDown({ code: "KeyS", key: "s" }))).toBeUndefined();
    expect(
      shortcutOf(keyDown({ code: "KeyQ", key: "q", metaKey: true })),
    ).toBeUndefined();
    expect(
      shortcutOf(
        keyDown({ code: "KeyZ", key: "z", metaKey: true, altKey: true }),
      ),
    ).toBeUndefined();
  });
});
