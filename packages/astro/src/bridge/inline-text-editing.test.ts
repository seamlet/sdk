// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { startInlineTextEditing } from "./inline-text-editing";

function heading(): HTMLElement {
  document.body.innerHTML = "<h1>Кофейня</h1>";
  const element = document.querySelector("h1");
  if (element === null) throw new Error("No heading");
  return element;
}

function startEditing(element: HTMLElement, isSingleLine: boolean) {
  const onInput = vi.fn<(text: string) => void>();
  const onEnd = vi.fn<(outcome: "kept" | "reverted") => void>();
  const stop = startInlineTextEditing(element, {
    isSingleLine,
    onInput,
    onEnd,
  });
  return { onInput, onEnd, stop };
}

function pressKey(element: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe("startInlineTextEditing", () => {
  it("makes the element editable as plain text and reports what is typed", () => {
    const element = heading();
    const { onInput } = startEditing(element, true);

    element.textContent = "Моя кофейня";
    element.dispatchEvent(new Event("input"));

    expect(element.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(document.activeElement).toBe(element);
    expect(onInput).toHaveBeenCalledWith("Моя кофейня");
  });

  it("ends a single-line text on Enter and keeps it", () => {
    const element = heading();
    const { onEnd } = startEditing(element, true);

    const enter = pressKey(element, "Enter");

    expect(enter.defaultPrevented).toBe(true);
    expect(onEnd).toHaveBeenCalledWith("kept");
    expect(element.hasAttribute("contenteditable")).toBe(false);
  });

  it("takes Enter as a line break in a multiline text", () => {
    const element = heading();
    const { onEnd } = startEditing(element, false);

    expect(pressKey(element, "Enter").defaultPrevented).toBe(false);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it("ends on Escape keeping the text, once", () => {
    const element = heading();
    const { onEnd, stop } = startEditing(element, true);

    pressKey(element, "Escape");
    stop();
    element.dispatchEvent(new Event("blur"));

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledWith("kept");
  });

  it("keeps the text when the element loses focus", () => {
    const element = heading();
    const { onEnd } = startEditing(element, false);

    element.blur();

    expect(onEnd).toHaveBeenCalledWith("kept");
  });
});
