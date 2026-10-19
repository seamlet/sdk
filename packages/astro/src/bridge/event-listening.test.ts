// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  listenToAll,
  onDocument,
  onElement,
  onWindow,
} from "./event-listening";

describe("listenToAll", () => {
  it("hears every event until it is stopped, the document's before the page's own", () => {
    document.body.innerHTML = "<button>Записаться</button>";
    const button = document.querySelector("button");
    if (button === null) throw new Error("No button");
    const heard: string[] = [];
    button.addEventListener("click", (event) => {
      heard.push("site");
      event.stopPropagation();
    });

    const stop = listenToAll([
      onDocument(document, "click", () => heard.push("document")),
      onElement(button, "click", () => heard.push("element")),
      ...onWindow(window, "resize", () => heard.push("window")),
      ...onWindow(null, "resize", () => heard.push("no window")),
    ]);
    button.click();
    window.dispatchEvent(new Event("resize"));
    stop();
    button.click();
    window.dispatchEvent(new Event("resize"));

    expect(heard).toEqual(["document", "site", "element", "window", "site"]);
  });

  it("keeps a window's listener out when the document has no window", () => {
    expect(onWindow(null, "resize", vi.fn())).toEqual([]);
  });
});
