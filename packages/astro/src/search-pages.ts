import {
  collectionFieldAt,
  FIELD_PATH_SEPARATOR,
  isContentObject,
  recordAddressOf,
  recordPageAt,
  type Content,
  type FieldValue,
  type SiteDescription,
} from "./schema";
import { pagePathOf, type StaticPage } from "./site-pages";

// The pages a site shows to search engines and AI assistants, with the words they are known by:
// the site's own pages and the pages of the records it shows, never the preview's hidden ones. The
// sitemap lists their addresses, llms.txt their titles and descriptions.

/** A page of the site as search engines see it. */
export interface SearchPage {
  /** Its address on the site: `/`, `/menu/latte`. */
  readonly path: string;
  /** Its title for search engines, or its name when the owner left that empty. */
  readonly name: string;
  /** Its description for search engines; empty when the owner wrote none. */
  readonly description: string;
  /** The name of the collection of a page of a record; none for a page of the site. */
  readonly collection?: string;
}

interface SearchTexts {
  readonly title: string;
  readonly description: string;
}

const NO_SEARCH_TEXTS: SearchTexts = { title: "", description: "" };

/** The pages the site shows, as `site.staticPaths(content)` lists them. */
export function searchPagesOf(
  description: SiteDescription,
  pages: readonly StaticPage[],
): SearchPage[] {
  return pages.flatMap((page) => {
    const path = pagePathOf(page.params.page);
    const { props } = page.props;
    const searchPage =
      "record" in props
        ? recordSearchPage(description, path, props.record)
        : ownSearchPage(description, path, props.content);
    return searchPage === undefined ? [] : [searchPage];
  });
}

function ownSearchPage(
  description: SiteDescription,
  path: string,
  content: Content,
): SearchPage | undefined {
  const page = description.pages.find((described) => described.path === path);
  if (page === undefined) return undefined;

  const texts = searchTextsAt(content, page.searchTexts);
  return {
    path,
    name: texts.title === "" ? page.title : texts.title,
    description: texts.description,
  };
}

function recordSearchPage(
  description: SiteDescription,
  path: string,
  record: Content,
): SearchPage | undefined {
  const found = recordPageAt(description.recordPages ?? [], path);
  if (found === undefined) return undefined;
  const collection = collectionFieldAt(
    description.schema,
    found.page.collection,
  );
  if (collection === undefined) return undefined;

  const texts = searchTextsAt(record, found.page.searchTexts);
  const title = recordTitleOf(record, collection.itemTitle);
  const address = recordAddressOf(collection, record) ?? found.address;
  const name = [texts.title, title, address].find((words) => words !== "");
  return {
    path,
    name: name ?? address,
    description: texts.description,
    collection: collection.label,
  };
}

/** The title and the description at the path of the content (`seo.home`), when it has them. */
function searchTextsAt(
  content: Content,
  path: string | undefined,
): SearchTexts {
  if (path === undefined) return NO_SEARCH_TEXTS;

  let value: FieldValue = content;
  for (const name of path.split(FIELD_PATH_SEPARATOR)) {
    if (!isContentObject(value)) return NO_SEARCH_TEXTS;
    value = value[name] ?? null;
  }
  if (!isContentObject(value)) return NO_SEARCH_TEXTS;

  const { title, description } = value;
  return {
    title: typeof title === "string" ? title.trim() : "",
    description: typeof description === "string" ? description.trim() : "",
  };
}

/** The words of the record's field that names it in the editor: a text, or a link's text. */
function recordTitleOf(record: Content, itemTitle: string | undefined): string {
  const value = itemTitle === undefined ? undefined : record[itemTitle];
  if (typeof value === "string") return value.trim();

  const linkText = isContentObject(value) ? value["text"] : undefined;
  return typeof linkText === "string" ? linkText.trim() : "";
}
