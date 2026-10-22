// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  holdMotionOnPage,
  isEditedInPopover,
  type MotionHolds,
} from "./held-motion";

interface FakeAnimation {
  playState: "running" | "paused";
  readonly pause: () => void;
  readonly play: () => void;
}

function fakeAnimation(): FakeAnimation {
  const animation: FakeAnimation = {
    playState: "running",
    pause: () => {
      animation.playState = "paused";
    },
    play: () => {
      animation.playState = "running";
    },
  };
  return animation;
}

/** Gives the elements of a moving part the animations jsdom does not run. */
function animate(part: Element): FakeAnimation {
  const animation = fakeAnimation();
  Object.defineProperty(part, "getAnimations", {
    value: vi.fn(() => [animation]),
    configurable: true,
  });
  return animation;
}

function marquee(): HTMLElement {
  const part = document.querySelector<HTMLElement>("[data-cms-popover]");
  if (part === null) throw new Error("The page has no moving part");
  return part;
}

let holds: MotionHolds | undefined;

beforeEach(() => {
  document.body.innerHTML = `
    <div data-cms-popover><span data-cms-path="notes">Ягоды · какао</span></div>
    <h1 data-cms-path="title">Зерно</h1>`;
});

afterEach(() => {
  holds?.stop();
});

function pointAt(selector: string): void {
  document
    .querySelector(selector)
    ?.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
}

function clickOn(selector: string): void {
  document
    .querySelector(selector)
    ?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("isEditedInPopover", () => {
  it("is true inside a moving part and false elsewhere", () => {
    expect(isEditedInPopover(marquee().firstElementChild ?? marquee())).toBe(
      true,
    );
    expect(isEditedInPopover(document.querySelector("h1") ?? marquee())).toBe(
      false,
    );
  });
});

describe("holdMotionOnPage", () => {
  it("holds a moving part still while the pointer is over it", () => {
    const animation = animate(marquee());
    holds = holdMotionOnPage(document);

    pointAt("[data-cms-path=notes]");
    expect(animation.playState).toBe("paused");
    expect(marquee().hasAttribute("data-cms-held")).toBe(true);

    pointAt("h1");
    expect(animation.playState).toBe("running");
    expect(marquee().hasAttribute("data-cms-held")).toBe(false);
  });

  it("keeps a chosen part still until something else is clicked", () => {
    const animation = animate(marquee());
    holds = holdMotionOnPage(document);

    clickOn("[data-cms-path=notes]");
    pointAt("h1");
    expect(animation.playState).toBe("paused");

    clickOn("h1");
    expect(animation.playState).toBe("running");
  });

  it("holds the chosen part again in a page rendered anew", () => {
    holds = holdMotionOnPage(document);
    clickOn("[data-cms-path=notes]");

    document.body.innerHTML = `
      <div data-cms-popover><span data-cms-path="notes">Цитрус</span></div>`;
    const animation = animate(marquee());
    holds.holdAgain();

    expect(animation.playState).toBe("paused");
  });

  it("lets every part move again when it stops", () => {
    const animation = animate(marquee());
    holds = holdMotionOnPage(document);
    clickOn("[data-cms-path=notes]");

    holds.stop();
    holds = undefined;

    expect(animation.playState).toBe("running");
    expect(marquee().hasAttribute("data-cms-held")).toBe(false);
  });
});
