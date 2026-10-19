import { describe, expect, it } from "vitest";
import { readEditorMessage, readPageMessage } from "./messages";

const box = { top: 1, left: 2, width: 3, height: 4 };

describe("readPageMessage", () => {
  it("reads what the page says", () => {
    const layout = {
      type: "layout",
      layout: {
        markers: [{ path: "title", box }],
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
      readPageMessage({ type: "typing-ended", path: "title", outcome: "lost" }),
    ).toBeUndefined();
  });
});

describe("readEditorMessage", () => {
  it("reads what the editor says", () => {
    const typing = {
      type: "start-typing",
      path: "title",
      text: "Зерно",
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

  it("drops anything that is not a message of the editor", () => {
    expect(readEditorMessage({ type: "ready" })).toBeUndefined();
    expect(readEditorMessage({ type: "render", content: [] })).toBeUndefined();
    expect(
      readEditorMessage({ type: "scroll-to", path: [{ field: "x" }] }),
    ).toBeUndefined();
  });
});
