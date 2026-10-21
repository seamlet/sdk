// Writing XML for the feeds: text and attributes escaped, so a product's words never break the
// file whatever they hold.

const ESCAPES: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};
const TAB = 0x09;
const LINE_FEED = 0x0a;
const CARRIAGE_RETURN = 0x0d;
const FIRST_PRINTED = 0x20;
const NOT_CHARACTERS: ReadonlySet<number> = new Set([0xfffe, 0xffff]);

export function escapeXml(text: string): string {
  const kept = Array.from(text).filter(isXmlCharacter).join("");
  return kept.replace(
    /[&<>"']/gu,
    (character) => ESCAPES[character] ?? character,
  );
}

/** Whether XML 1.0 has a place for the character: a text pasted from elsewhere may carry others. */
function isXmlCharacter(character: string): boolean {
  const code = character.codePointAt(0) ?? 0;
  const isWhitespace =
    code === TAB || code === LINE_FEED || code === CARRIAGE_RETURN;
  return (isWhitespace || code >= FIRST_PRINTED) && !NOT_CHARACTERS.has(code);
}

/** An element with text inside: `<name>Латте</name>`. */
export function textElement(name: string, text: string): string {
  return `<${name}>${escapeXml(text)}</${name}>`;
}

export const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>';
