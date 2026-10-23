import { parse, type DefaultTreeAdapterMap } from "parse5";
import type { PageNode } from "./bridge/unmarked-texts";

// A page's HTML as the check of texts reads it, for a build, where there is no browser: the body
// of the page, its elements with their attributes and its texts. Comments are left out.

type HtmlNode = DefaultTreeAdapterMap["childNode"];
type HtmlElement = DefaultTreeAdapterMap["element"];

/** The body of the page in the HTML, or undefined when it has none. */
export function pageBodyOf(html: string): PageNode | undefined {
  const document = parse(html);
  const root = document.childNodes.find(isElement);
  const body = root?.childNodes.find(
    (node): node is HtmlElement => isElement(node) && node.tagName === "body",
  );
  return body === undefined ? undefined : pageNodeOf(body);
}

function pageNodeOf(node: HtmlNode): PageNode | undefined {
  if (node.nodeName === "#text" && "value" in node) {
    return { kind: "text", text: node.value };
  }
  if (!isElement(node)) return undefined;

  const attributes = Object.fromEntries(
    node.attrs.map(({ name, value }) => [name, value]),
  );
  const children = node.childNodes.flatMap((child) => {
    const read = pageNodeOf(child);
    return read === undefined ? [] : [read];
  });
  return { kind: "element", name: node.tagName, attributes, children };
}

function isElement(
  node: HtmlNode | DefaultTreeAdapterMap["node"],
): node is HtmlElement {
  return "tagName" in node;
}
