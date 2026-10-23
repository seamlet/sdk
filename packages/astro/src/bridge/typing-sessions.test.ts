// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { InlineEditingOutcome } from "./messages";
import { onElement } from "./event-listening";
import { startTypingSession } from "./typing-sessions";

function start(isEndingKey: (event: KeyboardEvent) => boolean = () => false) {
  document.body.innerHTML = `<h1 style="color: red">Кофейня</h1>`;
  const element = document.querySelector("h1");
  if (element === null) throw new Error("No heading");
  const onInput = vi.fn();
  const onStop = vi.fn();
  const onEnd = vi.fn<(outcome: InlineEditingOutcome) => void>();
  const session = startTypingSession(element, {
    editableAs: "plaintext-only",
    isEndingKey,
    listeners: [onElement(element, "input", onInput)],
    onStop,
    onEnd,
  });
  return { element, session, onInput, onStop, onEnd };
}

function press(element: HTMLElement, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, cancelable: true });
  element.dispatchEvent(event);
  return event;
}

describe("startTypingSession", () => {
  it("makes the element editable and focused, and hears it", () => {
    const { element, onInput } = start();

    element.dispatchEvent(new Event("input"));

    expect(element.getAttribute("contenteditable")).toBe("plaintext-only");
    expect(document.activeElement).toBe(element);
    expect(onInput).toHaveBeenCalledOnce();
  });

  it("ends on Escape and on the key that ends it, keeping the text", () => {
    const escaped = start();
    expect(press(escaped.element, "Escape").defaultPrevented).toBe(true);
    expect(escaped.onEnd).toHaveBeenCalledWith("kept");

    const kept = start((event) => event.key === "Enter");
    press(kept.element, "a");
    expect(kept.onEnd).not.toHaveBeenCalled();
    press(kept.element, "Enter");
    expect(kept.onEnd).toHaveBeenCalledWith("kept");
  });

  it("ends once, gives the element back as it was and stops hearing it", () => {
    const { element, session, onInput, onStop, onEnd } = start();

    session.end("kept");
    session.end("reverted");
    element.dispatchEvent(new Event("input"));
    press(element, "Escape");

    expect(onEnd.mock.calls).toEqual([["kept"]]);
    expect(onStop).toHaveBeenCalledOnce();
    expect(onInput).not.toHaveBeenCalled();
    expect(element.hasAttribute("contenteditable")).toBe(false);
    expect(element.getAttribute("style")).toBe("color: red;");
  });
});
