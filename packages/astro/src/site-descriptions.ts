import type {
  Fields,
  SiteConfig,
  SiteDescription,
  SitePageDescription,
} from "./schema";
import type { SeamletSiteDefinition } from "./site";

// What a site tells the CMS about itself, from its config and its definition: everything but how it
// renders.

/** How the site is named in the CMS: from its `seamlet.json`. */
export type SiteIdentity = Pick<SiteConfig, "id" | "title">;

export function describeSite<F extends Fields>(
  identity: SiteIdentity,
  definition: SeamletSiteDefinition<F>,
): SiteDescription {
  const pages = Object.entries(definition.pages).map(
    ([path, page]): SitePageDescription => ({
      path,
      title: page.title,
      ...(page.searchTexts === undefined
        ? {}
        : { searchTexts: page.searchTexts }),
    }),
  );
  const [home, ...rest] = pages;
  if (home === undefined) {
    throw new Error(`The site "${identity.id}" has no pages`);
  }
  return {
    id: identity.id,
    title: identity.title,
    schema: definition.schema,
    initialContent: definition.initialContent,
    pages: [home, ...rest],
  };
}
