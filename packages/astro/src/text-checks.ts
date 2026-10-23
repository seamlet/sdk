import {
  collectionAt,
  recordAddressOf,
  recordPagePath,
  type SiteDescription,
} from "./schema";
import {
  describeUnmarkedText,
  type UnmarkedText,
} from "./bridge/unmarked-texts";

// What the check of a build reports: the texts of the site's pages the CMS's editor cannot reach.
// The pages are those of the site's description, rendered with its initial content, as the editor
// first shows them; the pages of a collection's records are one kind of page, reported once.

/** A page the check renders, and the kind of page it is reported under. */
export interface CheckedPage {
  /** The page's address: `/`, `/menu/latte`. */
  readonly path: string;
  /** The page's own address, or the address of the pages of its records: `/menu/[record]`. */
  readonly kind: string;
}

/** The unmarked texts of a page. */
export interface PageTexts {
  readonly page: CheckedPage;
  readonly texts: readonly UnmarkedText[];
}

/** How the build answers texts the editor cannot reach. */
export type ChecksMode = "warn" | "strict" | "off";

/** The pages of the description: its own, then the page of every record of its initial content. */
export function checkedPagesOf(description: SiteDescription): CheckedPage[] {
  const ownPages = description.pages.map(({ path }) => ({ path, kind: path }));
  const recordPages = (description.recordPages ?? []).flatMap((recordPage) => {
    const found = collectionAt(
      description.schema,
      description.initialContent,
      recordPage.collection,
    );
    if (found === undefined) return [];

    return found.records.flatMap((record) => {
      const address = recordAddressOf(found.collection, record);
      if (address === undefined) return [];
      const path = recordPagePath(recordPage.path, address);
      return [{ path, kind: recordPage.path }];
    });
  });
  return [...ownPages, ...recordPages];
}

/**
 * The report of the unmarked texts, or undefined when every text is reached: the texts every page
 * shows (a header, a footer) once, then each kind of page with the rest of its own.
 */
export function unmarkedTextsReport(
  pages: readonly PageTexts[],
): string | undefined {
  const kinds = [...textsByKind(pages)];
  const keySets = kinds.map(([, texts]) => new Set(texts.map(keyOf)));
  const isOnEveryPage = (text: UnmarkedText) =>
    kinds.length > 1 && keySets.every((keys) => keys.has(keyOf(text)));

  const [firstKind] = kinds;
  const everyPage = (firstKind?.[1] ?? []).filter(isOnEveryPage);
  const sections = [
    section("every page", everyPage),
    ...kinds.map(([kind, texts]) =>
      section(
        kind,
        texts.filter((text) => !isOnEveryPage(text)),
      ),
    ),
  ].filter((lines) => lines.length > 0);
  if (sections.length === 0) return undefined;

  const count = new Set(pages.flatMap(({ texts }) => texts.map(keyOf))).size;
  const heading = `${String(count)} texts of the pages have no field, so the CMS's editor cannot edit them. Mark each with editable() of its field, or with data-cms-fixed when the code owns it:`;
  return [heading, ...sections.flat()].join("\n");
}

/** The texts of each kind of page, the pages of a collection's records together. */
function textsByKind(
  pages: readonly PageTexts[],
): Map<string, readonly UnmarkedText[]> {
  const kinds = new Map<string, Map<string, UnmarkedText>>();
  for (const { page, texts } of pages) {
    const found = kinds.get(page.kind) ?? new Map<string, UnmarkedText>();
    for (const text of texts) found.set(keyOf(text), text);
    kinds.set(page.kind, found);
  }
  return new Map(
    [...kinds].map(([kind, texts]) => [kind, [...texts.values()]] as const),
  );
}

function section(title: string, texts: readonly UnmarkedText[]): string[] {
  if (texts.length === 0) return [];
  const lines = texts.map((text) => `    ${describeUnmarkedText(text)}`);
  return [`  ${title}:`, ...lines];
}

function keyOf(text: UnmarkedText): string {
  return `${text.location}\n${text.text}`;
}
