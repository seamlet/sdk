import { isSiteId, SITE_CONFIG_FILE, type SiteConfig } from "../schema";
import { SITE_MODULE_FILE } from "../site-addresses";

// The files `npx @seamlet/astro init` starts a site with: its seamlet.json and the smallest module
// the CMS can edit (one text on one page). The site's own pages and config stay the author's.

export interface SiteFile {
  /** From the root of the site. */
  readonly path: string;
  readonly text: string;
}

/** Where a site's schema and first page are, as the README names them. */
const SCHEMA_PATH = "src/schema.ts";
const HOME_PAGE_FILE = "src/components/HomePage.astro";
const JSON_INDENT = 2;

/** The site's `seamlet.json`. */
export function configFileOf(config: SiteConfig): SiteFile {
  return {
    path: SITE_CONFIG_FILE,
    text: `${JSON.stringify(config, null, JSON_INDENT)}\n`,
  };
}

/** The site's module with the schema and the page it imports: they go together. */
export function moduleFilesOf(config: SiteConfig): readonly SiteFile[] {
  return [
    { path: SCHEMA_PATH, text: schemaModuleOf(config.title) },
    { path: SITE_MODULE_FILE, text: SITE_MODULE },
    { path: HOME_PAGE_FILE, text: HOME_PAGE },
  ];
}

/**
 * The id a package's name gives (`@studio/dzen-yoga` → `dzen-yoga`), or undefined when it gives
 * none the CMS takes.
 */
export function siteIdOf(packageName: string): string | undefined {
  const unscoped = packageName.replace(/^@[^/]+\//u, "");
  const id = unscoped
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");
  return isSiteId(id) ? id : undefined;
}

function schemaModuleOf(title: string): string {
  return `import { defineSchema, text, type ContentOf } from "@seamlet/astro/schema";

// What the site's owner edits in the CMS. Add a field here, show it on a page and mark its element
// with edit(...): the CMS builds its form from this schema alone.
export const schema = defineSchema({
  title: text({ label: "Заголовок" }),
});

export type Content = ContentOf<typeof schema>;

/** What the site shows, and the CMS edits, until the first publication. */
export const initialContent: Content = {
  title: ${JSON.stringify(title)},
};
`;
}

const SITE_MODULE = `import { defineSeamletSite } from "@seamlet/astro/site";
import HomePage from "./components/HomePage.astro";
import { initialContent, schema } from "./schema";

// The site as the CMS knows it: its schema, the content it starts with and its pages (its id and
// title are in seamlet.json). Every page is a component that takes the content as its prop.
export default defineSeamletSite({
  schema,
  initialContent,
  pages: {
    "/": { title: "Главная", component: HomePage },
  },
});
`;

const HOME_PAGE = `---
import { editable } from "@seamlet/astro/schema";
import type { Content } from "../schema";

interface Props {
  content: Content;
}

const { content } = Astro.props;
// The CMS's editor lets the owner click the marked elements; a path the content lacks does not compile.
const edit = editable<Content>();
---

<h1 {...edit("title")}>{content.title}</h1>
`;
