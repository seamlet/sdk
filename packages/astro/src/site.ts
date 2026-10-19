import type { ImageMetadata } from "astro";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { cmsOrigin, siteId, siteTitle } from "virtual:seamlet/config";
import {
  parseContent,
  type ContentOf,
  type Fields,
  type SiteDescription,
} from "./schema";
import { readPublishedAnswer } from "./published-answers";
import { describeSite } from "./site-descriptions";

/** The first page of every site. */
const HOME_PAGE_PATH = "/";

/** A page of the site: how the editor names it, and the component that renders it. */
export interface SeamletPage {
  readonly title: string;
  /** A component that takes the site's content as its `content` prop. */
  readonly component: AstroComponentFactory;
  /** Where the content holds the page's title and description for search engines (`seo.menu`). */
  readonly searchTexts?: string;
}

/** The site's content and pages; its id and title come from `seamlet.json`. */
export interface SeamletSiteDefinition<F extends Fields> {
  readonly schema: F;
  /** The content the site shows, and the CMS edits, until the first publication. */
  readonly initialContent: ContentOf<F>;
  /** The pages of the site by their address (`/`, `/menu`); the home page `/` comes first. */
  readonly pages: Readonly<Record<string, SeamletPage>>;
  /**
   * The site's own photo at the address its content gives it (`/menu/cafe/01.jpg`), so the CMS's
   * editor can show it in the photo's field. A site without own photos leaves it out.
   */
  readonly photos?: (src: string) => ImageMetadata | undefined;
}

export interface SeamletSite<F extends Fields = Fields> {
  readonly id: string;
  readonly schema: F;
  /** The page at the rest of an address: nothing is the first page, `menu` the page at /menu. */
  readonly pageAt: (
    rest: string | undefined,
  ) => AstroComponentFactory | undefined;
  /** What the CMS published: the site's initial content until the first publication. */
  readonly loadPublishedContent: () => Promise<ContentOf<F>>;
  /** The site's own photo at an address its content gives it, if it has one there. */
  readonly ownPhotoAt: (src: string) => ImageMetadata | undefined;
  /** What the site tells the CMS about itself (`SITE_DESCRIPTION_PATH`). */
  readonly description: SiteDescription;
}

/** Describes the site for the integration: `src/seamlet.ts` exports it as its default. */
export function defineSeamletSite<F extends Fields>(
  definition: SeamletSiteDefinition<F>,
): SeamletSite<F> {
  const pages = new Map(Object.entries(definition.pages));

  return {
    id: siteId,
    schema: definition.schema,
    pageAt: (rest) =>
      pages.get(rest === undefined ? HOME_PAGE_PATH : `/${rest}`)?.component,
    loadPublishedContent: () => loadPublishedContent(definition.schema),
    ownPhotoAt: (src) => definition.photos?.(src),
    description: describeSite({ id: siteId, title: siteTitle }, definition),
  };
}

/**
 * What the CMS published for the site, in the shape of its schema: the site's initial content until
 * the first publication, and while the CMS does not know the site yet. For a module that needs the
 * content without the pages.
 */
export async function loadPublishedContent<F extends Fields>(
  schema: F,
): Promise<ContentOf<F>> {
  const url = new URL(`/api/sites/${siteId}/published`, cmsOrigin);
  const answer = await readPublishedAnswer(await fetch(url), url);
  const content =
    answer.status === "published"
      ? answer.content
      : await initialContentOfSite();
  return parseContent(schema, content).content;
}

/** The initial content of the site's module, for a site the CMS does not know yet. */
async function initialContentOfSite(): Promise<unknown> {
  console.warn(
    `@seamlet/astro: the CMS at ${cmsOrigin} does not know the site "${siteId}" yet; its initial content is shown`,
  );
  // Imported when needed: the site's module imports this one.
  const { default: site } = await import("virtual:seamlet/site");
  return site.description.initialContent;
}
