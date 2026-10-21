import type { ImageMetadata } from "astro";
import type { AstroComponentFactory } from "astro/runtime/server/index.js";
import { cmsOrigin, siteId, siteTitle } from "virtual:seamlet/config";
import {
  parseContent,
  type Content,
  type ContentOf,
  type Fields,
  type RequestForm,
  type SiteDescription,
} from "./schema";
import { fetchPublishedAnswer } from "./published-answers";
import { describeSite } from "./site-descriptions";
import {
  pagePathOf,
  previewedPageAt,
  renderedPageAt,
  staticPagesOf,
  type RenderedPage,
  type SeamletPage,
  type SeamletRecordPage,
  type SitePages,
  type StaticPage,
} from "./site-pages";

export type {
  PageProps,
  RenderedPage,
  SeamletPage,
  SeamletRecordPage,
  StaticPage,
} from "./site-pages";

/** The site's content and pages; its id and title come from `seamlet.json`. */
export interface SeamletSiteDefinition<F extends Fields> {
  readonly schema: F;
  /** The content the site shows, and the CMS edits, until the first publication. */
  readonly initialContent: ContentOf<F>;
  /** The pages of the site by their address (`/`, `/menu`); the home page `/` comes first. */
  readonly pages: Readonly<Record<string, SeamletPage>>;
  /**
   * A page of every record of a collection, each kind with the component that renders it:
   * `[{ pages: recordPages(schema, { collection: "menu", path: "/menu/[record]" }), component }]`.
   */
  readonly recordPages?: readonly SeamletRecordPage[];
  /**
   * The site's own photo at the address its content gives it (`/menu/cafe/01.jpg`), so the CMS's
   * editor can show it in the photo's field. A site without own photos leaves it out.
   */
  readonly photos?: (src: string) => ImageMetadata | undefined;
  /**
   * The forms visitors send the business requests with (`requestForm(...)`), rendered with
   * `RequestForm.astro`: the CMS keeps the requests and passes them on.
   */
  readonly forms?: readonly RequestForm[];
}

export interface SeamletSite<F extends Fields = Fields> {
  readonly id: string;
  readonly schema: F;
  /**
   * The page at the rest of an address: nothing is the first page, `menu` the page at /menu.
   * @deprecated The site's own pages only: `pageOf` renders the pages of records too.
   */
  readonly pageAt: (
    rest: string | undefined,
  ) => AstroComponentFactory | undefined;
  /**
   * What renders the page at the rest of an address (`[...page]`) with the content: nothing is the
   * first page, `menu/latte` the page of the record at /menu/latte. Undefined when there is none.
   */
  readonly pageOf: (
    rest: string | undefined,
    content: ContentOf<F>,
  ) => RenderedPage | undefined;
  /**
   * What the preview renders at the rest of an address with the content: as `pageOf`, and the page
   * of a record the site does not show, so the owner prepares it in the editor.
   */
  readonly previewPageOf: (
    rest: string | undefined,
    content: ContentOf<F>,
  ) => RenderedPage | undefined;
  /** Every page of the site with the content, for `getStaticPaths` of a `[...page]` route. */
  readonly staticPaths: (content: ContentOf<F>) => StaticPage[];
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
  const sitePages: SitePages = {
    schema: definition.schema,
    pages: definition.pages,
    recordPages: definition.recordPages ?? [],
  };
  // Content of the site's schema is content: every value is one of its fields'.
  const contentOf = (content: ContentOf<F>) => content as Content;

  return {
    id: siteId,
    schema: definition.schema,
    pageAt: (rest) => {
      const path = pagePathOf(rest);
      const page = Object.hasOwn(definition.pages, path)
        ? definition.pages[path]
        : undefined;
      return page?.component;
    },
    pageOf: (rest, content) =>
      renderedPageAt(sitePages, pagePathOf(rest), contentOf(content)),
    previewPageOf: (rest, content) =>
      previewedPageAt(sitePages, pagePathOf(rest), contentOf(content)),
    staticPaths: (content) => staticPagesOf(sitePages, contentOf(content)),
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
  const answer = await fetchPublishedAnswer(url);
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
