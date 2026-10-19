// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { followPresses } from "./page-presses";

afterEach(() => {
  vi.useRealTimers();
});

function pointer(type: string, buttons = 0): Event {
  // jsdom has no PointerEvent; a MouseEvent of the same type carries what is read.
  return new MouseEvent(type, { bubbles: true, buttons });
}

describe("followPresses", () => {
  it("says a press lasts from the pointer going down until it goes up", () => {
    vi.useFakeTimers();
    const onRelease = vi.fn();
    const presses = followPresses(document, onRelease);

    document.body.dispatchEvent(pointer("pointerdown", 1));

    expect(presses.isPressed()).toBe(true);

    document.body.dispatchEvent(pointer("pointerup"));

    expect(presses.isPressed()).toBe(false);
    expect(onRelease).not.toHaveBeenCalled();

    vi.runAllTimers();

    expect(onRelease).toHaveBeenCalledOnce();
    presses.stop();
  });

  it("ends a press released outside the page at the next move without a button", () => {
    const presses = followPresses(document, vi.fn());

    document.body.dispatchEvent(pointer("pointerdown", 1));
    document.body.dispatchEvent(pointer("pointermove", 1));

    expect(presses.isPressed()).toBe(true);

    document.body.dispatchEvent(pointer("pointermove", 0));

    expect(presses.isPressed()).toBe(false);
    presses.stop();
  });
});
