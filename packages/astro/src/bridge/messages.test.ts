import { describe, expect, it } from "vitest";
import { readEditorMessage, readPageMessage } from "./messages";

const box = { top: 1, left: 2, width: 3, height: 4 };

describe("readPageMessage", () => {
  it("reads what the page says", () => {
    const layout = {
      type: "layout",
      layout: {
        markers: [
          { path: "title", box },
          { path: "lead", box, shown: box },
          { path: "photo", box, shown: null },
        ],
        viewport: { width: 800, height: 600 },
        link: undefined,
      },
    };
    const drop = {
      type: "file-drop",
      path: "hero.photo",
      file: new File(["photo"], "photo.jpg"),
    };

    expect(readPageMessage({ type: "ready", protocol: 1 })).toEqual({
      type: "ready",
      protocol: 1,
    });
    expect(readPageMessage(layout)).toEqual(layout);
    expect(readPageMessage({ type: "hover", path: undefined })).toEqual({
      type: "hover",
      path: undefined,
    });
    expect(readPageMessage({ type: "key", key: "save" })).toBeDefined();
    expect(readPageMessage(drop)).toBe(drop);
  });

  it("reads which copy of a field shown more than once the pointer is over", () => {
    const hover = { type: "hover", path: "title", copy: 2 };

    expect(readPageMessage(hover)).toEqual(hover);
    expect(readPageMessage({ ...hover, copy: -1 })).toBeUndefined();
    expect(readPageMessage({ ...hover, copy: 1.5 })).toBeUndefined();
  });

  it("reads formatted text typed in place and where its selection is", () => {
    const typed = {
      type: "rich-typed",
      path: "about",
      text: [{ kind: "paragraph", spans: [{ text: "Чай", bold: true }] }],
    };
    const selection = {
      type: "typed-selection",
      path: "about",
      selection: {
        box,
        isCollapsed: false,
        formats: { isBold: true, isItalic: false, isList: false, href: "/" },
      },
    };

    expect(readPageMessage(typed)).toEqual(typed);
    expect(readPageMessage(selection)).toEqual(selection);
    expect(
      readPageMessage({ ...typed, text: [{ kind: "table" }] }),
    ).toBeUndefined();
    expect(
      readPageMessage({ ...selection, selection: { box } }),
    ).toBeUndefined();
  });

  it("reads what a bridge of version 3 adds: the chosen click, the site's own texts, Tab", () => {
    const click = {
      type: "click",
      target: {
        path: "menu.0.roasted",
        point: { x: 1, y: 2 },
        shownText: "обжарено 4 дня назад",
      },
    };
    const outside = { type: "click", target: undefined, isStaticText: true };

    expect(readPageMessage(click)).toEqual(click);
    expect(readPageMessage(outside)).toEqual(outside);
    expect(readPageMessage({ type: "static-hover", box })).toEqual({
      type: "static-hover",
      box,
    });
    expect(
      readPageMessage({ type: "static-hover", box: undefined }),
    ).toBeDefined();
    expect(readPageMessage({ type: "key", key: "next-field" })).toBeDefined();
    expect(
      readPageMessage({ type: "key", key: "previous-field" }),
    ).toBeDefined();
    expect(
      readPageMessage({ ...click, target: { ...click.target, shownText: 4 } }),
    ).toBeUndefined();
    expect(
      readPageMessage({ ...outside, isStaticText: "yes" }),
    ).toBeUndefined();
    expect(
      readPageMessage({ type: "static-hover", box: { top: 1 } }),
    ).toBeUndefined();
  });

  it("reads a click of a bridge before version 3, without the words and the site's texts", () => {
    const click = {
      type: "click",
      target: { path: "title", point: { x: 1, y: 2 } },
    };

    expect(readPageMessage(click)).toEqual(click);
    expect(readPageMessage({ type: "click", target: undefined })).toBeDefined();
  });

  it("drops anything that is not a message of the page", () => {
    expect(readPageMessage("ready")).toBeUndefined();
    expect(readPageMessage({ type: "ready" })).toBeUndefined();
    expect(readPageMessage(null)).toBeUndefined();
    expect(readPageMessage({ type: "navigate", href: "/" })).toBeUndefined();
    expect(readPageMessage({ type: "key", key: "print" })).toBeUndefined();
    expect(
      readPageMessage({ type: "file-drop", path: "hero.photo", file: "x" }),
    ).toBeUndefined();
    expect(
      readPageMessage({
        type: "layout",
        layout: {
          markers: [{ path: "title", box: { ...box, top: Number.NaN } }],
          viewport: { width: 1, height: 1 },
        },
      }),
    ).toBeUndefined();
    expect(
      readPageMessage({
        type: "layout",
        layout: {
          markers: [{ path: "title", box, shown: "all" }],
          viewport: { width: 1, height: 1 },
        },
      }),
    ).toBeUndefined();
    expect(
      readPageMessage({ type: "typing-ended", path: "title", outcome: "lost" }),
    ).toBeUndefined();
  });
});

describe("readEditorMessage", () => {
  it("reads what the editor says", () => {
    const typing = {
      type: "start-typing",
      path: "title",
      text: "Кофейня",
      isSingleLine: true,
      point: { x: 1, y: 2 },
    };

    expect(readEditorMessage(typing)).toEqual(typing);
    expect(readEditorMessage({ type: "scroll-to", path: ["menu", 0] })).toEqual(
      {
        type: "scroll-to",
        path: ["menu", 0],
      },
    );
    expect(readEditorMessage({ type: "render", content: {} })).toBeDefined();
  });

  it("reads the typing of formatted text and the changes of its marks", () => {
    const typing = {
      type: "start-rich-typing",
      path: "about",
      text: [{ kind: "paragraph", spans: [{ text: "Чай" }] }],
      isInline: false,
      point: { x: 1, y: 2 },
    };

    expect(readEditorMessage(typing)).toEqual(typing);
    expect(
      readEditorMessage({ type: "format-typed", format: "italic" }),
    ).toBeDefined();
    expect(
      readEditorMessage({ type: "link-typed", href: undefined }),
    ).toBeDefined();
    expect(
      readEditorMessage({ type: "format-typed", format: "underline" }),
    ).toBeUndefined();
    expect(readEditorMessage({ type: "link-typed", href: 1 })).toBeUndefined();
  });

  it("reads the typing of a number and a time, and a typing without a point", () => {
    const price = {
      type: "start-value-typing",
      path: "menu.0.price",
      kind: "number",
      value: 1990,
      point: { x: 1, y: 2 },
    };
    const opensAt = {
      type: "start-value-typing",
      path: "hours.opensAt",
      kind: "time",
      value: "08:00",
    };
    const typing = {
      type: "start-typing",
      path: "title",
      text: "Кофейня",
      isSingleLine: true,
    };

    expect(readEditorMessage(price)).toEqual(price);
    expect(readEditorMessage(opensAt)).toEqual(opensAt);
    expect(readEditorMessage(typing)).toEqual(typing);
    expect(readEditorMessage({ ...price, value: "1990" })).toBeUndefined();
    expect(readEditorMessage({ ...opensAt, value: 8 })).toBeUndefined();
    expect(readEditorMessage({ ...price, kind: "date" })).toBeUndefined();
    expect(readEditorMessage({ ...price, point: { x: 1 } })).toBeUndefined();
  });

  it("drops anything that is not a message of the editor", () => {
    expect(readEditorMessage({ type: "ready" })).toBeUndefined();
    expect(readEditorMessage({ type: "render", content: [] })).toBeUndefined();
    expect(
      readEditorMessage({ type: "scroll-to", path: [{ field: "x" }] }),
    ).toBeUndefined();
  });
});
