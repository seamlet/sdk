// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fieldStepOf, shortcutOf } from "./editor-shortcuts";

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

describe("fieldStepOf", () => {
  it("takes Tab to the next field and Shift+Tab to the previous one", () => {
    expect(fieldStepOf(keyDown({ key: "Tab" }))).toBe("next-field");
    expect(fieldStepOf(keyDown({ key: "Tab", shiftKey: true }))).toBe(
      "previous-field",
    );
  });

  it("leaves Tab with a command key and other keys to the browser", () => {
    expect(fieldStepOf(keyDown({ key: "Tab", ctrlKey: true }))).toBeUndefined();
    expect(fieldStepOf(keyDown({ key: "Tab", altKey: true }))).toBeUndefined();
    expect(fieldStepOf(keyDown({ key: "Enter" }))).toBeUndefined();
  });
});
