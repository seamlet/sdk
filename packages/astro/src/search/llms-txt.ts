// llms.txt (llmstxt.org): what an AI assistant reads first to learn a site, in Markdown: the site's
// name, a line about it, then its pages under headings, each a link with what the page is about.
// It is made from the site's description and its published content, so it never falls behind.

/** A page as llms.txt lists it. */
export interface LlmsPage {
  /** The whole address of the page. */
  readonly url: string;
  /** Its title for search engines, or its name in the editor when the owner left that empty. */
  readonly name: string;
  /** What the page is about, for search engines; empty when the owner wrote nothing. */
  readonly description: string;
}

/** A heading of llms.txt and the pages under it. */
export interface LlmsSection {
  readonly title: string;
  readonly pages: readonly LlmsPage[];
}

export interface LlmsSource {
  /** The site's name. */
  readonly title: string;
  /** A line about the site, such as the description of its home page; empty for none. */
  readonly summary: string;
  readonly sections: readonly LlmsSection[];
}

const LINE_BREAKS = /\s+/gu;
const LINK_TEXT_MARKS = /[\\[\]]/gu;
const ADDRESS_MARKS: Readonly<Record<string, string>> = {
  "(": "%28",
  ")": "%29",
  " ": "%20",
};

/** The site's llms.txt; a section without pages is left out. */
export function llmsTxtOf(source: LlmsSource): string {
  const summary = oneLine(source.summary);
  const sections = source.sections
    .filter((section) => section.pages.length > 0)
    .map(sectionText);
  return [
    `# ${oneLine(source.title)}`,
    ...(summary === "" ? [] : [`> ${summary}`]),
    ...sections,
  ]
    .join("\n\n")
    .concat("\n");
}

function sectionText(section: LlmsSection): string {
  const lines = section.pages.map(pageLine);
  return [`## ${oneLine(section.title)}`, "", ...lines].join("\n");
}

function pageLine(page: LlmsPage): string {
  const name = oneLine(page.name).replace(LINK_TEXT_MARKS, "\\$&");
  const url = page.url.replace(
    /[() ]/gu,
    (mark) => ADDRESS_MARKS[mark] ?? mark,
  );
  const description = oneLine(page.description);
  const link = `- [${name}](${url})`;
  return description === "" ? link : `${link}: ${description}`;
}

/** The text on one line: Markdown would read a line break as the end of the item. */
function oneLine(text: string): string {
  return text.replace(LINE_BREAKS, " ").trim();
}
