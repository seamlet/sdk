// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import {
  listenToAll,
  onDocument,
  onElement,
  onPageClick,
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

  it("hears a click on the page before the site's own listener stops it", () => {
    document.body.innerHTML = "<p>Капучино</p>";
    const paragraph = document.querySelector("p");
    if (paragraph === null) throw new Error("No paragraph");
    const heard: string[] = [];
    paragraph.addEventListener("click", (event) => {
      heard.push("site");
      event.stopPropagation();
    });

    const stop = listenToAll([
      onPageClick(document, (event) => {
        heard.push(event.target === paragraph ? "page" : "elsewhere");
      }),
    ]);
    paragraph.click();
    stop();
    paragraph.click();

    expect(heard).toEqual(["page", "site", "site"]);
  });

  it("keeps a window's listener out when the document has no window", () => {
    expect(onWindow(null, "resize", vi.fn())).toEqual([]);
  });
});
