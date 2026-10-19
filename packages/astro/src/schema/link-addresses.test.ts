import { describe, expect, it } from "vitest";
import { hrefOf, linkTargetOf, safeHref } from "./link-addresses";

describe("linkTargetOf", () => {
  it("knows the four places a link of a site may lead", () => {
    expect(linkTargetOf("/menu#drinks")).toEqual({
      kind: "page",
      path: "/menu#drinks",
    });
    expect(linkTargetOf("https://yclients.com/zerno")).toEqual({
      kind: "web",
      url: "https://yclients.com/zerno",
    });
    expect(linkTargetOf("tel:+70000000000")).toEqual({
      kind: "phone",
      number: "+70000000000",
    });
    expect(linkTargetOf("mailto:hello@zerno.example")).toEqual({
      kind: "email",
      address: "hello@zerno.example",
    });
  });

  it("refuses addresses that run code or lead nowhere", () => {
    const refused = [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r\\evil.example",
      " /menu",
      "/menu ",
      "https://",
      "ftp://files.example",
      "tel:",
      "tel:call-me",
      "mailto:nobody",
      "menu",
      "",
    ];

    for (const href of refused) expect(linkTargetOf(href)).toBeUndefined();
  });
});

describe("hrefOf", () => {
  it("builds an address from what a person typed", () => {
    expect(hrefOf({ kind: "phone", number: "+7 (000) 000-00-00" })).toBe(
      "tel:+70000000000",
    );
    expect(hrefOf({ kind: "email", address: " hello@zerno.example " })).toBe(
      "mailto:hello@zerno.example",
    );
    expect(hrefOf({ kind: "web", url: "t.me/zerno" })).toBe(
      "https://t.me/zerno",
    );
    expect(hrefOf({ kind: "web", url: "http://old.example" })).toBe(
      "http://old.example",
    );
    expect(hrefOf({ kind: "web", url: "" })).toBe("");
    expect(hrefOf({ kind: "web", url: "zerno.ru:8080/menu" })).toBe(
      "https://zerno.ru:8080/menu",
    );
    expect(hrefOf({ kind: "web", url: "localhost:3000" })).toBe(
      "https://localhost:3000",
    );
    expect(hrefOf({ kind: "page", path: "/menu" })).toBe("/menu");
  });

  it("does not make a dangerous address look safe", () => {
    const href = hrefOf({ kind: "web", url: "javascript:alert(1)" });

    expect(linkTargetOf(href)).toBeUndefined();
  });
});

describe("safeHref", () => {
  it("keeps an address a link of a site may have as it is", () => {
    const safe = [
      "/menu#drinks",
      "/%5Cevil.example",
      "https://yclients.com/zerno",
      "HTTPS://YCLIENTS.COM/zerno",
      "tel:+70000000000",
      "mailto:hello@zerno.example",
    ];

    for (const href of safe) expect(safeHref(href)).toBe(href);
  });

  it("gives nothing for an address that runs code or leads elsewhere than it shows", () => {
    const unsafe = [
      "javascript:alert(1)",
      " JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "java\tscript:alert(1)",
      "/\u0000/evil.example",
      "/menu\u007f",
      "tel:+7000\n0000000",
      "https://zerno.example/\u0001",
      "",
    ];

    for (const href of unsafe) expect(safeHref(href)).toBeUndefined();
  });
});
