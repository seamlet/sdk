// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DRAG_GONE_AFTER_MS,
  listenToPage,
  type PageListeners,
} from "./page-events";

let stopListening: () => void = () => undefined;
const listeners = {
  onHover: vi.fn<PageListeners["onHover"]>(),
  onClick: vi.fn<PageListeners["onClick"]>(),
  onClickOutside: vi.fn<PageListeners["onClickOutside"]>(),
  onStaticTextHover: vi.fn<PageListeners["onStaticTextHover"]>(),
  onKeyDown: vi.fn<PageListeners["onKeyDown"]>(),
  onLayoutChange: vi.fn<PageListeners["onLayoutChange"]>(),
  onFileDragOver: vi.fn<PageListeners["onFileDragOver"]>(),
  onFileDragEnd: vi.fn<PageListeners["onFileDragEnd"]>(),
  onFileDrop: vi.fn<PageListeners["onFileDrop"]>(),
  onLinkHover: vi.fn<PageListeners["onLinkHover"]>(),
  onLinkClick: vi.fn<PageListeners["onLinkClick"]>(),
};

beforeEach(() => {
  document.body.innerHTML = `
    <a href="/elsewhere" data-cms-path="contacts.phone"><b>+7 000</b></a>
    <form><button>Отправить</button></form>
    <nav><a href="/menu"><span>Меню</span></a></nav>
    <header data-cms-path="hero"><a id="inside" href="/menu">Всё меню</a></header>`;
  for (const listener of Object.values(listeners)) listener.mockReset();
  stopListening = listenToPage(document, listeners);
});

afterEach(() => {
  stopListening();
});

function element(selector: string): Element {
  const found = document.querySelector(selector);
  if (found === null) throw new Error(`No ${selector} in the page`);
  return found;
}

/** A drag event as a browser sends it; jsdom has no DataTransfer of its own. */
function drag(
  type: string,
  carried: { readonly types: readonly string[]; readonly files?: File[] },
): Event & { dataTransfer: { dropEffect: string } } {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const dataTransfer = {
    types: carried.types,
    files: carried.files ?? [],
    dropEffect: "none",
  };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event as Event & { dataTransfer: typeof dataTransfer };
}

describe("listenToPage", () => {
  it("reports the marked element under the pointer", () => {
    element("b").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    element("form").dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true }),
    );

    expect(listeners.onHover.mock.calls).toEqual([
      ["contacts.phone"],
      [undefined],
    ]);
  });

  it("selects on a click and keeps links from navigating", () => {
    const click = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: 10,
      clientY: 20,
    });

    element("b").dispatchEvent(click);

    expect(click.defaultPrevented).toBe(true);
    expect(listeners.onClick).toHaveBeenCalledWith({
      element: element("a"),
      path: "contacts.phone",
      point: { x: 10, y: 20 },
    });
  });

  it("reports a link that is not a field, as the site wrote it", () => {
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });

    element("nav span").dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true }),
    );
    element("nav span").dispatchEvent(click);

    const link = { element: element("nav a"), href: "/menu" };
    expect(listeners.onLinkHover).toHaveBeenLastCalledWith(link);
    expect(listeners.onLinkClick).toHaveBeenCalledWith(link);
    expect(listeners.onClick).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
  });

  it("takes a link inside a marked group as a link", () => {
    element("#inside").dispatchEvent(
      new MouseEvent("mouseover", { bubbles: true }),
    );
    element("#inside").dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(listeners.onHover).toHaveBeenLastCalledWith(undefined);
    expect(listeners.onLinkClick).toHaveBeenCalled();
    expect(listeners.onClick).not.toHaveBeenCalled();
  });

  it("takes a link inside a text being typed as a part of the text", () => {
    element("header").setAttribute("contenteditable", "true");
    element("#inside").dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(listeners.onLinkClick).not.toHaveBeenCalled();
    expect(listeners.onClick).toHaveBeenCalledWith(
      expect.objectContaining({ path: "hero" }),
    );
  });

  it("takes a link that is a field as the field", () => {
    element("b").dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    element("b").dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(listeners.onLinkHover).toHaveBeenLastCalledWith(undefined);
    expect(listeners.onLinkClick).not.toHaveBeenCalled();
  });

  it("keeps forms from being sent", () => {
    const submit = new SubmitEvent("submit", {
      bubbles: true,
      cancelable: true,
    });

    element("form").dispatchEvent(submit);

    expect(submit.defaultPrevented).toBe(true);
  });

  it("lets a file be dropped only where the editor takes it", () => {
    listeners.onFileDragOver.mockImplementation(
      (path) => path === "contacts.phone",
    );
    const overField = drag("dragover", { types: ["Files"] });
    const overForm = drag("dragover", { types: ["Files"] });

    element("b").dispatchEvent(overField);
    element("form").dispatchEvent(overForm);

    expect(listeners.onFileDragOver.mock.calls).toEqual([
      ["contacts.phone"],
      [undefined],
    ]);
    expect(overField.defaultPrevented).toBe(true);
    expect(overField.dataTransfer.dropEffect).toBe("copy");
    // The browser would open a file dropped anywhere else in place of the page.
    expect(overForm.defaultPrevented).toBe(true);
    expect(overForm.dataTransfer.dropEffect).toBe("none");
  });

  it("reports a file dropped on a marked element", () => {
    const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });

    element("b").dispatchEvent(
      drag("drop", { types: ["Files"], files: [file] }),
    );

    expect(listeners.onFileDragEnd).toHaveBeenCalled();
    expect(listeners.onFileDrop).toHaveBeenCalledWith("contacts.phone", file);
  });

  it("ends a file drag once it stops coming over the page, not on every dragleave", () => {
    vi.useFakeTimers();
    try {
      element("b").dispatchEvent(drag("dragleave", { types: ["Files"] }));
      vi.advanceTimersByTime(DRAG_GONE_AFTER_MS / 2);
      element("form").dispatchEvent(drag("dragover", { types: ["Files"] }));
      vi.advanceTimersByTime(DRAG_GONE_AFTER_MS);

      expect(listeners.onFileDragEnd).not.toHaveBeenCalled();

      element("form").dispatchEvent(drag("dragleave", { types: ["Files"] }));
      vi.advanceTimersByTime(DRAG_GONE_AFTER_MS);

      expect(listeners.onFileDragEnd).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves drags of text and of the page's own elements alone", () => {
    const textDrag = drag("dragover", { types: ["text/plain"] });

    element("b").dispatchEvent(textDrag);

    expect(textDrag.defaultPrevented).toBe(false);
    expect(listeners.onFileDragOver).not.toHaveBeenCalled();
  });

  it("stops listening", () => {
    stopListening();

    element("b").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.dispatchEvent(new Event("scroll"));

    expect(listeners.onClick).not.toHaveBeenCalled();
    expect(listeners.onLayoutChange).not.toHaveBeenCalled();
  });
});
